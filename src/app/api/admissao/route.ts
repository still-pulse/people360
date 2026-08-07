import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, enforceUnitFilter } from '@/lib/apiHelpers'

const CAND_STATUS = ['APROVADO', 'AGUARDANDO_ADMISSAO', 'ADMITIDO'] as Prisma.EnumCandidatoStatusFilter['in']

/** Status de vaga considerados no pipeline de admissão (contratados + em andamento). */
const ADMISSAO_STATUSES = ['ADMISSAO_EM_ANDAMENTO', 'CONTRATADA', 'FECHADA'] as const
/** Apenas vagas efetivamente fechadas com contratação. */
const CONTRATADAS_STATUSES = ['CONTRATADA', 'FECHADA'] as const

function resolveColaboradorNome(v: {
  nomeColaborador?: string | null
  controleCandidato?: { nome: string } | null
  candidatos?: { nome: string; status: string }[]
}): string {
  if (v.nomeColaborador?.trim()) return v.nomeColaborador.trim()
  if (v.controleCandidato?.nome) return v.controleCandidato.nome
  const preferidos = ['ADMITIDO', 'AGUARDANDO_ADMISSAO', 'APROVADO']
  for (const st of preferidos) {
    const c = v.candidatos?.find((x) => x.status === st)
    if (c) return c.nome
  }
  if (v.candidatos?.[0]?.nome) return v.candidatos[0].nome
  return '—'
}

