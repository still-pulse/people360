import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAdmissionByPublicToken, getMutableAdmissionByPublicToken } from '@/lib/admission/service'
import { checkPublicDocLinkRateLimit } from '@/lib/rateLimit'
import { extractIp } from '@/lib/audit'
import { decryptAdmissionValue, encryptAdmissionValue, hashSensitive, isValidCpf } from '@/lib/admission/security'
import { PUBLIC_FIELD_SECTIONS, SENSITIVE_FIELD_KEYS } from '@/lib/admission/constants'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { isFaceVerificationEnabled } from '@/lib/admission/features'

const saveSchema = z.object({ section: z.enum(['personal', 'address', 'bank']), fields: z.record(z.union([z.string().max(500), z.boolean(), z.number(), z.null()])), nextStep: z.string().max(40).optional(), validate: z.boolean().optional().default(false) })

function limited(req: NextRequest, token: string) { return checkPublicDocLinkRateLimit(`${extractIp(req.headers) || 'unknown'}:${token.slice(-8)}`) }

export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  if (!limited(req, params.token).allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 })
  const result = await getAdmissionByPublicToken(params.token, true)
  if (!result) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  const a = result.admission
  const faceVerificationEnabled = isFaceVerificationEnabled()
  const requiredPending = a.documents.some((document) => document.type.required && document.status !== 'APPROVED')
  const resumeStep = a.processType === 'REGISTRATION_UPDATE' ? (a.status === 'DOCUMENTS_UNDER_REVIEW' || a.status === 'COMPLETED' || (!faceVerificationEnabled && (a.status === 'FACE_VALIDATION_PENDING' || a.currentStep === 'validacao-facial')) ? 'conclusao' : (a.currentStep || 'inicio'))
    : a.signatureEnvelopes.some((envelope) => envelope.status === 'SIGNED') ? 'conclusao'
    : a.generatedDocuments.length ? 'assinatura'
    : faceVerificationEnabled && a.faceVerifications[0]?.status === 'APPROVED' ? 'revisao'
    : a.badgePhotos[0]?.confirmedAt ? (requiredPending ? 'foto' : faceVerificationEnabled ? 'validacao-facial' : 'revisao')
    : ['presentation', 'inicio'].includes(a.currentStep) ? 'inicio' : a.currentStep
  await logAdmissionEvent({ admissionId: a.id, actorName: a.candidateName, actorType: 'CANDIDATE', action: 'LINK_OPENED', ip: extractIp(req.headers), userAgent: req.headers.get('user-agent') }).catch(() => {})
  return NextResponse.json({
    protocol: a.protocol, candidateName: a.candidateName, status: a.status, currentStep: a.currentStep, resumeStep, progress: a.progress, processType: a.processType, requestedSections: a.requestedSections,
    features: { faceVerification: faceVerificationEnabled },
    locked: { jobTitle: a.jobTitle, department: a.department, unit: a.unit.name, hireDate: a.hireDate, contractType: a.contractType, workSchedule: a.workSchedule },
    fields: Object.fromEntries(a.fields.map((f) => [f.key, f.sensitive ? decryptAdmissionValue(f.value) : f.value])), dependents: a.dependents, transport: a.transport,
    documents: a.documents.map((d) => ({ id: d.id, status: d.status, rejectionReason: d.rejectionReason, version: d.version, uploadedAt: d.uploadedAt, type: { key: d.type.key, name: d.type.name, description: d.type.description, required: d.type.required, maxSizeBytes: d.type.maxSizeBytes, maxFiles: d.type.maxFiles } })),
    badgePhoto: a.badgePhotos[0]?.confirmedAt ? { confirmedAt: a.badgePhotos[0].confirmedAt } : null,
    faceVerification: a.faceVerifications[0] ? { status: a.faceVerifications[0].status, attempts: a.faceVerifications[0].attempts } : null,
    generatedDocuments: a.generatedDocuments.map((d) => ({ id: d.id, name: d.template.name, status: d.status, version: d.templateVersion })),
    signatures: a.signatureEnvelopes.map((e) => ({ id: e.id, status: e.status, signedAt: e.signedAt })), expiresAt: result.expiresAt,
  })
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  if (!limited(req, params.token).allowed) return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })
  const result = await getMutableAdmissionByPublicToken(params.token)
  if (!result) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  const body = await req.json().catch(() => null)
  if (body?.completeUpdate === true && result.admission.processType === 'REGISTRATION_UPDATE') {
    const missingDocuments = result.admission.documents.filter((document) => !document.uploadedAt)
    if (missingDocuments.length) return NextResponse.json({ error: `Envie os ${missingDocuments.length} documento(s) solicitado(s) antes de concluir.` }, { status: 400 })
    await prisma.admission.update({ where: { id: result.admissionId }, data: { status: 'DOCUMENTS_UNDER_REVIEW', currentStep: 'conclusao', progress: 100, lastActivityAt: new Date() } })
    await logAdmissionEvent({ admissionId: result.admissionId, actorName: result.admission.candidateName, actorType: 'CANDIDATE', action: 'REGISTRATION_UPDATE_SUBMITTED', ip: extractIp(req.headers), userAgent: req.headers.get('user-agent') })
    return NextResponse.json({ success: true })
  }
  const parsed = saveSchema.safeParse(body);if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.', fields: parsed.error.flatten().fieldErrors }, { status: 400 })
  const allowed = new Set<string>(PUBLIC_FIELD_SECTIONS[parsed.data.section])
  const entries = Object.entries(parsed.data.fields).filter(([key]) => allowed.has(key))
  const cpf = parsed.data.fields.cpf
  if (parsed.data.validate && parsed.data.section === 'personal' && !String(parsed.data.fields.gender || '').trim()) {
    return NextResponse.json({ error: 'Selecione o gênero.', fields: { gender: ['Selecione o gênero.'] } }, { status: 400 })
  }
  if (parsed.data.validate && parsed.data.section === 'personal' && (typeof cpf !== 'string' || !cpf.trim())) {
    return NextResponse.json({ error: 'Informe o CPF.', fields: { cpf: ['Informe o CPF.'] } }, { status: 400 })
  }
  if (parsed.data.validate && typeof cpf === 'string' && cpf.trim() && !isValidCpf(cpf)) return NextResponse.json({ error: 'CPF inválido.', fields: { cpf: ['Informe um CPF válido.'] } }, { status: 400 })
  if (parsed.data.validate && parsed.data.fields.disability === 'Sim' && !String(parsed.data.fields.disabilityDetails || '').trim()) {
    return NextResponse.json({ error: 'Especifique a deficiência.', fields: { disabilityDetails: ['Especifique a deficiência.'] } }, { status: 400 })
  }
  await prisma.$transaction([
    ...entries.map(([key, value]) => { const sensitive = SENSITIVE_FIELD_KEYS.has(key); const stored = sensitive ? encryptAdmissionValue(value) : value; const searchHash = key === 'cpf' && typeof value === 'string' && value.replace(/\D/g, '').length === 11 ? hashSensitive(value) : null; return prisma.admissionField.upsert({ where: { admissionId_key: { admissionId: result.admissionId, key } }, create: { admissionId: result.admissionId, section: parsed.data.section, key, value: stored as Prisma.InputJsonValue, sensitive, searchHash }, update: { section: parsed.data.section, value: stored as Prisma.InputJsonValue, sensitive, searchHash } }) }),
    prisma.admission.update({ where: { id: result.admissionId }, data: { status: result.admission.status === 'LINK_SENT' ? 'IN_PROGRESS' : undefined, currentStep: parsed.data.nextStep || result.admission.currentStep, progress: Math.max(result.admission.progress, parsed.data.section === 'personal' ? 18 : parsed.data.section === 'address' ? 24 : 28), lastActivityAt: new Date() } }),
  ])
  await logAdmissionEvent({ admissionId: result.admissionId, actorName: result.admission.candidateName, actorType: 'CANDIDATE', action: 'AUTOSAVE', ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { section: parsed.data.section, fieldCount: entries.length } })
  return NextResponse.json({ success: true, savedAt: new Date() })
}
