import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateTurnoverRate, formatMonthShort, unitVisibleInIndicators } from '@/lib/utils'
import { trainingApiConfigured, fetchTrainingSummary } from '@/lib/trainingApi'

type Period = 'current_month' | 'last_3' | 'last_6' | 'last_12' | 'current_year'

function buildMonthRange(period: Period) {
  const now = new Date()
  const cy = now.getFullYear()
  const cm = now.getMonth() + 1

  const makeList = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(cy, cm - 1 - (n - 1 - i), 1)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    })

  if (period === 'current_month') return makeList(1)
  if (period === 'last_3') return makeList(3)
  if (period === 'last_6') return makeList(6)
  if (period === 'last_12') return makeList(12)
  return Array.from({ length: cm }, (_, i) => ({ year: cy, month: i + 1 }))
}

function buildPrevRange(months: { year: number; month: number }[]) {
  const n = months.length
  const first = months[0]
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(first.year, first.month - 1 - n + i, 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
}

function last6SparkMonths() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: formatMonthShort(d.getFullYear(), d.getMonth() + 1) }
  })
}

function last12TrendMonths() {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: formatMonthShort(d.getFullYear(), d.getMonth() + 1) }
  })
}

function orMonths(months: { year: number; month: number }[]) {
  return months.map(m => ({ year: m.year, month: m.month }))
}

function sumTurnover(data: { admissions: number; dismissals: number; headcountStart: number; headcountEnd: number }[]) {
  return {
    adm: data.reduce((s, t) => s + t.admissions, 0),
    dis: data.reduce((s, t) => s + t.dismissals, 0),
    hcs: data.reduce((s, t) => s + t.headcountStart, 0),
    hce: data.reduce((s, t) => s + t.headcountEnd, 0),
  }
}

function calcAbsRate(data: { totalDaysLost: number; totalEmployees: number; workingDaysInMonth: number }[]) {
  const days = data.reduce((s, a) => s + a.totalDaysLost, 0)
  const empDays = data.reduce((s, a) => s + a.totalEmployees * a.workingDaysInMonth, 0)
  return empDays > 0 ? parseFloat(((days / empDays) * 100).toFixed(1)) : 0
}

