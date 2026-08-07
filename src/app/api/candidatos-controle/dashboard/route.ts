import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { MONTHS_PT } from '@/types'

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  // Mês/ano solicitado é mês atual?
  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  // Verifica se existe snapshot fechado
  const snapshot = await prisma.candidatosMonthSnapshot.findUnique({
    where: { year_month: { year, month } },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  // Se tem snapshot, retorna dados congelados
  if (snapshot) {
    return NextResponse.json({
      source: 'snapshot',
      snapshot,
      counts: {
        REPROVADO: snapshot.reprovado,
        BANCO_TALENTOS: snapshot.bancoTalentos,
        CONTRATADO: snapshot.contratado,
        DESISTIU: snapshot.desistiu,
        total: snapshot.total,
      },
      isCurrentMonth,
    })
  }

  // Sem snapshot: dados ao vivo do mês
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  const liveWhere: any = { dataProcesso: { gte: start, lt: end } }

  if (session!.user.role === 'ANALYST') {
    const analystUnitIds: string[] = (session!.user as any).unitIds?.length
      ? (session!.user as any).unitIds
      : (session!.user.unitId ? [session!.user.unitId] : [])

    if (analystUnitIds.length > 0) {
      const [byUserUnit, byLegacyUnit] = await Promise.all([
        prisma.userUnit.findMany({ where: { unitId: { in: analystUnitIds } }, select: { userId: true } }),
        prisma.user.findMany({ where: { unitId: { in: analystUnitIds } }, select: { id: true } }),
      ])
      const allowedIds = Array.from(new Set([
        ...byUserUnit.map((u) => u.userId),
        ...byLegacyUnit.map((u) => u.id),
      ]))
      liveWhere.analistas = { some: { id: { in: allowedIds } } }
    } else {
      liveWhere.analistas = { some: { id: session!.user.id } }
    }
  }

  const candidatos = await prisma.controleCandidato.findMany({
    where: liveWhere,
    select: { status: true },
  })

  const counts = {
    REPROVADO: 0,
    BANCO_TALENTOS: 0,
    CONTRATADO: 0,
    DESISTIU: 0,
    total: candidatos.length,
  }
  for (const c of candidatos) {
    counts[c.status as keyof typeof counts]++
  }

  return NextResponse.json({ source: 'live', snapshot: null, counts, isCurrentMonth })
}

// Tendência mensal (últimos 12 meses) — usada para o gráfico
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  // Resolve IDs de analistas permitidos para ANALYST
  let allowedAnalystIds: string[] | null = null
  if (session!.user.role === 'ANALYST') {
    const analystUnitIds: string[] = (session!.user as any).unitIds?.length
      ? (session!.user as any).unitIds
      : (session!.user.unitId ? [session!.user.unitId] : [])

    if (analystUnitIds.length > 0) {
      const [byUserUnit, byLegacyUnit] = await Promise.all([
        prisma.userUnit.findMany({ where: { unitId: { in: analystUnitIds } }, select: { userId: true } }),
        prisma.user.findMany({ where: { unitId: { in: analystUnitIds } }, select: { id: true } }),
      ])
      allowedAnalystIds = Array.from(new Set([
        ...byUserUnit.map((u) => u.userId),
        ...byLegacyUnit.map((u) => u.id),
      ]))
    } else {
      allowedAnalystIds = [session!.user.id]
    }
  }

  // Todos os snapshots do ano

  const snapshots = await prisma.candidatosMonthSnapshot.findMany({
    where: { year },
    orderBy: { month: 'asc' },
  })

  // Para meses sem snapshot, busca dados ao vivo
  const now = new Date()
  const trend = []

  for (let m = 1; m <= 12; m++) {
    if (m > now.getMonth() + 1 && year >= now.getFullYear()) break

    const snap = snapshots.find((s) => s.month === m)
    if (snap) {
      trend.push({
        month: MONTHS_PT[m - 1].slice(0, 3),
        REPROVADO: snap.reprovado,
        BANCO_TALENTOS: snap.bancoTalentos,
        CONTRATADO: snap.contratado,
        DESISTIU: snap.desistiu,
        total: snap.total,
        frozen: true,
      })
    } else {
      const start = new Date(year, m - 1, 1)
      const end = new Date(year, m, 1)
      const liveWhere: any = { dataProcesso: { gte: start, lt: end } }
      if (allowedAnalystIds !== null) liveWhere.analistas = { some: { id: { in: allowedAnalystIds } } }
      const rows = await prisma.controleCandidato.findMany({
        where: liveWhere,
        select: { status: true },
      })
      const c = { REPROVADO: 0, BANCO_TALENTOS: 0, CONTRATADO: 0, DESISTIU: 0 }
      rows.forEach((r) => { c[r.status as keyof typeof c]++ })
      trend.push({
        month: MONTHS_PT[m - 1].slice(0, 3),
        ...c,
        total: rows.length,
        frozen: false,
      })
    }
  }

  return NextResponse.json({ trend })
}
