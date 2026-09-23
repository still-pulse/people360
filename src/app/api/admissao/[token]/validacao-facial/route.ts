import { NextRequest, NextResponse } from 'next/server'
import type { FaceVerificationStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMutableAdmissionByPublicToken } from '@/lib/admission/service'
import { getFaceProvider, FaceProviderRequestError } from '@/lib/admission/faceProvider'
import { deletePrivateAdmissionFile, detectMime, readPrivateAdmissionFile, savePrivateAdmissionFile } from '@/lib/admission/storage'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'
import { checkPublicDocLinkRateLimit } from '@/lib/rateLimit'
import { notifyAdmissionCandidate } from '@/lib/admission/notifications'
import { renderPdfFirstPageAsJpeg } from '@/lib/admission/pdfImage'

const imageMimeTypes = new Set(['image/jpeg', 'image/png'])

function faceMime(mimeType: string | null | undefined): 'image/jpeg' | 'image/png' | null {
  return mimeType && imageMimeTypes.has(mimeType) ? mimeType as 'image/jpeg' | 'image/png' : null
}

function safeReason(error: unknown) {
  return error instanceof FaceProviderRequestError ? error.code : 'FACE_PROVIDER_ERROR'
}

export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const rateKey = `${extractIp(req.headers) || 'unknown'}:face:${params.token.slice(-8)}`
  if (!checkPublicDocLinkRateLimit(rateKey).allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 })
  }

  const token = await getMutableAdmissionByPublicToken(params.token)
  if (!token) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  const badgePhoto = token.admission.badgePhotos[0]
  if (!badgePhoto?.confirmedAt) return NextResponse.json({ error: 'Confirme primeiro a foto para o crachá.' }, { status: 409 })
  if (token.admission.documents.some((document) => document.type.required && document.status !== 'APPROVED')) {
    return NextResponse.json({ error: 'Aguarde a aprovação dos documentos obrigatórios pelo RH.' }, { status: 409 })
  }

  const referenceKeys = new Set((process.env.COMPREFACE_REFERENCE_DOCUMENT_KEYS || 'rg_frente')
    .split(',').map((key) => key.trim()).filter(Boolean))
  const reference = token.admission.documents.find((document) =>
    referenceKeys.has(document.type.key) && document.status === 'APPROVED' && document.storagePath)
  if (!reference?.storagePath) {
    return NextResponse.json({ error: 'Não encontramos o documento de identidade aprovado para a comparação.' }, { status: 409 })
  }

  let capture: File | null = null
  try {
    const form = await req.formData()
    const value = form.get('file')
    capture = value instanceof File ? value : null
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler a captura facial.' }, { status: 400 })
  }
  if (!capture || capture.size <= 0) {
    return NextResponse.json({ error: 'Abra a câmera e faça uma nova captura para a validação facial.' }, { status: 400 })
  }
  const maximumCaptureBytes = 5 * 1024 * 1024
  if (capture.size > maximumCaptureBytes) {
    return NextResponse.json({ error: 'A captura facial deve ter no máximo 5 MB.' }, { status: 400 })
  }
  const captureBuffer = Buffer.from(await capture.arrayBuffer())
  const captureType = detectMime(captureBuffer)
  if (!captureType || !imageMimeTypes.has(captureType.mime)) {
    return NextResponse.json({ error: 'A captura facial deve ser uma imagem JPG ou PNG válida.' }, { status: 400 })
  }

  const current = token.admission.faceVerifications[0]
  if (!current) return NextResponse.json({ error: 'Registro de validação facial não encontrado.' }, { status: 409 })
  if (current.status === 'APPROVED') return NextResponse.json({ status: 'APPROVED', canRetry: false })
  const providerTimeout = Number(process.env.COMPREFACE_TIMEOUT_MS || 55000)
  const staleAfterMs = Math.min(135000, Math.max(45000, providerTimeout + 15000))
  const staleAt = new Date(Date.now() - staleAfterMs)
  if (current.status === 'IN_PROGRESS' && current.updatedAt > staleAt) {
    return NextResponse.json({ error: 'A validação já está sendo processada.' }, { status: 409 })
  }

  const claimed = await prisma.faceVerification.updateMany({
    where: { id: current.id, OR: [{ status: { not: 'IN_PROGRESS' } }, { updatedAt: { lte: staleAt } }] },
    data: { status: 'IN_PROGRESS', attempts: { increment: 1 }, completedAt: null },
  })
  if (!claimed.count) return NextResponse.json({ error: 'A validação já está sendo processada.' }, { status: 409 })

  const providerName = (process.env.FACE_VERIFICATION_PROVIDER || 'mock').toLowerCase()
  const selfieMime = faceMime(captureType.mime)
  const attempt = current.attempts + 1

  try {
    const savedCapture = await savePrivateAdmissionFile(token.admissionId, 'face-captures', capture)
    await prisma.faceVerification.update({
      where: { id: current.id },
      data: {
        capturePath: savedCapture.storagePath,
        captureMimeType: savedCapture.mimeType,
        captureSizeBytes: savedCapture.sizeBytes,
        capturedAt: new Date(),
      },
    })
    if (current.capturePath && current.capturePath !== savedCapture.storagePath) {
      await deletePrivateAdmissionFile(current.capturePath).catch(() => {})
    }

    const storedReference = await readPrivateAdmissionFile(reference.storagePath)
    if (!storedReference) throw new Error('FACE_FILE_NOT_FOUND')
    const storedReferenceType = detectMime(storedReference)?.mime
    let referenceBuffer = storedReference
    let referenceMime = faceMime(storedReferenceType)
    if (storedReferenceType === 'application/pdf') {
      referenceBuffer = await renderPdfFirstPageAsJpeg(storedReference)
      referenceMime = 'image/jpeg'
    }

    if (providerName === 'compreface' && (!selfieMime || !referenceMime)) {
      const reason = !referenceMime ? 'REFERENCE_DOCUMENT_NOT_IMAGE' : 'SELFIE_NOT_IMAGE'
      const verification = await prisma.faceVerification.update({
        where: { id: current.id },
        data: {
          provider: providerName,
          status: 'MANUAL_REVIEW',
          resultMetadata: { provider: providerName, reason } satisfies Prisma.InputJsonObject,
        },
      })
      await logAdmissionEvent({
        admissionId: token.admissionId, actorName: token.admission.candidateName, actorType: 'CANDIDATE',
        action: 'FACE_MANUAL_REVIEW', resource: 'FaceVerification', resourceId: verification.id,
        ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'),
        metadata: { provider: providerName, reason, attempt },
      })
      await notifyAdmissionCandidate({ ...token.admission, title: 'Validação facial em análise', message: 'A comparação facial apresentou uma inconsistência e foi encaminhada para análise do RH. Você será avisado sobre a próxima ação.' })
      return NextResponse.json({ status: 'MANUAL_REVIEW', canRetry: false, requiresHumanReview: true })
    }

    const provider = getFaceProvider()
    const result = await provider.verify({
      admissionId: token.admissionId,
      selfie: { buffer: captureBuffer, mimeType: captureType.mime, filename: `captura-facial.${selfieMime === 'image/png' ? 'png' : 'jpg'}` },
      reference: { buffer: referenceBuffer, mimeType: referenceMime || 'application/octet-stream', filename: `documento.${referenceMime === 'image/png' ? 'png' : referenceMime === 'image/jpeg' ? 'jpg' : 'bin'}` },
    })
    const status: FaceVerificationStatus = result.decision
    const approved = status === 'APPROVED'
    const verification = await prisma.$transaction(async (tx) => {
      const updated = await tx.faceVerification.update({
        where: { id: current.id },
        data: {
          provider: provider.name, providerRef: result.reference, status,
          completedAt: approved ? new Date() : null,
          resultMetadata: { ...result.metadata, reason: result.reason ?? null } as Prisma.InputJsonObject,
        },
      })
      await tx.admission.update({
        where: { id: token.admissionId },
        data: {
          currentStep: approved ? 'revisao' : 'validacao-facial',
          progress: { set: Math.max(approved ? 74 : 66, token.admission.progress) },
          status: approved ? 'CONTRACT_PENDING' : 'FACE_VALIDATION_PENDING',
          lastActivityAt: new Date(),
        },
      })
      return updated
    })
    await logAdmissionEvent({
      admissionId: token.admissionId, actorName: token.admission.candidateName, actorType: 'CANDIDATE',
      action: `FACE_${status}`, resource: 'FaceVerification', resourceId: verification.id,
      ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'),
      metadata: {
        provider: provider.name, reason: result.reason, attempt,
        captureMimeType: captureType.mime, captureSizeBytes: captureBuffer.length,
        decision: status, similarity: result.similarity ?? null,
        approveThreshold: result.metadata.approveThreshold ?? null,
        reviewThreshold: result.metadata.reviewThreshold ?? null,
      },
    })
    if (status !== 'APPROVED') await notifyAdmissionCandidate({
      ...token.admission,
      title: status === 'REJECTED' ? 'Nova captura facial necessária' : 'Validação facial em análise',
      message: status === 'REJECTED' ? 'Não foi possível confirmar a captura facial. Acesse o mesmo link da admissão e faça uma nova foto com boa iluminação.' : 'A comparação facial apresentou uma inconsistência e foi encaminhada para análise do RH.',
    })
    return NextResponse.json({ status, canRetry: status === 'REJECTED', requiresHumanReview: status === 'MANUAL_REVIEW' })
  } catch (error) {
    const reason = safeReason(error)
    console.error('[admission-face] provider failure', { provider: providerName, reason, attempt })
    await prisma.$transaction([
      prisma.faceVerification.update({
        where: { id: current.id },
        data: {
          provider: providerName,
          status: 'ERROR',
          resultMetadata: { provider: providerName, reason } satisfies Prisma.InputJsonObject,
        },
      }),
      prisma.admission.update({
        where: { id: token.admissionId },
        data: { currentStep: 'validacao-facial', status: 'FACE_VALIDATION_PENDING', lastActivityAt: new Date() },
      }),
    ])
    await logAdmissionEvent({
      admissionId: token.admissionId, actorName: token.admission.candidateName, actorType: 'CANDIDATE',
      action: 'FACE_ERROR', resource: 'FaceVerification', resourceId: current.id,
      ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'),
      metadata: { provider: providerName, reason, attempt },
    }).catch(() => {})
    await notifyAdmissionCandidate({ ...token.admission, title: 'Instabilidade na validação facial', message: 'Não foi possível concluir a validação facial agora. Aguarde alguns minutos e tente novamente pelo mesmo link da admissão.' }).catch(() => {})
    return NextResponse.json({
      error: 'Não foi possível concluir a validação agora. Tente novamente ou aguarde a revisão do RH.',
      status: 'ERROR', canRetry: true,
    }, { status: 502 })
  }
}
