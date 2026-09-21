import { commonVars, type Dados, type DocType, type TableBlock } from '../catalog'
import { fmtDate } from '../format'
import type { AutoavaliacaoModelo, AvaliacaoModelo } from '../templateDefaults'
import type { Snapshot } from '../types'
import { BRAND, loadLogo, PdfBuilder, type Meta } from './engine'

/** `{{var}}`: ausente → "—"; string vazia permanece vazia (permite blocos opcionais). */
export function interpolate(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key: string) => (key in vars ? vars[key] : '—'))
}

const KV_LINE = /^([A-Za-zÀ-ÿ0-9º°ª()/ -]{2,42}?):\s+(\S.*)$/

/** Converte o texto de um template (marcação leve) em blocos do PDF. Só layout: nenhum texto contratual aqui. */
export function renderMarkup(pdf: PdfBuilder, content: string, vars: Record<string, string>, blocks: Record<string, TableBlock> = {}) {
  const text = interpolate(content, vars)
  let previousBlank = false
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) { if (!previousBlank) pdf.space(1.6); previousBlank = true; continue }
    previousBlank = false
    if (line.startsWith('# ')) pdf.title(line.slice(2))
    else if (line.startsWith('## ')) pdf.heading(line.slice(3))
    else if (line.startsWith('- ')) pdf.bullet(line.slice(2))
    else if (/^\[\[tabela:([a-z_]+)\]\]$/.test(line.trim())) {
      const block = blocks[line.trim().slice(9, -2)]
      if (block) pdf.table(block)
    } else {
      const kv = KV_LINE.exec(line)
      if (kv && line.length < 170 && !/[.;]$/.test(kv[1])) pdf.labelLine(kv[1], kv[2])
      else pdf.paragraph(line, { justify: line.length > 110 })
    }
  }
}

export type RenderDocInput = {
  type: DocType
  templateContent: string
  snapshot: Snapshot
  dados: Dados
  actorName?: string
}

/** Corpo de um documento (título + texto do template + tabelas + assinaturas) dentro de um PdfBuilder. */
export function renderDocumentInto(pdf: PdfBuilder, input: RenderDocInput) {
  const { type, templateContent, snapshot, dados } = input
  const vars = { ...commonVars(snapshot, input.actorName), ...dados, ...(type.vars?.(snapshot, dados) ?? {}) }
  renderMarkup(pdf, templateContent, vars, type.blocks?.(snapshot, dados) ?? {})
  pdf.signatures(type.signatures.map((slot) => ({ label: slot.label, name: slot.name?.(snapshot, dados) })))
}

/** PDF individual de um documento (preview e arquivo definitivo). */
export async function renderDocumentPdf(input: RenderDocInput & { geradoEm?: Date; label?: string }): Promise<Buffer> {
  const meta: Meta = {
    docLabel: input.label ?? input.type.titulo, colaboradorNome: input.snapshot.nome,
    matricula: input.snapshot.matricula, geradoEm: input.geradoEm ?? new Date(),
  }
  const pdf = new PdfBuilder(meta, await loadLogo())
  renderDocumentInto(pdf, input)
  return pdf.finalize()
}

// ─── Avaliações ───────────────────────────────────────────────────────────────
export type AvaliacaoRender = {
  tipo: string
  periodoDias: number | null
  periodoInicio: Date | null
  periodoFim: Date | null
  avaliadorNome: string | null
  respostas: { id: string; valor?: string; comentario?: string }[]
  modelo: AvaliacaoModelo | AutoavaliacaoModelo
  parecer: string | null
  decisao: string | null
  observacoes: string | null
  dataAvaliacao: Date
}

function identificacao(pdf: PdfBuilder, snap: Snapshot, av: AvaliacaoRender) {
  pdf.kv([
    ['Colaborador', snap.nome], ['Matrícula', snap.matricula], ['Cargo', snap.cargo], ['Unidade', snap.unidade],
    ['Gestor', snap.gestor], ['Admissão', fmtDate(snap.admissao)],
    ['Período avaliado', av.periodoInicio && av.periodoFim ? `${fmtDate(av.periodoInicio)} a ${fmtDate(av.periodoFim)}` : '—'],
    ['Data da avaliação', fmtDate(av.dataAvaliacao)],
  ], 2)
}

