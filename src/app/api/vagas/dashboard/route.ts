import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, enforceUnitFilter } from '@/lib/apiHelpers'

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)

  // Vaga usa 'unidadeId', não 'unitId'
  const vagaWhere: any = {}
  enforceUnitFilter(vagaWhere, session!, searchParams.get('unitId'), 'unidadeId')

  if (session!.user.role === 'ANALYST' && !session!.user.unitId) {
    return NextResponse.json(emptyData())
  }

  const [vagas, units, analysts] = await Promise.all([
    prisma.vaga.findMany({
      where: vagaWhere,
      include: {
        unit: true,
        analistas: { select: { id: true, name: true } },
        cargo_rel: { select: { id: true, name: true } },
      },
    }),
    prisma.unit.findMany({ where: { active: true } }),
    prisma.user.findMany({ where: { role: 'ANALYST', active: true } }),
  ])

  // Candidatos das vagas filtradas
  const vagaIds = vagas.map((v) => v.id)
  const candidatos = vagaIds.length > 0
    ? await prisma.candidato.findMany({ where: { vagaId: { in: vagaIds } } })
    : []

  const today = new Date()
  const sevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  const activeStatuses = ['ABERTA', 'DIVULGACAO', 'TRIAGEM', 'ENTREVISTAS', 'ENCAMINHADA_GESTOR', 'APROVADA_CONTRATACAO', 'ADMISSAO_EM_ANDAMENTO']
  const total = vagas.length
  const emAndamento = vagas.filter((v) => activeStatuses.includes(v.status)).length
  const abertas = vagas.filter((v) => v.status === 'ABERTA').length
  const admissaoEmAndamento = vagas.filter((v) => v.status === 'ADMISSAO_EM_ANDAMENTO').length
  const contratadas = vagas.filter((v) => v.status === 'CONTRATADA').length
  const aVencer = vagas.filter((v) =>
    v.dataPrevistaFechamento &&
    new Date(v.dataPrevistaFechamento) <= sevenDays &&
    activeStatuses.includes(v.status)
  ).length

  // Por unidade
  const porUnidade = units.map((u) => {
    const count = vagas.filter((v) => v.unidadeId === u.id && activeStatuses.includes(v.status)).length
    return { name: u.name, color: u.color, value: count }
  }).filter((u) => u.value > 0)

  // Por status
  const statusCounts = Object.entries(
    vagas.reduce((acc: Record<string, number>, v) => {
      acc[v.status] = (acc[v.status] ?? 0) + 1
      return acc
    }, {})
  ).map(([status, count]) => ({ status, count }))

  // Por analista
  const porAnalista = analysts.map((a) => ({
    name: a.name,
    abertas: vagas.filter((v) => (v as any).analistas?.some((u: any) => u.id === a.id) && activeStatuses.includes(v.status)).length,
    total: vagas.filter((v) => (v as any).analistas?.some((u: any) => u.id === a.id)).length,
  })).filter((a) => a.total > 0)

  // Por cargo (top 6) — usa nome oficial quando disponível
  const cargoCounts = vagas
    .filter((v) => activeStatuses.includes(v.status))
    .reduce((acc: Record<string, number>, v) => {
      const nome = (v as any).cargo_rel?.name ?? v.cargo
      acc[nome] = (acc[nome] ?? 0) + 1
      return acc
    }, {})
  const porCargo = Object.entries(cargoCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([cargo, count]) => ({ cargo, count }))

  // Vagas a vencer
  const vagasAVencer = vagas
    .filter((v) =>
      v.dataPrevistaFechamento &&
      new Date(v.dataPrevistaFechamento) <= sevenDays &&
      activeStatuses.includes(v.status)
    )
    .sort((a, b) =>
      new Date(a.dataPrevistaFechamento!).getTime() - new Date(b.dataPrevistaFechamento!).getTime()
    )
    .slice(0, 5)
    .map((v) => ({
      id: v.id,
      titulo: v.titulo,
      cargo: v.cargo,
      unitName: v.unit?.name ?? '—',
      unitColor: v.unit?.color ?? '#15AFA4',
      dataPrevista: v.dataPrevistaFechamento,
      status: v.status,
    }))

  return NextResponse.json({
    kpis: { total, emAndamento, abertas, admissaoEmAndamento, contratadas, aVencer,
      fechadas: vagas.filter((v) => ['FECHADA', 'CANCELADA'].includes(v.status)).length,
    },
    porUnidade,
    statusCounts,
    porAnalista,
    porCargo,
    vagasAVencer,
  })
}

function emptyData() {
  return {
    kpis: { total: 0, abertas: 0, admissaoEmAndamento: 0, emAndamento: 0, contratadas: 0, fechadas: 0, aVencer: 0 },
    porUnidade: [], statusCounts: [], porAnalista: [], porCargo: [], vagasAVencer: [],
  }
}
