import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, enforceUnitFilter } from '@/lib/apiHelpers'
import { unitVisibleInIndicators } from '@/lib/utils'

function getLastFriday(date: Date): Date {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const d = date.getUTCDate()
  const utc = new Date(Date.UTC(y, m, d, 12, 0, 0))
  const day = utc.getUTCDay()
  const diff = (day + 2) % 7
  utc.setUTCDate(utc.getUTCDate() - diff)
  return utc
}

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const where: any = { unit: { exibirIndicadores: true } }
  if (searchParams.get('year')) where.year = parseInt(searchParams.get('year')!)
  if (searchParams.get('month')) where.month = parseInt(searchParams.get('month')!)
  enforceUnitFilter(where, session!, searchParams.get('unitId'))

  const data = await prisma.pcdWeeklySnapshot.findMany({
    where,
    include: { unit: true },
    orderBy: [{ weekDate: 'asc' }],
  })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Manual snapshot: { weekDate, entries: [{ unitId, currentPcd }] }
  if (body.weekDate && body.entries) {
    const dateStr = body.weekDate as string
    const weekDate = new Date(dateStr + 'T12:00:00Z')
    const month = weekDate.getUTCMonth() + 1
    const year = weekDate.getUTCFullYear()

    const indicators = await prisma.pCDIndicator.findMany({
      where: { year, month, unit: { exibirIndicadores: true } },
      include: { unit: true },
    })
    const activeIndicators = indicators.filter((i) =>
      unitVisibleInIndicators(i.unit, year, month)
    )

    const entries = body.entries as { unitId: string; currentPcd: number }[]
    const allowedIds = new Set(activeIndicators.map((i) => i.unitId))
    const snapshots = await Promise.all(
      entries
        .filter((entry) => allowedIds.has(entry.unitId))
        .map((entry) => {
          const ind = activeIndicators.find((i) => i.unitId === entry.unitId)
          return prisma.pcdWeeklySnapshot.upsert({
            where: { unitId_weekDate: { unitId: entry.unitId, weekDate } },
            update: { currentPcd: entry.currentPcd },
            create: {
              unitId: entry.unitId,
              year,
              month,
              weekDate,
              totalEmployees: ind?.totalEmployees ?? 0,
              metaPercentage: ind?.metaPercentage ?? 5,
              currentPcd: entry.currentPcd,
            },
            include: { unit: true },
          })
        })
    )
    return NextResponse.json(snapshots, { status: 201 })
  }

  // Auto snapshot: captura dados atuais
  const now = new Date()
  const friday = getLastFriday(now)
  const month = now.getUTCMonth() + 1
  const year = now.getUTCFullYear()

  const indicatorsRaw = await prisma.pCDIndicator.findMany({
    where: { year, month, unit: { exibirIndicadores: true } },
    include: { unit: true },
  })
  const indicators = indicatorsRaw.filter((i) =>
    unitVisibleInIndicators(i.unit, year, month)
  )

  if (indicators.length === 0) {
    return NextResponse.json({ error: 'Nenhum indicador PCD encontrado para o mês atual' }, { status: 404 })
  }

  const snapshots = await Promise.all(
    indicators.map((ind) =>
      prisma.pcdWeeklySnapshot.upsert({
        where: { unitId_weekDate: { unitId: ind.unitId, weekDate: friday } },
        update: {
          totalEmployees: ind.totalEmployees,
          metaPercentage: ind.metaPercentage,
          currentPcd: ind.currentPcd,
          year,
          month,
        },
        create: {
          unitId: ind.unitId,
          year,
          month,
          weekDate: friday,
          totalEmployees: ind.totalEmployees,
          metaPercentage: ind.metaPercentage,
          currentPcd: ind.currentPcd,
        },
        include: { unit: true },
      })
    )
  )

  return NextResponse.json(snapshots, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const weekDateParam = searchParams.get('weekDate')
  if (!weekDateParam) {
    return NextResponse.json({ error: 'weekDate é obrigatório' }, { status: 400 })
  }

  const weekDate = new Date(weekDateParam)
  const start = new Date(weekDate)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(weekDate)
  end.setUTCHours(23, 59, 59, 999)

  const result = await prisma.pcdWeeklySnapshot.deleteMany({
    where: { weekDate: { gte: start, lte: end } },
  })

  return NextResponse.json({ deleted: result.count })
}
