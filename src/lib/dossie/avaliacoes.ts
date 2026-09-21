import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { addDays, fmtDate, parseDateInput } from './format'
import { addHistorico, auditDossie } from './history'
import { buildSnapshot, packSnapshot, unpackSnapshot } from './snapshot'
import { getAutoavaliacaoModelo, getAvaliacaoModelo } from './templates'
import { renderAvaliacaoPdf, type AvaliacaoRender } from './pdf/render'
import { DossieError } from './documentos'
import type { Actor } from './types'

const answer = z.object({ id: z.string().max(60), valor: z.string().max(40).optional(), comentario: z.string().max(1000).optional() })

export const avaliacaoSchema = z.object({
  tipo: z.enum(['GERENCIAL', 'AUTOAVALIACAO']),
  periodoDias: z.number().int().min(1).max(365).optional().nullable(),
  periodoInicio: z.string().optional().nullable(),
  periodoFim: z.string().optional().nullable(),
  avaliadorNome: z.string().trim().max(120).optional().nullable(),
  respostas: z.array(answer).max(60),
  parecer: z.string().trim().max(4000).optional().nullable(),
  decisao: z.string().max(30).optional().nullable(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
  dataAvaliacao: z.string().optional().nullable(),
  finalizar: z.boolean().optional(),
})
export type AvaliacaoInput = z.infer<typeof avaliacaoSchema>

export async function getModelos() {
  const [gerencial, auto] = await Promise.all([getAvaliacaoModelo(), getAutoavaliacaoModelo()])
  return { gerencial: gerencial.modelo, autoavaliacao: auto.modelo }
}

/** Período sugerido: da admissão até o dia N (ex.: 45 dias → admissão + 44). */
export function suggestPeriod(admissao: string | null, dias: number) {
  if (!admissao) return { inicio: null, fim: null }
  const inicio = new Date(admissao)
  return { inicio, fim: addDays(inicio, dias - 1) }
}

export async function saveAvaliacao(params: { colaboradorId: string; id?: string; input: AvaliacaoInput; actor: Actor & { role?: string }; ip?: string | null }) {
  const { input, actor } = params
  const isSelf = input.tipo === 'AUTOAVALIACAO'
  const modelos = isSelf ? await getAutoavaliacaoModelo() : await getAvaliacaoModelo()
  const modelo = modelos.modelo
  const snapshot = await buildSnapshot(params.colaboradorId)
  if (!snapshot) throw new DossieError('Colaborador não encontrado.', 404)

  const errors: string[] = []
  const periodoInicio = parseDateInput(input.periodoInicio), periodoFim = parseDateInput(input.periodoFim)
  const finalizar = !!input.finalizar
  if (finalizar) {
    if (!snapshot.admissao) errors.push('Não é possível avaliar sem data de admissão.')
    if (!input.periodoDias && !(periodoInicio && periodoFim)) errors.push('Informe o período avaliado (45 dias, 90 dias ou datas).')
    if (periodoInicio && periodoFim && periodoFim < periodoInicio) errors.push('O fim do período deve ser posterior ao início.')
    const answers = new Map(input.respostas.map((r) => [r.id, r]))
    if (isSelf) {
      const questions = (modelo as Awaited<ReturnType<typeof getAutoavaliacaoModelo>>['modelo']).perguntas
      const open = questions.filter((q) => { const r = answers.get(q.id); return !(q.tipo === 'texto' ? (r?.comentario || r?.valor) : r?.valor) })
      if (open.length) errors.push(`Responda todas as perguntas (faltam ${open.length}).`)
    } else {
      const criterios = (modelo as Awaited<ReturnType<typeof getAvaliacaoModelo>>['modelo']).criterios
      const open = criterios.filter((c) => !answers.get(c.id)?.valor)
      if (open.length) errors.push(`Avalie todos os critérios (faltam ${open.length}).`)
      if (!input.decisao) errors.push('Selecione a decisão do gestor.')
      if (!input.avaliadorNome?.trim()) errors.push('Informe o responsável pela avaliação.')
    }
    if (!input.parecer?.trim()) errors.push(isSelf ? 'Informe o parecer final do colaborador.' : 'Informe o parecer do gestor.')
  }
  if (errors.length) throw new DossieError('Não foi possível concluir a avaliação.', 422, errors)

  const data = {
    tipo: input.tipo, periodoDias: input.periodoDias ?? null, periodoInicio, periodoFim,
    avaliadorNome: input.avaliadorNome?.trim() || null,
    respostas: input.respostas as unknown as Prisma.InputJsonValue, modelo: modelo as unknown as Prisma.InputJsonValue,
    snapshot: packSnapshot(snapshot) as Prisma.InputJsonValue, parecer: input.parecer?.trim() || null, decisao: input.decisao || null,
    observacoes: input.observacoes?.trim() || null, dataAvaliacao: parseDateInput(input.dataAvaliacao) ?? new Date(),
    status: finalizar ? 'FINALIZADA' : 'RASCUNHO',
  }

  if (params.id) {
    const current = await prisma.colaboradorAvaliacao.findFirst({ where: { id: params.id, colaboradorId: params.colaboradorId } })
    if (!current) throw new DossieError('Avaliação não encontrada.', 404)
    if (current.status !== 'RASCUNHO') throw new DossieError('Avaliações finalizadas não podem ser alteradas.', 409)
  }
  const saved = params.id
    ? await prisma.colaboradorAvaliacao.update({ where: { id: params.id }, data })
    : await prisma.colaboradorAvaliacao.create({ data: { colaboradorId: params.colaboradorId, criadoPorId: actor.id, criadoPorNome: actor.name, ...data } })

  if (finalizar) {
    const label = isSelf ? 'Autoavaliação de experiência' : `Avaliação de ${input.periodoDias ?? ''} dias`.replace('  ', ' ')
    await addHistorico({ colaboradorId: params.colaboradorId, tipo: 'AVALIACAO', dataEvento: data.dataAvaliacao, titulo: `${label} concluída`, novo: input.decisao ?? null, motivo: input.parecer ?? null, actor })
  }
  await auditDossie({ actor, action: params.id ? 'UPDATE' : 'CREATE', entity: 'Avaliacao', entityId: saved.id, colaboradorId: params.colaboradorId, ip: params.ip, details: { tipo: input.tipo, status: data.status } })
  return saved
}

export async function cancelAvaliacao(params: { colaboradorId: string; id: string; motivo: string; actor: Actor & { role?: string }; ip?: string | null }) {
  const current = await prisma.colaboradorAvaliacao.findFirst({ where: { id: params.id, colaboradorId: params.colaboradorId } })
  if (!current) throw new DossieError('Avaliação não encontrada.', 404)
  if (current.status === 'CANCELADA') throw new DossieError('Avaliação já cancelada.', 409)
  if (params.motivo.trim().length < 5) throw new DossieError('Informe o motivo do cancelamento (mínimo de 5 caracteres).', 422)
  const updated = await prisma.colaboradorAvaliacao.update({ where: { id: current.id }, data: { status: 'CANCELADA', observacoes: `${current.observacoes ? current.observacoes + '\n' : ''}Cancelada: ${params.motivo.trim()}` } })
  await addHistorico({ colaboradorId: params.colaboradorId, tipo: 'AVALIACAO', dataEvento: new Date(), titulo: 'Avaliação cancelada', motivo: params.motivo.trim(), actor: params.actor })
  await auditDossie({ actor: params.actor, action: 'DELETE', entity: 'Avaliacao', entityId: current.id, colaboradorId: params.colaboradorId, ip: params.ip, details: { acao: 'cancelar' } })
  return updated
}

export function toRender(row: { tipo: string; periodoDias: number | null; periodoInicio: Date | null; periodoFim: Date | null; avaliadorNome: string | null; respostas: unknown; modelo: unknown; parecer: string | null; decisao: string | null; observacoes: string | null; dataAvaliacao: Date }): AvaliacaoRender {
  return {
    tipo: row.tipo, periodoDias: row.periodoDias, periodoInicio: row.periodoInicio, periodoFim: row.periodoFim, avaliadorNome: row.avaliadorNome,
    respostas: Array.isArray(row.respostas) ? (row.respostas as AvaliacaoRender['respostas']) : [], modelo: row.modelo as AvaliacaoRender['modelo'],
    parecer: row.parecer, decisao: row.decisao, observacoes: row.observacoes, dataAvaliacao: row.dataAvaliacao,
  }
}

export async function renderAvaliacao(colaboradorId: string, id: string) {
  const row = await prisma.colaboradorAvaliacao.findFirst({ where: { id, colaboradorId } })
  if (!row) throw new DossieError('Avaliação não encontrada.', 404)
  const snapshot = unpackSnapshot(row.snapshot) ?? (await buildSnapshot(colaboradorId))
  if (!snapshot) throw new DossieError('Colaborador não encontrado.', 404)
  return { buffer: await renderAvaliacaoPdf(snapshot, toRender(row)), row, snapshot }
}

export { fmtDate }
