import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { analystCanAccessUnit, forbidIfReadOnly, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'
import { notifyAdmissionCandidate } from '@/lib/admission/notifications'
import { createAdditionalAdmissionToken } from '@/lib/admission/service'

const schema = z.object({ action: z.enum(['approve', 'reject', 'resubmit']), reason: z.string().trim().max(500).optional() }).superRefine((v, ctx) => {
  if (v.action !== 'approve' && !v.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Informe o motivo.' })
})

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized();if (error) return error
  const forbidden = forbidIfReadOnly(session!.user.role);if (forbidden) return forbidden
  const parsed = schema.safeParse(await req.json().catch(() => null));if (!parsed.success) return NextResponse.json({ error: 'O motivo é obrigatório para reprovar ou solicitar reenvio.' }, { status: 400 })
  const doc = await prisma.admissionDocument.findUnique({ where: { id: params.id }, include: { admission: true, type: true } })
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
  if (!analystCanAccessUnit(session!, doc.admission.unitId)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  const status = parsed.data.action === 'approve' ? 'APPROVED' : parsed.data.action === 'reject' ? 'REJECTED' : 'RESUBMISSION_REQUIRED'
  await prisma.$transaction(async (tx) => {
    await tx.admissionDocument.update({ where: { id: doc.id }, data: { status, rejectionReason: parsed.data.action === 'approve' ? null : parsed.data.reason, reviewedById: session!.user.id, reviewedAt: new Date() } })
    const remaining = await tx.admissionDocument.count({ where: { admissionId: doc.admissionId, type: { required: true }, status: { not: 'APPROVED' } } })
    const badgePhoto = remaining === 0 ? await tx.badgePhoto.findFirst({ where: { admissionId: doc.admissionId, confirmedAt: { not: null } }, select: { id: true } }) : null
    await tx.admission.update({ where: { id: doc.admissionId }, data: {
      status: status === 'APPROVED' && remaining === 0 ? (badgePhoto ? 'FACE_VALIDATION_PENDING' : 'DOCUMENTS_APPROVED') : status === 'APPROVED' ? 'DOCUMENTS_UNDER_REVIEW' : 'CORRECTION_REQUESTED',
      currentStep: status === 'APPROVED' && remaining === 0 && badgePhoto ? 'validacao-facial' : undefined,
      lastActivityAt: new Date(),
    } })
  })
  await logAdmissionEvent({ admissionId: doc.admissionId, actorId: session!.user.id, actorName: session!.user.name, actorType: 'USER', action: `DOCUMENT_${status}`, resource: 'AdmissionDocument', resourceId: doc.id, ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { documentType: doc.type.name, reason: parsed.data.reason } })
  const requiredRemaining = await prisma.admissionDocument.count({ where: { admissionId: doc.admissionId, type: { required: true }, status: { not: 'APPROVED' } } })
  const allApproved = status === 'APPROVED' && doc.status !== 'APPROVED' && doc.type.required && requiredRemaining === 0
  const hasBadgePhoto = allApproved && Boolean(await prisma.badgePhoto.findFirst({ where: { admissionId: doc.admissionId, confirmedAt: { not: null } }, select: { id: true } }))
  const title = allApproved ? 'Documentos aprovados' : status === 'APPROVED' ? 'Documento aprovado' : status === 'RESUBMISSION_REQUIRED' ? 'Reenvio de documento solicitado' : 'Documento reprovado'
  const message = allApproved
    ? hasBadgePhoto
      ? 'Todos os documentos obrigatórios foram aprovados pelo RH. Você já pode continuar para a validação facial usando o mesmo link da admissão.'
      : 'Todos os documentos obrigatórios foram aprovados pelo RH. Acesse o mesmo link da admissão, envie a foto do crachá e depois continue para a validação facial.'
    : status === 'APPROVED' ? `O documento “${doc.type.name}” foi aprovado pelo RH.`
    : `O documento “${doc.type.name}” precisa de atenção. Motivo: ${parsed.data.reason}. Acesse o mesmo link da admissão para reenviar.`
  if (allApproved || status !== 'APPROVED') {
    const access = allApproved ? await createAdditionalAdmissionToken(doc.admissionId) : null
    const portalUrl = access ? `${process.env.NEXTAUTH_URL || req.nextUrl.origin}/admissao/${access.token}` : undefined
    await notifyAdmissionCandidate({ ...doc.admission, title, message, portalUrl }).catch((notificationError) => console.error('[admission-notification]', notificationError))
  }
  return NextResponse.json({ success: true, status })
}
