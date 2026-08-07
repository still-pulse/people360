import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, enforceUnitFilter } from '@/lib/apiHelpers'
import { MONTHS_PT } from '@/types'

const CONTRATADAS = ['CONTRATADA', 'FECHADA'] as const
const PIPELINE = ['ADMISSAO_EM_ANDAMENTO', 'CONTRATADA', 'FECHADA'] as const
const CAND_STATUS = ['APROVADO', 'AGUARDANDO_ADMISSAO', 'ADMITIDO'] as Prisma.EnumCandidatoStatusFilter['in']

function toDateKey(d: Date | string | null | undefined): string | null {
  if (!d) return null
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function resolveNome(v: {
  nomeColaborador?: string | null
  controleCandidato?: { nome: string } | null
  candidatos?: { nome: string; status: string }[]
}): string {
  if (v.nomeColaborador?.trim()) return v.nomeColaborador.trim()
  if (v.controleCandidato?.nome) return v.controleCandidato.nome
  for (const st of ['ADMITIDO', 'AGUARDANDO_ADMISSAO', 'APROVADO']) {
    const c = v.candidatos?.find((x) => x.status === st)
    if (c) return c.nome
  }
  return v.candidatos?.[0]?.nome ?? '—'
}

function emptyResponse(year: number, month: number | null) {
  const daysInMonth = month ? new Date(year, month, 0).getDate() : 0
  return {
    kpis: {
      totalContratados: 0,
      emAdmissao: 0,
      comDataInicio: 0,
      semDataInicio: 0,
      mediaDiasAteInicio: null as number | null,
      pcd: 0,
      inicioHoje: 0,
      inicioProximos7: 0,
      inicioProximos30: 0,
      vsMesAnterior: 0,
      mesAnteriorTotal: 0,
    },
    porDia: month
      ? Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1,
          label: String(i + 1).padStart(2, '0'),
          count: 0,
          names: [] as string[],
        }))
      : [],
    porMes: MONTHS_PT.map((m, i) => ({
      month: i + 1,
      label: m.slice(0, 3),
      labelFull: m,
      count: 0,
    })),
    porUnidade: [] as { name: string; color: string; value: number }[],
    porCargo: [] as { cargo: string; count: number }[],
    porTipoVaga: [] as { tipo: string; count: number }[],
    porTipoRequisicao: [] as { tipo: string; count: number }[],
    porAnalista: [] as { name: string; count: number }[],
    proximosInicios: [] as any[],
    recentes: [] as any[],
    rankingDias: [] as { day: number; dateKey: string; label: string; count: number; names: string[] }[],
  }
}

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()))
  const monthParam = searchParams.get('month')
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1
  const unitId = searchParams.get('unitId')

  const baseWhere: any = { status: { in: [...PIPELINE] } }
  enforceUnitFilter(baseWhere, session!, unitId, 'unidadeId')

  if (session!.user.role === 'ANALYST' && (session!.user.unitIds ?? []).length === 0 && !session!.user.unitId) {
    return NextResponse.json(emptyResponse(year, month))
  }

  // Ano inteiro + mês anterior (para comparação)
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year + 1, 0, 1)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 1)

  // Mês anterior (pode cruzar ano)
  let prevYear = year
  let prevMonth = month - 1
  if (prevMonth < 1) {
    prevMonth = 12
    prevYear = year - 1
  }
  const prevMonthStart = new Date(prevYear, prevMonth - 1, 1)
  const prevMonthEnd = new Date(prevYear, prevMonth, 1)

  // Busca ampla do ano + pipeline sem data (em andamento)
  const [vagasAno, emAdmissaoAll, prevMonthVagas] = await Promise.all([
    prisma.vaga.findMany({
      where: {
        ...baseWhere,
        OR: [
          { dataInicioIntegracao: { gte: yearStart, lt: yearEnd } },
          { dataInicioIntegracao: null, dataFechamento: { gte: yearStart, lt: yearEnd } },
          { dataInicioIntegracao: null, dataFechamento: null, status: 'ADMISSAO_EM_ANDAMENTO' },
          // Contratadas no ano pelo fechamento
          { status: { in: [...CONTRATADAS] }, dataFechamento: { gte: yearStart, lt: yearEnd } },
        ],
      },
      include: {
        unit: { select: { id: true, name: true, color: true } },
        analistas: { select: { id: true, name: true } },
        cargo_rel: { select: { id: true, name: true } },
        controleCandidato: { select: { id: true, nome: true } },
        candidatos: {
          where: { status: { in: CAND_STATUS } },
          orderBy: { updatedAt: 'desc' },
          take: 2,
          select: { id: true, nome: true, status: true },
        },
      },
    }),
    prisma.vaga.count({
      where: { ...baseWhere, status: 'ADMISSAO_EM_ANDAMENTO' },
    }),
    prisma.vaga.findMany({
      where: {
        ...baseWhere,
        status: { in: [...CONTRATADAS] },
        OR: [
          { dataInicioIntegracao: { gte: prevMonthStart, lt: prevMonthEnd } },
          {
            dataInicioIntegracao: null,
            dataFechamento: { gte: prevMonthStart, lt: prevMonthEnd },
          },
        ],
      },
      select: { id: true },
    }),
  ])

  // Dedup por id
  const byId = new Map(vagasAno.map((v) => [v.id, v]))
  const all = Array.from(byId.values())

  type Row = {
    id: string
    nome: string
    cargo: string
    status: string
    dataInicio: Date | null
    dataInicioKey: string | null
    dataAbertura: Date
    dataFechamento: Date | null
    vagaPcd: boolean
    tipoVaga: string
    tipoRequisicao: string | null
    unit: { id: string; name: string; color: string } | null
    analistas: { id: string; name: string }[]
    numProcessoAdmissao: string | null
    numProtocoloOnvio: string | null
    titulo: string
    municipio: string | null
  }

  const rows: Row[] = all.map((v) => {
    const dataInicio = v.dataInicioIntegracao ?? (CONTRATADAS.includes(v.status as any) ? v.dataFechamento : null)
    return {
      id: v.id,
      nome: resolveNome(v),
      cargo: v.cargo_rel?.name ?? v.cargo,
      status: v.status,
      dataInicio,
      dataInicioKey: toDateKey(dataInicio),
      dataAbertura: v.dataAbertura,
      dataFechamento: v.dataFechamento,
      vagaPcd: v.vagaPcd,
      tipoVaga: v.tipoVaga,
      tipoRequisicao: v.tipoRequisicao,
      unit: v.unit,
      analistas: v.analistas,
      numProcessoAdmissao: v.numProcessoAdmissao,
      numProtocoloOnvio: v.numProtocoloOnvio,
      titulo: v.titulo,
      municipio: v.municipio,
    }
  })

  const contratados = rows.filter((r) => CONTRATADAS.includes(r.status as any))
  const inMonth = (r: Row) => {
    if (!r.dataInicioKey) return false
    const [y, m] = r.dataInicioKey.split('-').map(Number)
    return y === year && m === month
  }
  const inYear = (r: Row) => {
    if (!r.dataInicioKey) return false
    return parseInt(r.dataInicioKey.slice(0, 4), 10) === year
  }

  const contratadosMes = contratados.filter(inMonth)
  const contratadosAno = contratados.filter(inYear)

  // KPIs do mês selecionado
  const comData = contratadosMes.filter((r) => r.dataInicio)
  const diasList = comData
    .map((r) =>
      Math.max(
        0,
        Math.round((r.dataInicio!.getTime() - r.dataAbertura.getTime()) / (1000 * 60 * 60 * 24))
      )
    )
  const mediaDias =
    diasList.length > 0
      ? Math.round((diasList.reduce((a, b) => a + b, 0) / diasList.length) * 10) / 10
      : null

  // Hoje / próximos (timezone SP)
  const todayKey = toDateKey(now)!
  const today = new Date(todayKey + 'T12:00:00')
  const in7 = new Date(today)
  in7.setDate(in7.getDate() + 7)
  const in30 = new Date(today)
  in30.setDate(in30.getDate() + 30)

  const futureStarts = rows.filter((r) => {
    if (!r.dataInicioKey) return false
    return r.dataInicioKey >= todayKey
  })

  const inicioHoje = futureStarts.filter((r) => r.dataInicioKey === todayKey).length
  const inicioProximos7 = futureStarts.filter((r) => {
    const d = new Date(r.dataInicioKey! + 'T12:00:00')
    return d >= today && d <= in7
  }).length
  const inicioProximos30 = futureStarts.filter((r) => {
    const d = new Date(r.dataInicioKey! + 'T12:00:00')
    return d >= today && d <= in30
  }).length

  const mesAnteriorTotal = prevMonthVagas.length
  const vsMesAnterior = contratadosMes.length - mesAnteriorTotal

  // Por dia do mês
  const daysInMonth = new Date(year, month, 0).getDate()
  const dayMap = new Map<number, { count: number; names: string[] }>()
  for (let d = 1; d <= daysInMonth; d++) dayMap.set(d, { count: 0, names: [] })
  for (const r of contratadosMes) {
    if (!r.dataInicioKey) continue
    const day = parseInt(r.dataInicioKey.slice(8, 10), 10)
    const entry = dayMap.get(day)
    if (entry) {
      entry.count++
      if (r.nome && r.nome !== '—') entry.names.push(r.nome)
    }
  }
  const porDia = Array.from(dayMap.entries()).map(([day, v]) => ({
    day,
    label: String(day).padStart(2, '0'),
    count: v.count,
    names: v.names,
  }))

  // Ranking dos dias com mais admissões
  const rankingDias = porDia
    .filter((d) => d.count > 0)
    .map((d) => ({
      ...d,
      dateKey: `${year}-${String(month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`,
      label: `${String(d.day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    }))
    .sort((a, b) => b.count - a.count || a.day - b.day)

  // Por mês do ano
  const monthCounts = Array.from({ length: 12 }, () => 0)
  for (const r of contratadosAno) {
    if (!r.dataInicioKey) continue
    const m = parseInt(r.dataInicioKey.slice(5, 7), 10)
    if (m >= 1 && m <= 12) monthCounts[m - 1]++
  }
  const porMes = MONTHS_PT.map((label, i) => ({
    month: i + 1,
    label: label.slice(0, 3),
    labelFull: label,
    count: monthCounts[i],
  }))

  // Agregações do mês
  function aggregate(list: Row[]) {
    const porUnidadeMap = new Map<string, { name: string; color: string; value: number }>()
    const porCargoMap = new Map<string, number>()
    const porTipoMap = new Map<string, number>()
    const porReqMap = new Map<string, number>()
    const porAnalistaMap = new Map<string, { name: string; count: number }>()

    for (const r of list) {
      if (r.unit) {
        const cur = porUnidadeMap.get(r.unit.id) ?? {
          name: r.unit.name,
          color: r.unit.color,
          value: 0,
        }
        cur.value++
        porUnidadeMap.set(r.unit.id, cur)
      }
      porCargoMap.set(r.cargo, (porCargoMap.get(r.cargo) ?? 0) + 1)
      porTipoMap.set(r.tipoVaga, (porTipoMap.get(r.tipoVaga) ?? 0) + 1)
      if (r.tipoRequisicao) {
        porReqMap.set(r.tipoRequisicao, (porReqMap.get(r.tipoRequisicao) ?? 0) + 1)
      }
      for (const a of r.analistas) {
        const cur = porAnalistaMap.get(a.id) ?? { name: a.name, count: 0 }
        cur.count++
        porAnalistaMap.set(a.id, cur)
      }
    }

    return {
      porUnidade: Array.from(porUnidadeMap.values()).sort((a, b) => b.value - a.value),
      porCargo: Array.from(porCargoMap.entries())
        .map(([cargo, count]) => ({ cargo, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      porTipoVaga: Array.from(porTipoMap.entries())
        .map(([tipo, count]) => ({ tipo, count }))
        .sort((a, b) => b.count - a.count),
      porTipoRequisicao: Array.from(porReqMap.entries())
        .map(([tipo, count]) => ({ tipo, count }))
        .sort((a, b) => b.count - a.count),
      porAnalista: Array.from(porAnalistaMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
    }
  }

  const agg = aggregate(contratadosMes)

  // Próximos inícios (agenda)
  const proximosInicios = futureStarts
    .filter((r) => r.dataInicioKey && r.dataInicioKey >= todayKey)
    .sort((a, b) => (a.dataInicioKey! < b.dataInicioKey! ? -1 : 1))
    .slice(0, 15)
    .map((r) => ({
      id: r.id,
      colaboradorNome: r.nome,
      cargo: r.cargo,
      dataInicio: r.dataInicio,
      dataInicioKey: r.dataInicioKey,
      unit: r.unit,
      status: r.status,
      municipio: r.municipio,
      titulo: r.titulo,
    }))

  // Recentes do mês
  const recentes = contratadosMes
    .sort((a, b) => {
      const da = a.dataInicio?.getTime() ?? 0
      const db = b.dataInicio?.getTime() ?? 0
      return db - da
    })
    .slice(0, 12)
    .map((r) => ({
      id: r.id,
      colaboradorNome: r.nome,
      cargo: r.cargo,
      dataInicio: r.dataInicio,
      dataInicioKey: r.dataInicioKey,
      dataFechamento: r.dataFechamento,
      unit: r.unit,
      status: r.status,
      tipoVaga: r.tipoVaga,
      vagaPcd: r.vagaPcd,
      numProcessoAdmissao: r.numProcessoAdmissao,
      analistas: r.analistas,
    }))

  return NextResponse.json({
    year,
    month,
    kpis: {
      totalContratados: contratadosMes.length,
      emAdmissao: emAdmissaoAll,
      comDataInicio: comData.length,
      semDataInicio: contratadosMes.filter((r) => !r.dataInicio).length,
      mediaDiasAteInicio: mediaDias,
      pcd: contratadosMes.filter((r) => r.vagaPcd).length,
      inicioHoje,
      inicioProximos7,
      inicioProximos30,
      vsMesAnterior,
      mesAnteriorTotal,
      totalAno: contratadosAno.length,
    },
    porDia,
    porMes,
    ...agg,
    proximosInicios,
    recentes,
    rankingDias,
  })
}
