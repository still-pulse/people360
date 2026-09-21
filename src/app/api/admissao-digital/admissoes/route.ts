import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { analystCanAccessUnit, enforceUnitFilter, forbidIfReadOnly, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { createAdmissionRecord } from '@/lib/admission/service'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'
import { mockAdmissionNotificationProvider } from '@/lib/admission/providers'
import { decryptAdmissionValue, hashSensitive, maskCpf } from '@/lib/admission/security'
import { ADMISSION_DEPARTMENTS, ADMISSION_MONTHLY_HOURS, ADMISSION_SCHEDULES, findPosition } from '@/lib/admission/positions'

const FIELD_LABELS: Record<string, string> = {
  candidateName: 'Nome completo', candidateEmail: 'E-mail', candidatePhone: 'Telefone', unitId: 'Unidade', jobTitle: 'Cargo', department: 'Departamento',
  hireDate: 'Data prevista de admissão', workSchedule: 'Horário', contractType: 'Tipo de contrato', hazardPayPercentage: 'Insalubridade',
  experienceDays: 'Experiência (dias)', validityDays: 'Validade do link', documentTypeIds: 'Documentos necessários',
}

const createSchema = z.object({
  candidateId: z.string().cuid().optional(), vacancyId: z.string().cuid().optional(), unitId: z.string().min(1),
  ownerId: z.string().cuid().optional(), candidateName: z.string().min(3).max(160), candidateEmail: z.string().email().optional().or(z.literal('')),
  candidatePhone: z.string().max(30).optional(), jobTitle: z.string().min(2).max(120), department: z.string().max(120).optional(),
  hireDate: z.coerce.date(), salary: z.coerce.number().nonnegative().optional(), hazardPayPercentage: z.coerce.number().min(0).max(100).optional(),
  workSchedule: z.string().max(120).optional(), breakSchedule: z.string().max(120).optional(), weeklyHours: z.coerce.number().int().min(1).max(80).optional(),
  contractType: z.string().min(2).max(80), experienceDays: z.coerce.number().int().min(0).max(365).optional(),
  contractEndDate: z.coerce.date().optional(), validityDays: z.coerce.number().int().min(1).max(30).default(7),
  documentTypeIds: z.array(z.string().min(1)).max(60).optional(),
})

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  const p = req.nextUrl.searchParams
  const page = Math.max(1, Number(p.get('page') || 1)); const pageSize = Math.min(100, Math.max(10, Number(p.get('pageSize') || 20)))
  const where: Record<string, any> = {}
  enforceUnitFilter(where, session!, p.get('unitId'), 'unitId')
  const search = p.get('search')?.trim()
  if (search) {
    const digits = search.replace(/\D/g, '')
    where.OR = [{ candidateName: { contains: search, mode: 'insensitive' } }, { jobTitle: { contains: search, mode: 'insensitive' } }, { protocol: { contains: search, mode: 'insensitive' } }]
    if (digits.length === 11) where.OR.push({ fields: { some: { key: 'cpf', searchHash: hashSensitive(digits) } } })
  }
  if (p.get('status')) where.status = p.get('status')
  if (p.get('ownerId')) where.ownerId = p.get('ownerId')
  if (p.get('from') || p.get('to')) where.createdAt = { ...(p.get('from') ? { gte: new Date(`${p.get('from')}T00:00:00`) } : {}), ...(p.get('to') ? { lte: new Date(`${p.get('to')}T23:59:59`) } : {}) }
  const allowedSort = ['candidateName', 'createdAt', 'lastActivityAt', 'hireDate', 'status']
  const sort = allowedSort.includes(p.get('sort') || '') ? p.get('sort')! : 'lastActivityAt'
  const direction = p.get('direction') === 'asc' ? 'asc' : 'desc'
  const [total, items] = await prisma.$transaction([
    prisma.admission.count({ where }),
    prisma.admission.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { [sort]: direction }, include: {
      unit: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } },
      documents: { select: { status: true } }, erpnextSyncs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, lastError: true } },
      fields: { where: { key: 'cpf' }, select: { value: true, sensitive: true }, take: 1 },
    } }),
  ])
  const safeItems = items.map(({ fields, ...item }) => ({ ...item, cpfMasked: maskCpf(fields[0] ? String(fields[0].sensitive ? decryptAdmissionValue(fields[0].value) ?? '' : fields[0].value) : '') }))
  return NextResponse.json({ items: safeItems, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } })
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  const actualRole = session!.user.actualRole ?? session!.user.role
  if (!['ADMIN', 'ANALYST'].includes(actualRole)) return NextResponse.json({ error: 'Sem permissão para criar admissões.' }, { status: 403 })
  const forbidden = forbidIfReadOnly(actualRole); if (forbidden) return forbidden
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors
    const names = Object.keys(fields).map((key) => FIELD_LABELS[key] ?? key)
    return NextResponse.json({ error: `Dados inválidos: revise ${names.join(', ')}.`, fields }, { status: 400 })
  }
  // Cargo, departamento, horário, salário e carga horária são definidos pelo RH (não digitados): validados e fixados aqui.
  const position = findPosition(parsed.data.jobTitle)
  if (!position) return NextResponse.json({ error: 'Selecione um cargo válido.' }, { status: 400 })
  if (!ADMISSION_DEPARTMENTS.includes(parsed.data.department ?? '')) return NextResponse.json({ error: 'Selecione um departamento válido.' }, { status: 400 })
  if (!(ADMISSION_SCHEDULES as readonly string[]).includes(parsed.data.workSchedule ?? '')) return NextResponse.json({ error: 'Selecione o horário de trabalho.' }, { status: 400 })
  parsed.data.jobTitle = position.cargo
  parsed.data.department = position.departamento
  parsed.data.salary = position.salario
  parsed.data.weeklyHours = undefined
  const monthlyHours = ADMISSION_MONTHLY_HOURS
  if (!analystCanAccessUnit(session!, parsed.data.unitId)) return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  if (parsed.data.vacancyId) {
    const vacancy = await prisma.vaga.findUnique({ where: { id: parsed.data.vacancyId }, select: { unidadeId: true } })
    if (!vacancy || vacancy.unidadeId !== parsed.data.unitId) return NextResponse.json({ error: 'A vaga selecionada não pertence à unidade informada.' }, { status: 400 })
  }
  if (parsed.data.candidateId) {
    const candidate = await prisma.candidato.findUnique({ where: { id: parsed.data.candidateId }, select: { status: true, vagaId: true, vaga: { select: { unidadeId: true } } } })
    if (!candidate || !['APROVADO', 'AGUARDANDO_ADMISSAO'].includes(candidate.status)) return NextResponse.json({ error: 'Selecione um candidato aprovado.' }, { status: 400 })
    if (candidate.vaga?.unidadeId && candidate.vaga.unidadeId !== parsed.data.unitId) return NextResponse.json({ error: 'O candidato pertence a outra unidade.' }, { status: 400 })
    if (parsed.data.vacancyId && candidate.vagaId && candidate.vagaId !== parsed.data.vacancyId) return NextResponse.json({ error: 'A vaga selecionada não corresponde à vaga do candidato.' }, { status: 400 })
  }
  let created: Awaited<ReturnType<typeof createAdmissionRecord>>
  try { created = await createAdmissionRecord({ ...parsed.data, monthlyHours, candidateEmail: parsed.data.candidateEmail || undefined, createdById: session!.user.id }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível criar a admissão.' }, { status: 400 }) }
  const destination = parsed.data.candidatePhone || parsed.data.candidateEmail
  if (destination) await mockAdmissionNotificationProvider.send({ channel: parsed.data.candidatePhone ? 'whatsapp' : 'email', destination, template: 'admission_invitation' })
  await logAdmissionEvent({ admissionId: created.admission.id, actorId: session!.user.id, actorName: session!.user.name, actorType: 'USER', action: 'ADMISSION_CREATED', ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { protocol: created.admission.protocol } })
  const base = process.env.NEXTAUTH_URL || req.nextUrl.origin
  return NextResponse.json({ admission: created.admission, publicUrl: `${base}/admissao/${created.token}`, expiresAt: created.expiresAt }, { status: 201 })
}
