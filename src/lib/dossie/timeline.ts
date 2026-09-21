import { prisma } from '@/lib/prisma'
import { HISTORY_TYPES } from './history'

export type TimelineRow = {
  id: string
  tipo: string
  tipoLabel: string
  dataEvento: string
  titulo: string
  anterior: string | null
  novo: string | null
  motivo: string | null
  documentoId: string | null
  aditivoId: string | null
  responsavelNome: string | null
  sintetico?: boolean
}

export const TIMELINE_GROUPS: Record<string, string[]> = {
  todos: [],
  salario: ['SALARIO'],
  cargo: ['CARGO', 'FUNCAO'],
  jornada: ['JORNADA', 'ESCALA', 'HORARIO'],
  unidade: ['UNIDADE', 'SETOR', 'CENTRO_CUSTO', 'LOCAL_TRABALHO'],
}

/**
 * Linha do tempo funcional (mais recente primeiro). A admissão aparece sempre, mesmo sem registro
 * explícito, a partir da data de admissão do cadastro. Suporta paginação por cursor (skip/take).
 */
export async function loadTimeline(colaboradorId: string, opts: { grupo?: string; skip?: number; take?: number; admissao?: Date | null } = {}) {
  const tipos = TIMELINE_GROUPS[opts.grupo ?? 'todos'] ?? []
  const where = { colaboradorId, ...(tipos.length ? { tipo: { in: tipos } } : {}) }
  const [rows, total] = await Promise.all([
    prisma.colaboradorHistorico.findMany({ where, orderBy: [{ dataEvento: 'desc' }, { createdAt: 'desc' }], skip: opts.skip ?? 0, take: opts.take ?? 100 }),
    prisma.colaboradorHistorico.count({ where }),
  ])
  const items: TimelineRow[] = rows.map((row) => ({
    id: row.id, tipo: row.tipo, tipoLabel: HISTORY_TYPES[row.tipo] ?? row.tipo, dataEvento: row.dataEvento.toISOString(), titulo: row.titulo,
    anterior: row.anterior, novo: row.novo, motivo: row.motivo, documentoId: row.documentoId, aditivoId: row.aditivoId, responsavelNome: row.responsavelNome,
  }))
  const explicitAdmission = items.some((row) => row.tipo === 'ADMISSAO')
  const lastPage = (opts.skip ?? 0) + rows.length >= total
  if (lastPage && !tipos.length && opts.admissao && !explicitAdmission) {
    items.push({ id: 'admissao', tipo: 'ADMISSAO', tipoLabel: HISTORY_TYPES.ADMISSAO, dataEvento: opts.admissao.toISOString(), titulo: 'Admissão', anterior: null, novo: null, motivo: null, documentoId: null, aditivoId: null, responsavelNome: null, sintetico: true })
  }
  return { items, total: total + (lastPage && !tipos.length && opts.admissao && !explicitAdmission ? 1 : 0) }
}