function toDateKey(d: Date | string | null | undefined): string | null {
  if (!d) return null
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  // YYYY-MM-DD em America/Sao_Paulo
  return dt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
  const day = searchParams.get('day') ? parseInt(searchParams.get('day')!) : null
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const statusFilter = searchParams.get('status') // 'contratados' | 'em_andamento' | 'todos'
  const tipoVaga = searchParams.get('tipoVaga')
  const cargo = searchParams.get('cargo')
  const search = searchParams.get('search')?.trim().toLowerCase()
  /** Campo de data para filtro: inicio (dataInicioIntegracao) | fechamento | abertura */
  const dateField = searchParams.get('dateField') || 'inicio'

  const where: any = {}
  enforceUnitFilter(where, session!, searchParams.get('unitId'), 'unidadeId')

  if (session!.user.role === 'ANALYST' && (session!.user.unitIds ?? []).length === 0 && !session!.user.unitId) {
    return NextResponse.json([])
  }

  if (statusFilter === 'em_andamento') {
    where.status = 'ADMISSAO_EM_ANDAMENTO'
  } else if (statusFilter === 'contratados') {
    where.status = { in: [...CONTRATADAS_STATUSES] }
  } else {
    where.status = { in: [...ADMISSAO_STATUSES] }
  }

  if (tipoVaga) where.tipoVaga = tipoVaga
  if (cargo) where.cargo = { contains: cargo, mode: 'insensitive' }

  const fieldMap: Record<string, string> = {
    inicio: 'dataInicioIntegracao',
    fechamento: 'dataFechamento',
    abertura: 'dataAbertura',
  }
  const prismaDateField = fieldMap[dateField] ?? 'dataInicioIntegracao'

  // Filtro por intervalo de datas (quando o campo existir)
  if (dateFrom || dateTo || year) {
    const range: any = {}
    if (dateFrom) range.gte = new Date(dateFrom + 'T00:00:00')
    if (dateTo) range.lt = new Date(new Date(dateTo + 'T00:00:00').getTime() + 24 * 60 * 60 * 1000)
    if (!dateFrom && !dateTo && year) {
      if (month && day) {
        const start = new Date(year, month - 1, day)
        const end = new Date(year, month - 1, day + 1)
        range.gte = start
        range.lt = end
      } else if (month) {
        range.gte = new Date(year, month - 1, 1)
        range.lt = new Date(year, month, 1)
      } else {
        range.gte = new Date(year, 0, 1)
        range.lt = new Date(year + 1, 0, 1)
      }
    }
    // Inclui registros com a data no range OU (sem data de início e status em admissão) quando filtrando por início
    if (Object.keys(range).length > 0) {
      if (dateField === 'inicio') {
        where.AND = [
          ...(where.AND ?? []),
          {
            OR: [
              { dataInicioIntegracao: range },
              // fallback: sem data de início → usa dataFechamento no período
              { dataInicioIntegracao: null, dataFechamento: range },
              // em admissão ainda sem data, mas aberta no período (para pipeline)
              {
                dataInicioIntegracao: null,
                dataFechamento: null,
                status: 'ADMISSAO_EM_ANDAMENTO',
                dataAbertura: range,
              },
            ],
          },
        ]
      } else {
        where[prismaDateField] = range
      }
    }
  }

  const vagas = await prisma.vaga.findMany({
    where,
    include: {
      unit: { select: { id: true, name: true, color: true } },
      analistas: { select: { id: true, name: true } },
      cargo_rel: { select: { id: true, name: true } },
      controleCandidato: { select: { id: true, nome: true, telefone: true, funcao: true, status: true } },
      candidatos: {
        where: { status: { in: CAND_STATUS } },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          nome: true,
          telefone: true,
          email: true,
          status: true,
          dataAprovacao: true,
        },
      },
    },
    orderBy: [
      { dataInicioIntegracao: 'desc' },
      { dataFechamento: 'desc' },
      { updatedAt: 'desc' },
    ],
  })

  let items = vagas.map((v) => {
    const dataInicio = v.dataInicioIntegracao ?? v.dataFechamento
    const dataInicioKey = toDateKey(dataInicio)
    const diasAberturaAteInicio =
      v.dataAbertura && dataInicio
        ? Math.max(
            0,
            Math.round(
              (new Date(dataInicio).getTime() - new Date(v.dataAbertura).getTime()) / (1000 * 60 * 60 * 24)
            )
          )
        : null

    return {
      id: v.id,
      vagaId: v.id,
      titulo: v.titulo,
      cargo: v.cargo_rel?.name ?? v.cargo,
      cargoRaw: v.cargo,
      colaboradorNome: resolveColaboradorNome(v),
      telefone:
        v.controleCandidato?.telefone ??
        v.candidatos?.[0]?.telefone ??
        null,
      email: v.candidatos?.[0]?.email ?? null,
      municipio: v.municipio,
      setor: v.setor,
      tipoVaga: v.tipoVaga,
      tipoRequisicao: v.tipoRequisicao,
      tipoContrato: v.tipoContrato,
      tipoRecrutamento: v.tipoRecrutamento,
      vagaPcd: v.vagaPcd,
      quantidade: v.quantidade,
      status: v.status,
      dataAbertura: v.dataAbertura,
      dataPrevistaFechamento: v.dataPrevistaFechamento,
      dataFechamento: v.dataFechamento,
      dataInicioIntegracao: v.dataInicioIntegracao,
      dataInicioEfetiva: dataInicio,
      dataInicioKey,
      diasAberturaAteInicio,
      numProcessoAdmissao: v.numProcessoAdmissao,
      numProtocoloOnvio: v.numProtocoloOnvio,
      gestorRequisitante: v.gestorRequisitante,
      nomeColaboradorSaiu: v.nomeColaboradorSaiu,
      observacoes: v.observacoes,
      unit: v.unit,
      analistas: v.analistas,
      controleCandidato: v.controleCandidato,
      candidatos: v.candidatos,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }
  })

  if (search) {
    items = items.filter((i) => {
      const hay = [
        i.colaboradorNome,
        i.cargo,
        i.titulo,
        i.municipio,
        i.setor,
        i.numProcessoAdmissao,
        i.numProtocoloOnvio,
        i.unit?.name,
        ...(i.analistas?.map((a) => a.name) ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(search)
    })
  }

  // Filtro fino por dia (quando year+month+day e data em SP)
  if (year && month && day) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    items = items.filter((i) => i.dataInicioKey === key)
  }

  return NextResponse.json(items)
}
