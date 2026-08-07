import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { log, extractIp } from '@/lib/audit'
import { MONTHS_PT } from '@/types'

// Lista todos os snapshots fechados
export async function GET(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized()
  if (error) return error

  const snapshots = await prisma.candidatosMonthSnapshot.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { createdBy: { select: { id: true, name: true } } },
  })
  return NextResponse.json(snapshots)
}

// Fecha (salva snapshot de) um mês
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas admins podem fechar o mês.' }, { status: 403 })
  }

  const body = await req.json()
  const year: number = body.year ?? new Date().getFullYear()
  const month: number = body.month ?? new Date().getMonth() + 1

  const existing = await prisma.candidatosMonthSnapshot.findUnique({
    where: { year_month: { year, month } },
  })
  if (existing) {
    return NextResponse.json(
      { error: `O mês ${MONTHS_PT[month - 1]}/${year} já foi fechado.` },
      { status: 409 }
    )
  }

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  const candidatos = await prisma.controleCandidato.findMany({
    where: { dataProcesso: { gte: start, lt: end } },
    select: { status: true },
  })

  const counts = { reprovado: 0, bancoTalentos: 0, contratado: 0, desistiu: 0 }
  for (const c of candidatos) {
    if (c.status === 'REPROVADO') counts.reprovado++
    else if (c.status === 'BANCO_TALENTOS') counts.bancoTalentos++
    else if (c.status === 'CONTRATADO') counts.contratado++
    else if (c.status === 'DESISTIU') counts.desistiu++
  }

  const snapshot = await prisma.candidatosMonthSnapshot.create({
    data: {
      year,
      month,
      ...counts,
      total: candidatos.length,
      createdById: session!.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'CREATE', entity: 'CandidatosSnapshot',
    entityId: snapshot.id,
    entityName: `${MONTHS_PT[month - 1]}/${year}`,
    details: counts,
    ip: extractIp(req.headers),
  })

  return NextResponse.json(snapshot, { status: 201 })
}

// Reabre um mês (deleta snapshot) — admin only
export async function DELETE(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas admins podem reabrir o mês.' }, { status: 403 })
  }

  const { year, month } = await req.json()
  const existing = await prisma.candidatosMonthSnapshot.findUnique({
    where: { year_month: { year, month } },
  })
  if (!existing) return NextResponse.json({ error: 'Snapshot não encontrado.' }, { status: 404 })

  await prisma.candidatosMonthSnapshot.delete({ where: { id: existing.id } })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'DELETE', entity: 'CandidatosSnapshot', entityId: existing.id,
    entityName: `${MONTHS_PT[month - 1]}/${year}`,
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ ok: true })
}
