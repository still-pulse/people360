import { NextRequest, NextResponse } from 'next/server'
import type { FaceVerificationStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAdmissionByPublicToken } from '@/lib/admission/service'
import { getFaceProvider, FaceProviderRequestError } from '@/lib/admission/faceProvider'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'
import { checkPublicDocLinkRateLimit } from '@/lib/rateLimit'

const imageMimeTypes = new Set(['image/jpeg', 'image/png'])

function faceMime(mimeType: string | null | undefined): 'image/jpeg' | 'image/png' | null {
  return mimeType && imageMimeTypes.has(mimeType) ? mimeType as 'image/jpeg' | 'image/png' : null
}

function safeReason(error: unknown) {
  return error instanceof FaceProviderRequestError ? error.code : 'FACE_PROVIDER_ERROR'
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const rateKey = `${extractIp(req.headers) || 'unknown'}:face:${params.token.slice(-8)}`
  if (!checkPublicDocLinkRateLimit(rateKey).allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 })
  }

  const token = await getAdmissionByPublicToken(params.token)
  if (!token) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  const selfie = token.admission.badgePhotos[0]
  if (!selfie) return NextResponse.json({ error: 'Confirme primeiro a foto para o crachá.' }, { status: 409 })
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

  const current = token.admission.faceVerifications[0]
  if (!current) return NextResponse.json({ error: 'Registro de validação facial não encontrado.' }, { status: 409 })
  if (current.status === 'APPROVED') return NextResponse.json({ status: 'APPROVED', canRetry: false })
  if (current.status === 'MANUAL_REVIEW') {
    return NextResponse.json({ error: 'A comparação está aguardando revisão do RH.', status: 'MANUAL_REVIEW' }, { status: 409 })
  }
  const staleAt = new Date(Date.now() - 2 * 60 * 1000)
  if (current.status === 'IN_PROGRESS' && current.updatedAt > staleAt) {
    return NextResponse.json({ error: 'A validação já está sendo processada.' }, { status: 409 })
  }

  const claimed = await prisma.faceVerification.updateMany({
    where: { id: current.id, OR: [{ status: { not: 'IN_PROGRESS' } }, { updatedAt: { lte: staleAt } }] },
    data: { status: 'IN_PROGRESS', attempts: { increment: 1 }, completedAt: null },
  })
  if (!claimed.count) return NextResponse.json({ error: 'A validação já está sendo processada.' }, { status: 409 })

  const providerName = (process.env.FACE_VERIFICATION_PROVIDER || 'mock').toLowerCase()
  const selfieMime = faceMime(selfie.mimeType)
  const referenceMime = faceMime(reference.mimeType)
  const attempt = current.attempts + 1

  try {
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
      return NextResponse.json({ status: 'MANUAL_REVIEW', canRetry: false, requiresHumanReview: true })
    }

    const [selfieBuffer, referenceBuffer] = await Promise.all([
      readPrivateAdmissionFile(selfie.originalPath),
      readPrivateAdmissionFile(reference.storagePath),
    ])
    if (!selfieBuffer || !referenceBuffer) throw new Error('FACE_FILE_NOT_FOUND')

    const provider = getFaceProvider()
    const result = await provider.verify({
      admissionId: token.admissionId,
      selfie: { buffer: selfieBuffer, mimeType: selfie.mimeType, filename: `selfie.${selfieMime === 'image/png' ? 'png' : 'jpg'}` },
      reference: { buffer: referenceBuffer, mimeType: reference.mimeType || 'application/octet-stream', filename: `documento.${referenceMime === 'image/png' ? 'png' : referenceMime === 'image/jpeg' ? 'jpg' : 'bin'}` },
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
      metadata: { provider: provider.name, reason: result.reason, attempt },
    })
    return NextResponse.json({ status, canRetry: status === 'REJECTED', requiresHumanReview: status === 'MANUAL_REVIEW' })
  } catch (error) {
    const reason = safeReason(error)
    await prisma.faceVerification.update({
      where: { id: current.id },
      data: {
        provider: providerName,
        status: 'ERROR',
        resultMetadata: { provider: providerName, reason } satisfies Prisma.InputJsonObject,
      },
    })
    await logAdmissionEvent({
      admissionId: token.admissionId, actorName: token.admission.candidateName, actorType: 'CANDIDATE',
      action: 'FACE_ERROR', resource: 'FaceVerification', resourceId: current.id,
      ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'),
      metadata: { provider: providerName, reason, attempt },
    }).catch(() => {})
    return NextResponse.json({
      error: 'Não foi possível concluir a validação agora. Tente novamente ou aguarde a revisão do RH.',
      status: 'ERROR', canRetry: true,
    }, { status: 502 })
  }
}
