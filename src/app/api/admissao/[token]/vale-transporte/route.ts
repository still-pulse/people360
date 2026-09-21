import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMutableAdmissionByPublicToken } from '@/lib/admission/service'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'

const schema = z.object({ requested: z.boolean(), refusalReason: z.string().max(500).optional(), declarationAccepted: z.boolean(), routes: z.array(z.object({ type: z.string().min(2).max(40), line: z.string().min(1).max(100), outbound: z.coerce.number().nonnegative().max(1000), returnValue: z.coerce.number().nonnegative().max(1000) })).max(20) }).superRefine((v, ctx) => {
  if (!v.requested && !v.refusalReason?.trim()) ctx.addIssue({ code: 'custom', path: ['refusalReason'], message: 'Informe o motivo.' })
  if (v.requested && !v.routes.length) ctx.addIssue({ code: 'custom', path: ['routes'], message: 'Adicione ao menos um trecho.' })
  if (!v.declarationAccepted) ctx.addIssue({ code: 'custom', path: ['declarationAccepted'], message: 'Confirme a declaração.' })
})

export async function PUT(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const token = await getMutableAdmissionByPublicToken(params.token);if (!token) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  const parsed = schema.safeParse(await req.json().catch(() => null));if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' }, { status: 400 })
  await prisma.$transaction(async (tx) => {
    const transport = await tx.admissionTransport.upsert({ where: { admissionId: token.admissionId }, create: { admissionId: token.admissionId, requested: parsed.data.requested, refusalReason: parsed.data.refusalReason, declarationVersion: process.env.VT_DECLARATION_VERSION || 'v1', declarationAcceptedAt: new Date() }, update: { requested: parsed.data.requested, refusalReason: parsed.data.refusalReason, declarationVersion: process.env.VT_DECLARATION_VERSION || 'v1', declarationAcceptedAt: new Date() } })
    await tx.admissionTransportRoute.deleteMany({ where: { transportId: transport.id } })
    if (parsed.data.requested) await tx.admissionTransportRoute.createMany({ data: parsed.data.routes.map((r, position) => ({ ...r, transportId: transport.id, position })) })
    await tx.admission.update({ where: { id: token.admissionId }, data: { currentStep: 'documentos', progress: { set: Math.max(38, token.admission.progress) }, status: 'AWAITING_DOCUMENTS', lastActivityAt: new Date() } })
  })
  await logAdmissionEvent({ admissionId: token.admissionId, actorName: token.admission.candidateName, actorType: 'CANDIDATE', action: 'TRANSPORT_SAVED', ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { requested: parsed.data.requested, routeCount: parsed.data.routes.length, declarationVersion: process.env.VT_DECLARATION_VERSION || 'v1' } })
  return NextResponse.json({ success: true })
}
