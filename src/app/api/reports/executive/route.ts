import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateTurnoverRate, calculateAbsenteeismRate, calculatePCDMinimum } from '@/lib/utils'
import { trainingApiConfigured, fetchTrainingSummary } from '@/lib/trainingApi'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  const units = await prisma.unit.findMany({ where: { active: true }, orderBy: { name: 'asc' } })

  // Busca dados de treinamento da API externa quando disponível
  const extTraining = trainingApiConfigured() ? await fetchTrainingSummary(year) : null
  const extRegistros: any[] = extTraining?.registros ?? []

  const unitReports = await Promise.all(
    units.map(async (unit) => {
      const [
        pcd, apprentice, turnover, absenteeism, headcount,
        engagement, nps, payroll, hiringCost, tenure, training,
        pcdWeekly,
      ] = await Promise.all([
        prisma.pCDIndicator.findMany({ where: { unitId: unit.id, year }, orderBy: { month: 'asc' } }),
        prisma.apprenticeIndicator.findMany({ where: { unitId: unit.id, year }, orderBy: { month: 'asc' } }),
        prisma.turnoverIndicator.findMany({ where: { unitId: unit.id, year }, orderBy: { month: 'asc' } }),
        prisma.absenteeismIndicator.findMany({ where: { unitId: unit.id, year }, orderBy: { month: 'asc' } }),
        prisma.headcountEntry.findMany({ where: { unitId: unit.id, year }, include: { position: true }, orderBy: [{ month: 'asc' }, { position: { name: 'asc' } }] }),
        prisma.engagementIndicator.findMany({ where: { unitId: unit.id, year }, orderBy: { month: 'asc' } }),
        prisma.npsIndicator.findMany({ where: { unitId: unit.id, year }, orderBy: { month: 'asc' } }),
        prisma.payrollIndicator.findMany({ where: { unitId: unit.id, year }, orderBy: { month: 'asc' } }),
        prisma.hiringCostIndicator.findMany({ where: { unitId: unit.id, year }, orderBy: { month: 'asc' } }),
        prisma.tenureDistributionIndicator.findMany({ where: { unitId: unit.id, year }, orderBy: { month: 'asc' } }),
        prisma.trainingIndicator.findMany({ where: { unitId: unit.id, year }, orderBy: { month: 'asc' } }),
        prisma.pcdWeeklySnapshot.findMany({ where: { unitId: unit.id, year }, orderBy: { weekDate: 'asc' } }),
      ])

      const latestMonth = new Date().getMonth() + 1
      const latestPcd         = pcd.find((p) => p.month === latestMonth) ?? pcd[pcd.length - 1]
      const latestApprentice  = apprentice.find((a) => a.month === latestMonth) ?? apprentice[apprentice.length - 1]
      const latestTurnover    = turnover.find((t) => t.month === latestMonth) ?? turnover[turnover.length - 1]
      const latestAbsenteeism = absenteeism.find((a) => a.month === latestMonth) ?? absenteeism[absenteeism.length - 1]
      const latestEngagement  = engagement.find((e) => e.month === latestMonth) ?? engagement[engagement.length - 1]
      const latestNps         = nps.find((n) => n.month === latestMonth) ?? nps[nps.length - 1]
      const latestPayroll     = payroll.find((p) => p.month === latestMonth) ?? payroll[payroll.length - 1]
      const latestHiringCost  = hiringCost.find((h) => h.month === latestMonth) ?? hiringCost[hiringCost.length - 1]
      const latestTenure      = tenure.find((t) => t.month === latestMonth) ?? tenure[tenure.length - 1]

      const latestHc = headcount.filter((h) => h.month === latestMonth)
      const totalHeadcount = latestHc.reduce((sum, h) => sum + h.count, 0)

      const pcdRequired = latestPcd ? calculatePCDMinimum(latestPcd.totalEmployees, latestPcd.metaPercentage) : 0
      const pcdStatus = latestPcd
        ? latestPcd.currentPcd >= pcdRequired ? 'Atingida' : latestPcd.currentPcd >= pcdRequired * 0.85 ? 'Atenção' : 'Abaixo'
        : '—'

      const apprenticeStatus = latestApprentice
        ? latestApprentice.currentCount >= latestApprentice.requiredCount ? 'Atingida' : latestApprentice.currentCount >= latestApprentice.requiredCount * 0.85 ? 'Atenção' : 'Abaixo'
        : '—'

      const turnoverRate = latestTurnover
        ? calculateTurnoverRate(latestTurnover.admissions, latestTurnover.dismissals, latestTurnover.headcountStart, latestTurnover.headcountEnd)
        : null

      const absenteeismRate = latestAbsenteeism
        ? calculateAbsenteeismRate(latestAbsenteeism.totalDaysLost, latestAbsenteeism.totalEmployees, latestAbsenteeism.workingDaysInMonth)
        : null

      const calcNpsScore = (n: any) =>
        n.totalRespondents > 0 ? Math.round(((n.promoters - n.detractors) / n.totalRespondents) * 100) : 0

      return {
        unit: { id: unit.id, name: unit.name, color: unit.color },
        summary: {
          totalHeadcount,
          pcdCurrent: latestPcd?.currentPcd ?? 0,
          pcdRequired,
          pcdMeta: latestPcd?.metaPercentage ?? 5,
          pcdStatus,
          apprenticeCurrent: latestApprentice?.currentCount ?? 0,
          apprenticeRequired: latestApprentice?.requiredCount ?? 0,
          apprenticeStatus,
          turnoverRate: turnoverRate !== null ? parseFloat(turnoverRate.toFixed(2)) : null,
          absenteeismRate: absenteeismRate !== null ? parseFloat(absenteeismRate.toFixed(2)) : null,
          absenteeismDays: latestAbsenteeism?.totalDaysLost ?? 0,
          engagementRate: latestEngagement?.rate ?? null,
          npsScore: latestNps ? calcNpsScore(latestNps) : null,
          costPerEmployee: latestPayroll && latestPayroll.totalEmployees > 0
            ? parseFloat((latestPayroll.totalPayroll / latestPayroll.totalEmployees).toFixed(2))
            : null,
          costPerHire: latestHiringCost && latestHiringCost.totalHires > 0
            ? parseFloat((latestHiringCost.totalCost / latestHiringCost.totalHires).toFixed(2))
            : null,
        },
        turnoverHistory: turnover.map((t) => ({
          month: t.month,
          admissions: t.admissions,
          dismissals: t.dismissals,
          rate: parseFloat(calculateTurnoverRate(t.admissions, t.dismissals, t.headcountStart, t.headcountEnd).toFixed(2)),
        })),
        absenteeismHistory: absenteeism.map((a) => ({
          month: a.month,
          certificates: a.totalCertificates,
          daysLost: a.totalDaysLost,
          rate: parseFloat(calculateAbsenteeismRate(a.totalDaysLost, a.totalEmployees, a.workingDaysInMonth).toFixed(2)),
        })),
        headcountByPosition: latestHc.map((h) => ({
          position: h.position.name,
          count: h.count,
        })),
        engagementHistory: engagement.map((e) => ({
          month: e.month,
          rate: e.rate,
          totalRespondents: e.totalRespondents,
          totalEmployees: e.totalEmployees,
        })),
        npsHistory: nps.map((n) => ({
          month: n.month,
          promoters: n.promoters,
          neutrals: n.neutrals,
          detractors: n.detractors,
          totalRespondents: n.totalRespondents,
          score: calcNpsScore(n),
        })),
        payrollHistory: payroll.map((p) => ({
          month: p.month,
          totalPayroll: p.totalPayroll,
          totalEmployees: p.totalEmployees,
          costPerEmployee: p.totalEmployees > 0 ? parseFloat((p.totalPayroll / p.totalEmployees).toFixed(2)) : 0,
        })),
        hiringCostHistory: hiringCost.map((h) => ({
          month: h.month,
          totalCost: h.totalCost,
          totalHires: h.totalHires,
          costPerHire: h.totalHires > 0 ? parseFloat((h.totalCost / h.totalHires).toFixed(2)) : 0,
        })),
        tenureLatest: latestTenure ? {
          month: latestTenure.month,
          ate1ano: latestTenure.ate1ano,
          de1a3: latestTenure.de1a3,
          de3a5: latestTenure.de3a5,
          de5a10: latestTenure.de5a10,
          acima10: latestTenure.acima10,
          total: latestTenure.ate1ano + latestTenure.de1a3 + latestTenure.de3a5 + latestTenure.de5a10 + latestTenure.acima10,
        } : null,
        pcdWeeklyHistory: pcdWeekly.map((w) => ({
          weekDate: w.weekDate.toISOString(),
          month: w.month,
          totalEmployees: w.totalEmployees,
          metaPercentage: w.metaPercentage,
          currentPcd: w.currentPcd,
          minimum: calculatePCDMinimum(w.totalEmployees, w.metaPercentage),
        })),
        trainingHistory: (() => {
          // Usa API externa se disponível, senão banco local
          const extUnit = extRegistros.filter((r: any) => r.unidadeId === unit.id)
          if (extUnit.length > 0) {
            return extUnit.map((r: any) => ({
              month: r.mes,
              totalHours: r.totalHoras ?? 0,
              totalParticipants: r.participantes ?? 0,
              totalEmployees: r.colaboradores ?? 0,
              avgHours: r.mediaPorColaborador ?? 0,
              participationRate: r.taxaParticipacao ?? 0,
            })).sort((a: any, b: any) => a.month - b.month)
          }
          return training.map((t) => ({
            month: t.month,
            totalHours: t.totalHours,
            totalParticipants: t.totalParticipants,
            totalEmployees: t.totalEmployees,
            avgHours: t.totalEmployees > 0 ? parseFloat((t.totalHours / t.totalEmployees).toFixed(1)) : 0,
            participationRate: t.totalEmployees > 0 ? parseFloat((t.totalParticipants / t.totalEmployees * 100).toFixed(1)) : 0,
          }))
        })(),
      }
    })
  )

  const consolidated = {
    totalHeadcount: unitReports.reduce((s, u) => s + u.summary.totalHeadcount, 0),
    totalPcd: unitReports.reduce((s, u) => s + u.summary.pcdCurrent, 0),
    totalApprentices: unitReports.reduce((s, u) => s + u.summary.apprenticeCurrent, 0),
    avgTurnover: (() => {
      const rates = unitReports.map((u) => u.summary.turnoverRate).filter((r) => r !== null) as number[]
      return rates.length ? parseFloat((rates.reduce((s, r) => s + r, 0) / rates.length).toFixed(2)) : null
    })(),
    totalAbsenteeismDays: unitReports.reduce((s, u) => s + u.summary.absenteeismDays, 0),
    totalUnits: units.length,
    avgEngagement: (() => {
      const rates = unitReports.map((u) => u.summary.engagementRate).filter((r) => r !== null) as number[]
      return rates.length ? parseFloat((rates.reduce((s, r) => s + r, 0) / rates.length).toFixed(1)) : null
    })(),
    avgNps: (() => {
      const scores = unitReports.map((u) => u.summary.npsScore).filter((s) => s !== null) as number[]
      return scores.length ? Math.round(scores.reduce((s, r) => s + r, 0) / scores.length) : null
    })(),
    avgCostPerEmployee: (() => {
      const costs = unitReports.map((u) => u.summary.costPerEmployee).filter((c) => c !== null) as number[]
      return costs.length ? parseFloat((costs.reduce((s, c) => s + c, 0) / costs.length).toFixed(2)) : null
    })(),
  }

  return NextResponse.json({ year, consolidated, units: unitReports, generatedAt: new Date().toISOString() })
}
