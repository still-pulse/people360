import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { canAccessAdmission, forbidIfReadOnly, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'
import { notifyAdmissionCandidate } from '@/lib/admission/notifications'
import { createAdditionalAdmissionToken } from '@/lib/admission/service'
import { isFaceVerificationEnabled } from '@/lib/admission/features'
import { isDocumentResolved } from '@/lib/admission/documentStatus'

const schema = z.object({ action: z.enum(['approve', 'not_applicable', 'reject', 'resubmit']), reason: z.string().trim().max(500).optional() }).superRefine((v, ctx) => {
  if (v.action !== 'approve' && !v.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Informe o motivo.' })
})

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized();if (error) return error
  const forbidden = forbidIfReadOnly(session!.user.role);if (forbidden) return forbidden
  const parsed = schema.safeParse(await req.json().catch(() => null));if (!parsed.success) return NextResponse.json({ error: 'Informe o motivo desta decisão.' }, { status: 400 })
  const doc = await prisma.admissionDocument.findUnique({ where: { id: params.id }, include: { admission: { include: { analysts: { select: { id: true } } } }, type: true } })
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
  if (!canAccessAdmission(session!, doc.admission)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  if (doc.admission.status === 'CANCELLED') return NextResponse.json({ error: 'Esta admissão foi cancelada e não pode mais ser revisada.' }, { status: 409 })
  if (parsed.data.action === 'not_applicable' && doc.uploadedAt) return NextResponse.json({ error: 'Somente documentos ainda não enviados podem ser marcados como não aplicáveis.' }, { status: 409 })
  const status = parsed.data.action === 'approve' ? 'APPROVED' : parsed.data.action === 'not_applicable' ? 'NOT_APPLICABLE' : parsed.data.action === 'reject' ? 'REJECTED' : 'RESUBMISSION_REQUIRED'
  const resolved = isDocumentResolved(status)
  const faceVerificationEnabled = isFaceVerificationEnabled()
  const isRegistrationUpdate = doc.admission.processType === 'REGISTRATION_UPDATE'
  await prisma.$transaction(async (tx) => {
    await tx.admissionDocument.update({ where: { id: doc.id }, data: { status, rejectionReason: resolved ? (status === 'NOT_APPLICABLE' ? parsed.data.reason : null) : parsed.data.reason, reviewedById: session!.user.id, reviewedAt: new Date() } })
    const remaining = await tx.admissionDocument.count({ where: { admissionId: doc.admissionId, type: { required: true }, status: { notIn: ['APPROVED', 'NOT_APPLICABLE'] } } })
    // Considera só a foto mais recente: uma nova foto enviada precisa de nova aprovação.
    const latestConfirmed = remaining === 0 ? await tx.badgePhoto.findFirst({ where: { admissionId: doc.admissionId, confirmedAt: { not: null } }, orderBy: { createdAt: 'desc' }, select: { id: true, approvedAt: true } }) : null
    const badgePhoto = latestConfirmed?.approvedAt ? latestConfirmed : null
    // Atualização cadastral não tem as etapas da admissão (foto, contrato): aprovar não muda o status,
    // senão a admissão sai de DOCUMENTS_UNDER_REVIEW e o RH não consegue confirmar no ERPNext.
    if (isRegistrationUpdate) {
      await tx.admission.update({ where: { id: doc.admissionId }, data: { status: resolved ? undefined : 'CORRECTION_REQUESTED', lastActivityAt: new Date() } })
      return
    }
    await tx.admission.update({ where: { id: doc.admissionId }, data: {
      status: resolved && remaining === 0 ? (badgePhoto ? (faceVerificationEnabled ? 'FACE_VALIDATION_PENDING' : 'CONTRACT_PENDING') : 'DOCUMENTS_APPROVED') : resolved ? 'DOCUMENTS_UNDER_REVIEW' : 'CORRECTION_REQUESTED',
      currentStep: resolved && remaining === 0 ? (badgePhoto ? (faceVerificationEnabled ? 'validacao-facial' : 'revisao') : 'foto') : undefined,
      progress: resolved && remaining === 0 && badgePhoto ? { set: Math.max(faceVerificationEnabled ? 74 : 82, doc.admission.progress) } : undefined,
      lastActivityAt: new Date(),
    } })
  })
  await logAdmissionEvent({ admissionId: doc.admissionId, actorId: session!.user.id, actorName: session!.user.name, actorType: 'USER', action: `DOCUMENT_${status}`, resource: 'AdmissionDocument', resourceId: doc.id, ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { documentType: doc.type.name, reason: parsed.data.reason } })
  const requiredRemaining = await prisma.admissionDocument.count({ where: { admissionId: doc.admissionId, type: { required: true }, status: { notIn: ['APPROVED', 'NOT_APPLICABLE'] } } })
  const allResolved = resolved && !isDocumentResolved(doc.status) && doc.type.required && requiredRemaining === 0
  const latestPhoto = allResolved ? await prisma.badgePhoto.findFirst({ where: { admissionId: doc.admissionId, confirmedAt: { not: null } }, orderBy: { createdAt: 'desc' }, select: { approvedAt: true } }) : null
  const hasBadgePhoto = Boolean(latestPhoto?.approvedAt)
  const photoUnderReview = Boolean(latestPhoto && !latestPhoto.approvedAt)
  const title = allResolved ? 'Documentação liberada' : status === 'APPROVED' ? 'Documento aprovado' : status === 'NOT_APPLICABLE' ? 'Documento dispensado' : status === 'RESUBMISSION_REQUIRED' ? 'Reenvio de documento solicitado' : 'Documento reprovado'
  const message = allResolved && photoUnderReview
    ? 'Todos os documentos obrigatórios foram analisados e liberados pelo RH. Sua foto do crachá ainda está em análise; avisaremos assim que você puder continuar.'
    : allResolved
    ? hasBadgePhoto
      ? faceVerificationEnabled
        ? 'Todos os documentos obrigatórios foram analisados e liberados pelo RH. Você já pode continuar para a validação facial usando o mesmo link da admissão.'
        : 'Todos os documentos obrigatórios foram analisados e liberados pelo RH. Você já pode continuar a admissão usando o mesmo link.'
      : 'Todos os documentos obrigatórios foram analisados e liberados pelo RH. Acesse o mesmo link da admissão e envie a foto do crachá para continuar.'
    : status === 'APPROVED' ? `O documento “${doc.type.name}” foi aprovado pelo RH.`
    : `O documento “${doc.type.name}” precisa de atenção. Motivo: ${parsed.data.reason}. Acesse o mesmo link da admissão para reenviar.`
  // Na atualização cadastral o colaborador só é avisado de reprovação/reenvio; a aprovação final vem ao confirmar no ERPNext.
  if (isRegistrationUpdate ? !resolved : allResolved || !resolved) {
    const access = allResolved && !photoUnderReview ? await createAdditionalAdmissionToken(doc.admissionId) : null
    const portalUrl = access ? `${process.env.NEXTAUTH_URL || req.nextUrl.origin}/admissao/${access.token}` : undefined
    await notifyAdmissionCandidate({ ...doc.admission, title, message, portalUrl }).catch((notificationError) => console.error('[admission-notification]', notificationError))
  }
  return NextResponse.json({ success: true, status })
}