function zeroSparkline(labels: { label: string }[]) {
  return labels.map(m => ({ month: m.label, value: 0 }))
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = (searchParams.get('period') ?? 'current_month') as Period
  const unitIdParam = searchParams.get('unitId')

  const isAnalyst = session.user.role === 'ANALYST'
  const analystUnitIds: string[] = (session.user as any).unitIds?.length
    ? (session.user as any).unitIds
    : (session.user.unitId ? [session.user.unitId] : [])

  if (isAnalyst && analystUnitIds.length === 0) return NextResponse.json(emptyResponse())

  // Para analistas: respeita filtro de unitId quando dentro das unidades permitidas
  const analystEffectiveId = isAnalyst && unitIdParam && analystUnitIds.includes(unitIdParam)
    ? unitIdParam : null

  const unitFilter = isAnalyst
    ? analystEffectiveId
      ? { unitId: analystEffectiveId }
      : analystUnitIds.length === 1
        ? { unitId: analystUnitIds[0] }
        : { unitId: { in: analystUnitIds } }
    : unitIdParam ? { unitId: unitIdParam } : {}

  const vagaUnitFilter = isAnalyst
    ? analystEffectiveId
      ? { unidadeId: analystEffectiveId }
      : analystUnitIds.length === 1
        ? { unidadeId: analystUnitIds[0] }
        : { unidadeId: { in: analystUnitIds } }
    : unitIdParam ? { unidadeId: unitIdParam } : {}

  const months = buildMonthRange(period)
  const prevMonths = buildPrevRange(months)
  const sparkMonths = last6SparkMonths()
  const trend12 = last12TrendMonths()

  const latestMonth = months[months.length - 1]
  const prevPeriodLast = prevMonths[prevMonths.length - 1]
  const previousLabel = formatMonthShort(prevPeriodLast.year, prevPeriodLast.month)

  const prevSingleMonth = (() => {
    const d = new Date(latestMonth.year, latestMonth.month - 2, 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })()

  // ─── Headcount (fonte: Colaboradores Active do ERPNext; fallback: headcountEntry) ──
  const units = await prisma.unit.findMany({ where: { active: true } })

  // Filtro unitId no espelho Employee (mesma forma do unitFilter de indicadores)
  const colabUnitFilter: Record<string, unknown> = {}
  if ('unitId' in unitFilter) {
    colabUnitFilter.unitId = (unitFilter as { unitId: unknown }).unitId
  }

  const colabActiveBase = { status: 'Active' as const, ...colabUnitFilter }

  const [colabActiveCount, colabAprendizCount, colabByUnit, colabPcdCount, hcPrevious, hcLegacyCurrent] =
    await Promise.all([
      prisma.colaborador.count({ where: colabActiveBase }),
      prisma.colaborador.count({
        where: {
          ...colabActiveBase,
          OR: [
            { designation: { contains: 'APRENDIZ', mode: 'insensitive' } },
            { employmentType: { contains: 'Aprendiz', mode: 'insensitive' } },
            { employmentType: { contains: 'Apprentice', mode: 'insensitive' } },
          ],
        },
      }),
      prisma.colaborador.groupBy({
        by: ['unitId'],
        where: colabActiveBase,
        _count: { _all: true },
      }),
      prisma.colaborador.count({ where: { ...colabActiveBase, pcd: true } }),
      prisma.headcountEntry.groupBy({
        by: ['unitId'],
        where: { year: prevSingleMonth.year, month: prevSingleMonth.month, ...unitFilter },
        _sum: { count: true },
      }),
      prisma.headcountEntry.groupBy({
        by: ['unitId'],
        where: { year: latestMonth.year, month: latestMonth.month, ...unitFilter },
        _sum: { count: true },
      }),
    ])

  // Preferir contagem real do ERPNext; se sync vazio, cai no headcount manual
  const legacyHeadcount = hcLegacyCurrent.reduce((s, h) => s + (h._sum.count ?? 0), 0)
  const headcountCurrent = colabActiveCount > 0 ? colabActiveCount : legacyHeadcount
  const headcountPrevious = hcPrevious.reduce((s, h) => s + (h._sum.count ?? 0), 0)
  const headcountChange = headcountPrevious > 0
    ? parseFloat(((headcountCurrent - headcountPrevious) / headcountPrevious * 100).toFixed(1))
    : 0

  const headcountSparkline = await Promise.all(
    sparkMonths.map(async ({ year, month, label }, idx, arr) => {
      // Último ponto do sparkline = contagem real atual (ERPNext)
      if (idx === arr.length - 1 && colabActiveCount > 0) {
        return { month: label, value: colabActiveCount }
      }
      const d = await prisma.headcountEntry.groupBy({
        by: ['unitId'],
        where: { year, month, ...unitFilter },
        _sum: { count: true },
      })
      return { month: label, value: d.reduce((s, h) => s + (h._sum.count ?? 0), 0) }
    })
  )

  // ─── PCD + Aprendizes + Unidades (resumo topo) ────────────────────────────
  const pcdDataRaw = await prisma.pCDIndicator.findMany({
    where: { year: latestMonth.year, month: latestMonth.month, ...unitFilter },
    include: { unit: true },
  })
  const pcdData = pcdDataRaw.filter((p) =>
    unitVisibleInIndicators(p.unit, latestMonth.year, latestMonth.month)
  )
  // PCD: indicador mensal (fonte oficial do módulo PCD); se vazio, fallback cadastro ERPNext
  const totalPcdFromIndicator = pcdData.reduce((s, p) => s + p.currentPcd, 0)
  const totalPcd = totalPcdFromIndicator > 0 ? totalPcdFromIndicator : colabPcdCount
  // Aprendizes: cargo/tipo no Employee (JOVEM APRENDIZ etc.); se zero, mantém 0 (não usar planilha desatualizada)
  const totalAprendizes = colabAprendizCount
  const totalUnidades = isAnalyst
    ? (analystEffectiveId ? 1 : analystUnitIds.length)
    : (unitIdParam ? 1 : units.length)

  // Distribuição por unidade a partir do cadastro real de colaboradores
  const totalHcArea = headcountCurrent
  const collaboratorsByArea = (colabActiveCount > 0
    ? colabByUnit.map((h) => {
        const unit = units.find((u) => u.id === h.unitId)
        const value = h._count._all
        // unitId null → "Sem unidade mapeada"
        return {
          label: unit?.name ?? (h.unitId ? '—' : 'Sem unidade mapeada'),
          value,
          color: unit?.color ?? '#94A3B8',
          percentage: totalHcArea > 0 ? parseFloat(((value / totalHcArea) * 100).toFixed(1)) : 0,
        }
      })
    : hcLegacyCurrent.map((h) => {
        const unit = units.find((u) => u.id === h.unitId)
        const value = h._sum.count ?? 0
        return {
          label: unit?.name ?? '—',
          value,
          color: unit?.color ?? '#15AFA4',
          percentage: totalHcArea > 0 ? parseFloat(((value / totalHcArea) * 100).toFixed(1)) : 0,
        }
      })
  ).sort((a, b) => b.value - a.value)

  // ─── Turnover ──────────────────────────────────────────────────────────────
  const [turnoverCur, turnoverPrev] = await Promise.all([
    prisma.turnoverIndicator.findMany({ where: { ...unitFilter, OR: orMonths(months) } }),
    prisma.turnoverIndicator.findMany({ where: { ...unitFilter, OR: orMonths(prevMonths) } }),
  ])

  const tcur = sumTurnover(turnoverCur)
  const tprev = sumTurnover(turnoverPrev)
  const turnoverRate = parseFloat(calculateTurnoverRate(tcur.adm, tcur.dis, tcur.hcs, tcur.hce).toFixed(1))
  const turnoverRatePrev = parseFloat(calculateTurnoverRate(tprev.adm, tprev.dis, tprev.hcs, tprev.hce).toFixed(1))
  const turnoverChange = parseFloat((turnoverRate - turnoverRatePrev).toFixed(1))

  const turnoverSparkline = await Promise.all(
    sparkMonths.map(async ({ year, month, label }) => {
      const d = await prisma.turnoverIndicator.findMany({ where: { year, month, ...unitFilter } })
      const s = sumTurnover(d)
      return { month: label, value: parseFloat(calculateTurnoverRate(s.adm, s.dis, s.hcs, s.hce).toFixed(1)) }
    })
  )

  const turnoverLast12 = await Promise.all(
    trend12.map(async ({ year, month, label }) => {
      const d = await prisma.turnoverIndicator.findMany({ where: { year, month, ...unitFilter } })
      const s = sumTurnover(d)
      return { month: label, value: parseFloat(calculateTurnoverRate(s.adm, s.dis, s.hcs, s.hce).toFixed(1)) }
    })
  )

  // ─── Absenteeism ───────────────────────────────────────────────────────────
  const [absCur, absPrev] = await Promise.all([
    prisma.absenteeismIndicator.findMany({ where: { ...unitFilter, OR: orMonths(months) } }),
    prisma.absenteeismIndicator.findMany({ where: { ...unitFilter, OR: orMonths(prevMonths) } }),
  ])

  const absRate = calcAbsRate(absCur)
  const absRatePrev = calcAbsRate(absPrev)
  const absChange = parseFloat((absRate - absRatePrev).toFixed(1))

  const absSparkline = await Promise.all(
    sparkMonths.map(async ({ year, month, label }) => {
      const d = await prisma.absenteeismIndicator.findMany({ where: { year, month, ...unitFilter } })
      return { month: label, value: calcAbsRate(d) }
    })
  )

  // ─── Engagement ────────────────────────────────────────────────────────────
  const [engCur, engPrev] = await Promise.all([
    prisma.engagementIndicator.findMany({ where: { ...unitFilter, OR: orMonths(months) } }),
    prisma.engagementIndicator.findMany({ where: { ...unitFilter, OR: orMonths(prevMonths) } }),
  ])

  const calcEngRate = (data: { rate: number; totalEmployees: number }[]) => {
    const totalEmp = data.reduce((s, e) => s + e.totalEmployees, 0)
    if (totalEmp === 0) return data.length > 0 ? parseFloat((data.reduce((s, e) => s + e.rate, 0) / data.length).toFixed(1)) : 0
    return parseFloat((data.reduce((s, e) => s + e.rate * e.totalEmployees, 0) / totalEmp).toFixed(1))
  }

  const engRate = calcEngRate(engCur)
  const engRatePrev = calcEngRate(engPrev)
  const engChange = parseFloat((engRate - engRatePrev).toFixed(1))

  const engSparkline = await Promise.all(
    sparkMonths.map(async ({ year, month, label }) => {
      const d = await prisma.engagementIndicator.findMany({ where: { year, month, ...unitFilter } })
      return { month: label, value: calcEngRate(d) }
    })
  )

  // ─── NPS ───────────────────────────────────────────────────────────────────
  const [npsCur, npsPrev] = await Promise.all([
    prisma.npsIndicator.findMany({ where: { ...unitFilter, OR: orMonths(months) } }),
    prisma.npsIndicator.findMany({ where: { ...unitFilter, OR: orMonths(prevMonths) } }),
  ])

  const calcNpsValue = (data: { promoters: number; detractors: number; totalRespondents: number }[]) => {
    const totalResp = data.reduce((s, n) => s + n.totalRespondents, 0)
    if (totalResp === 0) return 0
    const p = data.reduce((s, n) => s + n.promoters, 0)
    const d = data.reduce((s, n) => s + n.detractors, 0)
    return Math.round(((p - d) / totalResp) * 100)
  }

  const npsValue = calcNpsValue(npsCur)
  const npsValuePrev = calcNpsValue(npsPrev)
  const npsChange = npsValue - npsValuePrev

  const npsSparkline = await Promise.all(
    sparkMonths.map(async ({ year, month, label }) => {
      const d = await prisma.npsIndicator.findMany({ where: { year, month, ...unitFilter } })
      return { month: label, value: calcNpsValue(d) }
    })
  )

  // ─── Cost Per Employee (Payroll) ────────────────────────────────────────────
  const [payrollCur, payrollPrev] = await Promise.all([
    prisma.payrollIndicator.findMany({ where: { ...unitFilter, OR: orMonths(months) } }),
    prisma.payrollIndicator.findMany({ where: { ...unitFilter, OR: orMonths(prevMonths) } }),
  ])

  const calcCostPerEmp = (data: { totalPayroll: number; totalEmployees: number }[]) => {
    const totalEmp = data.reduce((s, p) => s + p.totalEmployees, 0)
    if (totalEmp === 0) return 0
    return Math.round(data.reduce((s, p) => s + p.totalPayroll, 0) / totalEmp)
  }

  const costPerEmpValue = calcCostPerEmp(payrollCur)
  const costPerEmpPrev = calcCostPerEmp(payrollPrev)
  const costPerEmpChange = parseFloat((costPerEmpPrev > 0 ? ((costPerEmpValue - costPerEmpPrev) / costPerEmpPrev * 100) : 0).toFixed(1))

  const costPerEmpSparkline = await Promise.all(
    sparkMonths.map(async ({ year, month, label }) => {
      const d = await prisma.payrollIndicator.findMany({ where: { year, month, ...unitFilter } })
      return { month: label, value: calcCostPerEmp(d) }
    })
  )

  // ─── Hiring Cost ────────────────────────────────────────────────────────────
  const [hiringCur, hiringPrev] = await Promise.all([
    prisma.hiringCostIndicator.findMany({ where: { ...unitFilter, OR: orMonths(months) } }),
    prisma.hiringCostIndicator.findMany({ where: { ...unitFilter, OR: orMonths(prevMonths) } }),
  ])

  const calcHiringCost = (data: { totalCost: number; totalHires: number }[]) => {
    const totalH = data.reduce((s, h) => s + h.totalHires, 0)
    if (totalH === 0) return 0
    return Math.round(data.reduce((s, h) => s + h.totalCost, 0) / totalH)
  }

  const hiringCostValue = calcHiringCost(hiringCur)
  const hiringCostPrev = calcHiringCost(hiringPrev)
  const hiringCostChange = parseFloat((hiringCostPrev > 0 ? ((hiringCostValue - hiringCostPrev) / hiringCostPrev * 100) : 0).toFixed(1))

  const hiringCostTrend = await Promise.all(
    sparkMonths.map(async ({ year, month, label }) => {
      const d = await prisma.hiringCostIndicator.findMany({ where: { year, month, ...unitFilter } })
      return { month: label, value: calcHiringCost(d) }
    })
  )

  // ─── Tenure Distribution ───────────────────────────────────────────────────
  const tenureLatest = await prisma.tenureDistributionIndicator.findMany({
    where: { year: latestMonth.year, month: latestMonth.month, ...unitFilter },
  })

  const tenureTotals = tenureLatest.reduce(
    (acc, t) => ({
      ate1ano: acc.ate1ano + t.ate1ano,
      de1a3: acc.de1a3 + t.de1a3,
      de3a5: acc.de3a5 + t.de3a5,
      de5a10: acc.de5a10 + t.de5a10,
      acima10: acc.acima10 + t.acima10,
    }),
    { ate1ano: 0, de1a3: 0, de3a5: 0, de5a10: 0, acima10: 0 }
  )
  const tenureTotal = Object.values(tenureTotals).reduce((a, b) => a + b, 0)
  const distributionByTenure = tenureTotal > 0
    ? [
        { label: 'Até 1 ano', value: tenureTotals.ate1ano, percentage: parseFloat(((tenureTotals.ate1ano / tenureTotal) * 100).toFixed(1)) },
        { label: '1 a 3 anos', value: tenureTotals.de1a3, percentage: parseFloat(((tenureTotals.de1a3 / tenureTotal) * 100).toFixed(1)) },
        { label: '3 a 5 anos', value: tenureTotals.de3a5, percentage: parseFloat(((tenureTotals.de3a5 / tenureTotal) * 100).toFixed(1)) },
        { label: '5 a 10 anos', value: tenureTotals.de5a10, percentage: parseFloat(((tenureTotals.de5a10 / tenureTotal) * 100).toFixed(1)) },
        { label: 'Acima de 10', value: tenureTotals.acima10, percentage: parseFloat(((tenureTotals.acima10 / tenureTotal) * 100).toFixed(1)) },
      ]
    : []

  // ─── Training ──────────────────────────────────────────────────────────────
  const calcTrainingLocal = (data: { totalHours: number; totalParticipants: number; totalEmployees: number }[]) => {
    const totalH = data.reduce((s, t) => s + t.totalHours, 0)
    const totalP = data.reduce((s, t) => s + t.totalParticipants, 0)
    const totalE = data.reduce((s, t) => s + t.totalEmployees, 0)
    return {
      totalHours: parseFloat(totalH.toFixed(1)),
      avgHoursPerEmployee: totalE > 0 ? parseFloat((totalH / totalE).toFixed(1)) : 0,
      participationRate: totalE > 0 ? parseFloat(((totalP / totalE) * 100).toFixed(1)) : 0,
    }
  }

  let trainingStats     = { totalHours: 0, avgHoursPerEmployee: 0, participationRate: 0 }
  let trainingStatsPrev = { totalHours: 0, avgHoursPerEmployee: 0, participationRate: 0 }

  if (trainingApiConfigured()) {
    const now = new Date()
    const curAno  = now.getFullYear()
    const prevAno = curAno - 1
    // Sem mes = resumo anual (igual à página de treinamentos)
    const [extCur, extPrev] = await Promise.all([
      fetchTrainingSummary(curAno),
      fetchTrainingSummary(prevAno),
    ])
    const aggregateTraining = (data: any) => {
      const units: any[] = data?.porUnidade?.length ? data.porUnidade
        : (data?.registros?.length ? data.registros : [])
      if (units.length === 0) return null
      const totalHoras = units.reduce((s: number, u: any) => s + (u.totalHoras ?? 0), 0)
      const totalColab = units.reduce((s: number, u: any) => s + (u.colaboradores ?? 0), 0)
      const totalPart  = units.reduce((s: number, u: any) => s + (u.participantes ?? 0), 0)
      // Se colaboradores não veio da API, usa média ponderada dos campos pré-computados
      const avgHrs = totalColab > 0
        ? totalHoras / totalColab
        : totalHoras > 0
          ? units.reduce((s: number, u: any) => s + (u.mediaPorColaborador ?? 0) * (u.totalHoras ?? 0), 0) / totalHoras
          : 0
      const partRate = totalColab > 0
        ? (totalPart / totalColab) * 100
        : totalHoras > 0
          ? units.reduce((s: number, u: any) => s + (u.taxaParticipacao ?? 0) * (u.totalHoras ?? 0), 0) / totalHoras
          : 0
      return {
        totalHours: parseFloat(totalHoras.toFixed(1)),
        avgHoursPerEmployee: parseFloat(avgHrs.toFixed(1)),
        participationRate: parseFloat(partRate.toFixed(1)),
      }
    }

    const aggCur  = aggregateTraining(extCur)
    const aggPrev = aggregateTraining(extPrev)
    if (aggCur)  trainingStats     = aggCur
    if (aggPrev) trainingStatsPrev = aggPrev
  } else {
    const [trainingCur, trainingPrev] = await Promise.all([
      prisma.trainingIndicator.findMany({ where: { ...unitFilter, OR: orMonths(months) } }),
      prisma.trainingIndicator.findMany({ where: { ...unitFilter, OR: orMonths(prevMonths) } }),
    ])
    trainingStats     = calcTrainingLocal(trainingCur)
    trainingStatsPrev = calcTrainingLocal(trainingPrev)
  }

  const trainingHrsChange = trainingStatsPrev.totalHours > 0
    ? parseFloat(((trainingStats.totalHours - trainingStatsPrev.totalHours) / trainingStatsPrev.totalHours * 100).toFixed(1))
    : 0
  const trainingAvgChange  = parseFloat((trainingStats.avgHoursPerEmployee - trainingStatsPrev.avgHoursPerEmployee).toFixed(1))
  const trainingRateChange = parseFloat((trainingStats.participationRate - trainingStatsPrev.participationRate).toFixed(1))

  // ─── Vacancy Closing Time ─────────────────────────────────────────────────
  const firstDayOfPeriod = new Date(months[0].year, months[0].month - 1, 1)
  const lastDayOfPeriod = new Date(latestMonth.year, latestMonth.month, 0, 23, 59, 59)

  const closedVagas = await prisma.vaga.findMany({
    where: {
      ...vagaUnitFilter,
      status: { in: ['CONTRATADA', 'FECHADA'] },
      dataFechamento: { gte: firstDayOfPeriod, lte: lastDayOfPeriod },
    },
    select: { dataAbertura: true, dataFechamento: true },
  })

  const calcAvgDays = (v: { dataAbertura: Date; dataFechamento: Date | null }[]) => {
    const valid = v.filter(x => x.dataFechamento)
    if (valid.length === 0) return 0
    return parseFloat((valid.reduce((sum, x) => {
      return sum + Math.max(0, (x.dataFechamento!.getTime() - x.dataAbertura.getTime()) / 86400000)
    }, 0) / valid.length).toFixed(0))
  }

  const avgClosingDays = calcAvgDays(closedVagas)

  const vacancyTrend = await Promise.all(
    sparkMonths.map(async ({ year, month, label }) => {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0, 23, 59, 59)
      const vagas = await prisma.vaga.findMany({
        where: {
          ...vagaUnitFilter,
          status: { in: ['CONTRATADA', 'FECHADA'] },
          dataFechamento: { gte: start, lte: end },
        },
        select: { dataAbertura: true, dataFechamento: true },
      })
      return { month: label, value: calcAvgDays(vagas) }
    })
  )

  const prevFirstDay = new Date(prevMonths[0].year, prevMonths[0].month - 1, 1)
  const prevLastDay = new Date(prevPeriodLast.year, prevPeriodLast.month, 0, 23, 59, 59)
  const prevClosedVagas = await prisma.vaga.findMany({
    where: {
      ...vagaUnitFilter,
      status: { in: ['CONTRATADA', 'FECHADA'] },
      dataFechamento: { gte: prevFirstDay, lte: prevLastDay },
    },
    select: { dataAbertura: true, dataFechamento: true },
  })
  const prevAvgDays = calcAvgDays(prevClosedVagas)
  const vacancyChange = parseFloat((avgClosingDays - prevAvgDays).toFixed(0))

  // ─── Retention Rate (derived from turnover) ───────────────────────────────
  const retentionRate = parseFloat((100 - turnoverRate).toFixed(1))
  const retentionRatePrev = parseFloat((100 - turnoverRatePrev).toFixed(1))
  const retentionChange = parseFloat((retentionRate - retentionRatePrev).toFixed(1))
  const retentionTrend = turnoverSparkline.map(t => ({
    month: t.month,
    value: parseFloat((100 - t.value).toFixed(1)),
  }))

  return NextResponse.json({
    previousLabel,
    summary: {
      totalColaboradores: headcountCurrent,
      totalPcd,
      totalAprendizes,
      totalUnidades,
    },
    headcount: {
      current: headcountCurrent,
      previous: headcountPrevious,
      change: headcountChange,
      sparkline: headcountSparkline,
    },
    turnover: {
      rate: turnoverRate,
      previous: turnoverRatePrev,
      change: turnoverChange,
      sparkline: turnoverSparkline,
      last12Months: turnoverLast12,
      byGender: [],
      byAge: [],
    },
    absenteeism: {
      rate: absRate,
      previous: absRatePrev,
      change: absChange,
      sparkline: absSparkline,
    },
    engagement: {
      rate: engRate,
      previous: engRatePrev,
      change: engChange,
      sparkline: engSparkline,
    },
    nps: {
      value: npsValue,
      previous: npsValuePrev,
      change: npsChange,
      sparkline: npsSparkline,
    },
    costPerEmployee: {
      value: costPerEmpValue,
      previous: costPerEmpPrev,
      change: costPerEmpChange,
      sparkline: costPerEmpSparkline,
    },
    vacancyClosingTime: {
      days: avgClosingDays,
      target: 35,
      change: vacancyChange,
      trend: vacancyTrend,
    },
    retentionRate: {
      rate: retentionRate,
      target: 90,
      change: retentionChange,
      trend: retentionTrend,
    },
    hiringCost: {
      value: hiringCostValue,
      previous: hiringCostPrev,
      change: hiringCostChange,
      trend: hiringCostTrend,
    },
    collaboratorsByArea,
    distributionByTenure,
    training: {
      totalHours: trainingStats.totalHours,
      avgHoursPerEmployee: trainingStats.avgHoursPerEmployee,
      participationRate: trainingStats.participationRate,
      hrsChange: trainingHrsChange,
      avgChange: trainingAvgChange,
      rateChange: trainingRateChange,
    },
    lastUpdated: new Date().toISOString(),
  })
}

