import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAdmissionByPublicToken } from '@/lib/admission/service'
import { hashSensitive, isValidCpf, maskCpf } from '@/lib/admission/security'
import { extractIp } from '@/lib/audit'
import { logAdmissionEvent } from '@/lib/admission/audit'

const dependent = z.object({ id: z.string().cuid().optional(), name: z.string().min(3).max(160), cpf: z.string().optional(), birthDate: z.coerce.date(), relationship: z.string().min(2).max(60), irrfDependent: z.boolean().default(false), childUnder14: z.boolean().default(false) })
const schema = z.object({ dependents: z.array(dependent).max(30) })

export async function PUT(req: NextRequest, { params }: { params: { token: string } }) {
  const token = await getAdmissionByPublicToken(params.token); if (!token) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  const parsed = schema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Revise os dados dos dependentes.' }, { status: 400 })
  if (parsed.data.dependents.some((d) => d.cpf && !isValidCpf(d.cpf))) return NextResponse.json({ error: 'Há um CPF de dependente inválido.' }, { status: 400 })
  await prisma.$transaction(async (tx) => {
    await tx.admissionDependent.deleteMany({ where: { admissionId: token.admissionId } })
    if (parsed.data.dependents.length) await tx.admissionDependent.createMany({ data: parsed.data.dependents.map((d) => ({ admissionId: token.admissionId, name: d.name, cpfMasked: d.cpf ? maskCpf(d.cpf) : null, cpfHash: d.cpf ? hashSensitive(d.cpf) : null, birthDate: d.birthDate, relationship: d.relationship, irrfDependent: d.irrfDependent, childUnder14: d.childUnder14 })) })
    await tx.admission.update({ where: { id: token.admissionId }, data: { currentStep: 'vale-transporte', progress: { set: Math.max(28, token.admission.progress) }, lastActivityAt: new Date() } })
  })
  await logAdmissionEvent({ admissionId: token.admissionId, actorName: token.admission.candidateName, actorType: 'CANDIDATE', action: 'DEPENDENTS_SAVED', ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { count: parsed.data.dependents.length } })
  return NextResponse.json({ success: true })
}
