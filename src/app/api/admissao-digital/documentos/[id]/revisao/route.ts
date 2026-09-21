import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { analystCanAccessUnit, forbidIfReadOnly, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'

const schema = z.object({ action: z.enum(['approve', 'reject', 'resubmit']), reason: z.string().trim().max(500).optional() }).superRefine((v, ctx) => {
  if (v.action !== 'approve' && !v.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Informe o motivo.' })
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  const forbidden = forbidIfReadOnly(session!.user.role); if (forbidden) return forbidden
  const parsed = schema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'O motivo é obrigatório para reprovar ou solicitar reenvio.' }, { status: 400 })
  const doc = await prisma.admissionDocument.findUnique({ where: { id: params.id }, include: { admission: true, type: true } })
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
  if (!analystCanAccessUnit(session!, doc.admission.unitId)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  const status = parsed.data.action === 'approve' ? 'APPROVED' : parsed.data.action === 'reject' ? 'REJECTED' : 'RESUBMISSION_REQUIRED'
  await prisma.$transaction(async (tx) => {
    await tx.admissionDocument.update({ where: { id: doc.id }, data: { status, rejectionReason: parsed.data.action === 'approve' ? null : parsed.data.reason, reviewedById: session!.user.id, reviewedAt: new Date() } })
    const remaining = await tx.admissionDocument.count({ where: { admissionId: doc.admissionId, type: { required: true }, status: { not: 'APPROVED' } } })
    await tx.admission.update({ where: { id: doc.admissionId }, data: { status: status === 'APPROVED' && remaining <= 1 ? 'DOCUMENTS_APPROVED' : status === 'APPROVED' ? 'DOCUMENTS_UNDER_REVIEW' : 'CORRECTION_REQUESTED', lastActivityAt: new Date() } })
  })
  await logAdmissionEvent({ admissionId: doc.admissionId, actorId: session!.user.id, actorName: session!.user.name, actorType: 'USER', action: `DOCUMENT_${status}`, resource: 'AdmissionDocument', resourceId: doc.id, ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { documentType: doc.type.name, reason: parsed.data.reason } })
  return NextResponse.json({ success: true, status })
}
