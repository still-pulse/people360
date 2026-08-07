import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateTurnoverRate, formatMonthShort, unitVisibleInIndicators } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAnalyst = session.user.role === 'ANALYST'
  const analystUnitId = session.user.unitId

  // Analista sem unidade → retorna vazio
  if (isAnalyst && !analystUnitId) {
    return NextResponse.json({
      totalEmployees: 0, totalPcd: 0, totalApprentices: 0,
      turnoverRate: 0, absenteeismDays: 0, totalUnits: 0,
      pcdByUnit: [], turnoverTrend: [], headcountByUnit: [], absentByUnit: [], units: [],
    })
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Filtro de unidade — analista vê apenas a sua
  const unitFilter = isAnalyst ? { unitId: analystUnitId! } : {}

  // Unidades visíveis
  const allUnits = await prisma.unit.findMany({ where: { active: true } })
  const visibleUnits = isAnalyst
    ? allUnits.filter((u) => u.id === analystUnitId)
    : allUnits

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: formatMonthShort(d.getFullYear(), d.getMonth() + 1) }
  })

  // Headcount
  const headcountData = await prisma.headcountEntry.groupBy({
    by: ['unitId'],
    where: { year: currentYear, month: currentMonth, ...unitFilter },
    _sum: { count: true },
  })
  const totalEmployees = headcountData.reduce((sum, h) => sum + (h._sum.count ?? 0), 0)

  // PCD (respeita data limite da unidade nos indicadores)
  const pcdDataRaw = await prisma.pCDIndicator.findMany({
    where: { year: currentYear, month: currentMonth, ...unitFilter },
    include: { unit: true },
  })
  const pcdData = pcdDataRaw.filter((p) =>
    unitVisibleInIndicators(p.unit, currentYear, currentMonth)
  )
  const totalPcd = pcdData.reduce((sum, p) => sum + p.currentPcd, 0)

  // Aprendizes
  const apprenticeData = await prisma.apprenticeIndicator.findMany({
    where: { year: currentYear, month: currentMonth, ...unitFilter },
    include: { unit: true },
  })
  const totalApprentices = apprenticeData.reduce((sum, a) => sum + a.currentCount, 0)

  // Turnover
  const turnoverData = await prisma.turnoverIndicator.findMany({
    where: { year: currentYear, month: currentMonth, ...unitFilter },
  })
  const turnoverRate = calculateTurnoverRate(
    turnoverData.reduce((s, t) => s + t.admissions, 0),
    turnoverData.reduce((s, t) => s + t.dismissals, 0),
    turnoverData.reduce((s, t) => s + t.headcountStart, 0),
    turnoverData.reduce((s, t) => s + t.headcountEnd, 0),
  )

  // Absenteísmo
  const absentData = await prisma.absenteeismIndicator.findMany({
    where: { year: currentYear, month: currentMonth, ...unitFilter },
  })
  const absenteeismDays = absentData.reduce((sum, a) => sum + a.totalDaysLost, 0)

  // PCD por unidade (apenas unidades visíveis)
  const pcdByUnit = pcdData.map((p) => ({
    unitName: p.unit.name,
    color: p.unit.color,
    current: p.currentPcd,
    required: Math.floor((p.totalEmployees * p.metaPercentage) / 100),
    totalEmployees: p.totalEmployees,
    metaPercentage: p.metaPercentage,
  }))

  // Turnover trend (últimos 6 meses, apenas unidades visíveis)
  const turnoverTrend = await Promise.all(
    months.map(async ({ year, month, label }) => {
      const data = await prisma.turnoverIndicator.findMany({
        where: { year, month, ...unitFilter },
        include: { unit: true },
      })
      const entry: Record<string, number | string> = { month: label }
      for (const d of data) {
        entry[d.unit.name] = parseFloat(
          calculateTurnoverRate(d.admissions, d.dismissals, d.headcountStart, d.headcountEnd).toFixed(1)
        )
      }
      return entry
    })
  )

  // Headcount por unidade (pizza — apenas unidades visíveis)
  const hcByUnit = await prisma.headcountEntry.groupBy({
    by: ['unitId'],
    where: { year: currentYear, month: currentMonth, ...unitFilter },
    _sum: { count: true },
  })
  const headcountByUnit = hcByUnit.map((h) => {
    const unit = visibleUnits.find((u) => u.id === h.unitId)
    return { name: unit?.name ?? '—', value: h._sum.count ?? 0, color: unit?.color ?? '#6B7280' }
  })

  // Absenteísmo por unidade (últimos 3 meses — apenas unidades visíveis)
  const absentByUnit = await Promise.all(
    months.slice(-3).map(async ({ year, month, label }) => {
      const data = await prisma.absenteeismIndicator.findMany({
        where: { year, month, ...unitFilter },
        include: { unit: true },
      })
      const entry: Record<string, number | string> = { month: label }
      for (const d of data) {
        entry[d.unit.name] = d.totalDaysLost
      }
      return entry
    })
  )

  return NextResponse.json({
    totalEmployees: totalEmployees || pcdData.reduce((s, p) => s + p.totalEmployees, 0),
    totalPcd,
    totalApprentices,
    turnoverRate: parseFloat(turnoverRate.toFixed(1)),
    absenteeismDays,
    totalUnits: visibleUnits.length,
    pcdByUnit,
    turnoverTrend,
    headcountByUnit,
    absentByUnit,
    units: visibleUnits.map((u) => ({ id: u.id, name: u.name, color: u.color })),
  })
}