function emptyResponse() {
  const spark = Array.from({ length: 6 }, (_, i) => ({ month: `M${i + 1}`, value: 0 }))
  return {
    previousLabel: '—',
    summary: { totalColaboradores: 0, totalPcd: 0, totalAprendizes: 0, totalUnidades: 0 },
    headcount: { current: 0, previous: 0, change: 0, sparkline: spark },
    turnover: { rate: 0, previous: 0, change: 0, sparkline: spark, last12Months: spark, byGender: [], byAge: [] },
    absenteeism: { rate: 0, previous: 0, change: 0, sparkline: spark },
    engagement: { rate: 0, previous: 0, change: 0, sparkline: spark },
    nps: { value: 0, previous: 0, change: 0, sparkline: spark },
    costPerEmployee: { value: 0, previous: 0, change: 0, sparkline: spark },
    vacancyClosingTime: { days: 0, target: 35, change: 0, trend: spark },
    retentionRate: { rate: 0, target: 90, change: 0, trend: spark },
    hiringCost: { value: 0, previous: 0, change: 0, trend: spark },
    collaboratorsByArea: [],
    distributionByTenure: [],
    training: { totalHours: 0, avgHoursPerEmployee: 0, participationRate: 0, hrsChange: 0, avgChange: 0, rateChange: 0 },
    lastUpdated: new Date().toISOString(),
  }
}