export function renderAvaliacaoInto(pdf: PdfBuilder, snap: Snapshot, av: AvaliacaoRender) {
  const isSelf = av.tipo === 'AUTOAVALIACAO'
  pdf.title(isSelf ? 'AUTOAVALIAÇÃO DO COLABORADOR — PERÍODO DE EXPERIÊNCIA' : `AVALIAÇÃO DO PERÍODO DE EXPERIÊNCIA${av.periodoDias ? ` — ${av.periodoDias} DIAS` : ''}`)
  identificacao(pdf, snap, av)
  const answers = new Map(av.respostas.map((r) => [r.id, r]))

  if (isSelf) {
    const modelo = av.modelo as AutoavaliacaoModelo
    const label = (list: { valor: string; rotulo: string }[], value?: string) => list.find((o) => o.valor === value)?.rotulo ?? (value || '—')
    pdf.heading('Questionário')
    pdf.table({
      head: ['Pergunta', 'Resposta'], widths: [80, 94],
      rows: modelo.perguntas.map((q) => {
        const r = answers.get(q.id)
        const value = q.tipo === 'texto' ? (r?.comentario || r?.valor || '—')
          : `${label(q.tipo === 'sim_nao' ? modelo.escalaSimNao : modelo.escala, r?.valor)}${r?.comentario ? ` — ${r.comentario}` : ''}`
        return [q.rotulo, value]
      }),
    })
  } else {
    const modelo = av.modelo as AvaliacaoModelo
    pdf.heading('Critérios de avaliação')
    pdf.table({
      head: ['Critério', 'Conceito', 'Comentário do avaliador'], widths: [58, 34, 82],
      rows: modelo.criterios.map((c) => {
        const r = answers.get(c.id)
        return [c.rotulo, modelo.escala.find((o) => o.valor === r?.valor)?.rotulo ?? '—', r?.comentario || '—']
      }),
    })
  }

  pdf.heading(isSelf ? 'Parecer final do colaborador' : 'Parecer do gestor')
  pdf.paragraph(av.parecer || '—')
  if (!isSelf) {
    const modelo = av.modelo as AvaliacaoModelo
    pdf.heading('Decisão')
    for (const option of modelo.decisoes) pdf.paragraph(`${av.decisao === option.valor ? '(X)' : '( )'} ${option.rotulo}`, { gap: 0.6 })
  }
  if (av.observacoes) { pdf.heading('Observações'); pdf.paragraph(av.observacoes) }
  pdf.labelLine(isSelf ? 'Colaborador' : 'Responsável pela avaliação', isSelf ? snap.nome : (av.avaliadorNome || '—'))
  pdf.signatures(isSelf
    ? [{ label: 'Colaborador(a)', name: snap.nome }, { label: 'Gestor(a) responsável', name: snap.gestor }]
    : [{ label: 'Gestor(a) / Avaliador(a)', name: av.avaliadorNome || snap.gestor }, { label: 'Recursos Humanos' }, { label: 'Colaborador(a)', name: snap.nome }])
}

export async function renderAvaliacaoPdf(snap: Snapshot, av: AvaliacaoRender): Promise<Buffer> {
  const pdf = new PdfBuilder({
    docLabel: av.tipo === 'AUTOAVALIACAO' ? 'Autoavaliação de Experiência' : `Avaliação de Experiência${av.periodoDias ? ` — ${av.periodoDias} dias` : ''}`,
    colaboradorNome: snap.nome, matricula: snap.matricula, geradoEm: new Date(),
  }, await loadLogo())
  renderAvaliacaoInto(pdf, snap, av)
  return pdf.finalize()
}

export { BRAND }
