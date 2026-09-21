import { createHash } from 'crypto'
import { Prisma, type ColaboradorDocumento } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  amendmentLabel, amendmentValueLabel, DOC_TYPES, getDocType, normalizeDados, validateDados,
  type Dados, type DocType,
} from './catalog'
import { fileSlug, fmtCpf, isoDay, parseDateInput } from './format'
import { addHistorico, auditDossie } from './history'
import { buildSnapshot, missing, packSnapshot, unpackSnapshot, AMENDMENT_FIELDS } from './snapshot'
import type { PdfBuilder } from './pdf/engine'
import { renderDocumentInto, renderDocumentPdf } from './pdf/render'
import { readDossieFile, saveDossieFile } from './storage'
import { getTemplate, listCustomTemplates, type LoadedTemplate } from './templates'
import type { Actor, Snapshot } from './types'

export class DossieError extends Error {
  status: number
  details: string[]
  constructor(message: string, status = 400, details: string[] = []) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const CATEGORIAS_ANEXO = ['Documento Pessoal', 'Contrato', 'Aditivo', 'Avaliação', 'Dependente', 'Termo', 'Acordo', 'Comprovante', 'Outro'] as const

const TRANSITIONS: Record<string, string[]> = {
  RASCUNHO: ['CANCELADO'],
  AGUARDANDO_ASSINATURA: ['ASSINADO', 'CANCELADO'],
  ASSINADO: ['VIGENTE', 'FINALIZADO', 'CANCELADO'],
  VIGENTE: ['FINALIZADO', 'CANCELADO'],
  FINALIZADO: [],
  CANCELADO: [],
}

const CUSTOM_PREFIX = 'CUSTOM:'

/** Tipo embutido ou template extra cadastrado no banco (`colab_*`), sem alterar código. */
export async function resolveDocType(tipo: string): Promise<DocType | null> {
  const builtin = getDocType(tipo)
  if (builtin) return builtin
  if (!tipo.startsWith(CUSTOM_PREFIX)) return null
  const key = tipo.slice(CUSTOM_PREFIX.length)
  const custom = (await listCustomTemplates()).find((t) => t.key === key)
  if (!custom) return null
  return {
    tipo, titulo: custom.name, categoria: 'Termo', secao: 'termos', descricao: 'Documento baseado em template institucional.',
    templateKey: key, requires: [{ key: 'nome', label: 'Nome do colaborador' }],
    fields: [{ key: 'observacoes', label: 'Observações (opcional)', type: 'textarea' }],
    signatures: [
      { role: 'COLABORADOR', label: 'Colaborador(a)', name: (s) => s.nome },
      { role: 'RH', label: 'Recursos Humanos' },
    ],
    vars: (_s, d) => ({ observacoes: d.observacoes || '' }),
  }
}

export async function templateFor(type: DocType, version?: number | null): Promise<LoadedTemplate> {
  if (version) {
    const exact = await prisma.documentTemplate.findUnique({ where: { key_version: { key: type.templateKey, version } } })
    if (exact) return { key: exact.key, name: exact.name, version: exact.version, content: exact.content }
  }
  return getTemplate(type.templateKey)
}

export function docTitle(type: DocType, dados: Dados) {
  return type.tipo === 'OUTRO_DOCUMENTO' && dados.titulo ? dados.titulo : type.titulo
}

/** Nome do arquivo: Tipo_NOME_COLABORADOR[_AAAA-MM-DD].pdf, sem acentos nem caracteres perigosos. */
export function docFileName(titulo: string, nome: string, options: { date?: string; matricula?: string } = {}) {
  const base = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim()
    .split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_')
  return [base || 'Documento', fileSlug(nome, 'COLABORADOR'), options.matricula, options.date].filter(Boolean).join('_') + '.pdf'
}

export type Prepared = { type: DocType; snapshot: Snapshot; dados: Dados; errors: string[] }

/** Carrega o retrato atual, normaliza os dados informados e aplica as validações do tipo. */
export async function prepareDocumento(colaboradorId: string, tipo: string, rawDados: unknown): Promise<Prepared> {
  const type = await resolveDocType(tipo)
  if (!type) throw new DossieError('Tipo de documento inválido.', 400)
  if (type.flow === 'aditivo') throw new DossieError('Use o fluxo de aditivo para este documento.', 400)
  const snapshot = await buildSnapshot(colaboradorId)
  if (!snapshot) throw new DossieError('Colaborador não encontrado.', 404)
  const dados = normalizeDados(type, rawDados)
  const errors: string[] = []
  const lacking = missing(snapshot, type.requires)
  if (lacking.length) errors.push(`Complete o cadastro antes de gerar este documento: ${lacking.join(', ')}.`)
  errors.push(...validateDados(type, snapshot, dados))
  return { type, snapshot, dados, errors }
}

export async function previewDocumento(colaboradorId: string, tipo: string, rawDados: unknown, actor: Actor) {
  const prepared = await prepareDocumento(colaboradorId, tipo, rawDados)
  if (prepared.errors.length) throw new DossieError('Não foi possível gerar o documento.', 422, prepared.errors)
  const template = await templateFor(prepared.type)
  const buffer = await renderDocumentPdf({ type: prepared.type, templateContent: template.content, snapshot: prepared.snapshot, dados: prepared.dados, actorName: actor.name })
  return { buffer, title: docTitle(prepared.type, prepared.dados), snapshot: prepared.snapshot }
}

const initialSignatures = (type: DocType, snap: Snapshot, dados: Dados) =>
  type.signatures.map((slot) => ({ role: slot.role, label: slot.label, nome: slot.name?.(snap, dados) ?? null, status: 'PENDENTE', em: null }))

async function persistGenerated(params: {
  colaboradorId: string; type: DocType; snapshot: Snapshot; dados: Dados; actor: Actor
  existingId?: string; origemDocumentoId?: string | null; versao?: number
}) {
  const { colaboradorId, type, snapshot, dados, actor } = params
  const template = await templateFor(type)
  const buffer = await renderDocumentPdf({ type, templateContent: template.content, snapshot, dados, actorName: actor.name })
  const saved = await saveDossieFile(colaboradorId, 'documentos', buffer)
  const hash = createHash('sha256').update(buffer).digest('hex')
  const vigencia = type.vigencia?.(dados) ?? { inicio: null, fim: null }
  const titulo = docTitle(type, dados)
  const data = {
    tipo: type.tipo, categoria: type.categoria, titulo, origem: 'GERADO' as const,
    status: (type.signatures.length ? 'AGUARDANDO_ASSINATURA' : 'VIGENTE') as 'AGUARDANDO_ASSINATURA' | 'VIGENTE',
    templateKey: template.key, templateVersion: template.version,
    dados: dados as Prisma.InputJsonValue, snapshot: packSnapshot(snapshot) as Prisma.InputJsonValue,
    assinaturas: initialSignatures(type, snapshot, dados) as Prisma.InputJsonValue,
    vigenciaInicio: vigencia.inicio, vigenciaFim: vigencia.fim,
    arquivoPath: saved.storagePath, arquivoNome: docFileName(titulo, snapshot.nome, { date: isoDay() }), arquivoMime: 'application/pdf', arquivoTamanho: saved.sizeBytes, hash,
    geradoEm: new Date(), criadoPorId: actor.id, criadoPorNome: actor.name,
  }
  const document = params.existingId
    ? await prisma.colaboradorDocumento.update({ where: { id: params.existingId }, data })
    : await prisma.colaboradorDocumento.create({ data: { colaboradorId, versao: params.versao ?? 1, origemDocumentoId: params.origemDocumentoId ?? null, ...data } })

  await addHistorico({ colaboradorId, tipo: 'DOCUMENTO', dataEvento: new Date(), titulo: `Documento gerado: ${titulo}`, documentoId: document.id, actor })
  const extra = type.historico?.(snapshot, dados)
  if (extra) await addHistorico({ colaboradorId, tipo: extra.tipo, dataEvento: extra.data, titulo: extra.titulo, anterior: extra.anterior, novo: extra.novo, motivo: extra.motivo, documentoId: document.id, actor })
  return document
}

export async function createDocumento(params: { colaboradorId: string; tipo: string; dados: unknown; mode: 'draft' | 'generate'; actor: Actor & { role?: string }; ip?: string | null }) {
  const prepared = await prepareDocumento(params.colaboradorId, params.tipo, params.dados)
  if (params.mode === 'draft') {
    const draft = await prisma.colaboradorDocumento.create({
      data: {
        colaboradorId: params.colaboradorId, tipo: prepared.type.tipo, categoria: prepared.type.categoria, titulo: docTitle(prepared.type, prepared.dados),
        status: 'RASCUNHO', dados: prepared.dados as Prisma.InputJsonValue, templateKey: prepared.type.templateKey,
        criadoPorId: params.actor.id, criadoPorNome: params.actor.name,
      },
    })
    await auditDossie({ actor: params.actor, action: 'CREATE', entity: 'Documento', entityId: draft.id, colaboradorId: params.colaboradorId, ip: params.ip, details: { tipo: prepared.type.tipo, status: 'RASCUNHO' } })
    return draft
  }
  if (prepared.errors.length) throw new DossieError('Não foi possível gerar o documento.', 422, prepared.errors)
  const document = await persistGenerated({ colaboradorId: params.colaboradorId, type: prepared.type, snapshot: prepared.snapshot, dados: prepared.dados, actor: params.actor })
  await auditDossie({ actor: params.actor, action: 'CREATE', entity: 'Documento', entityId: document.id, colaboradorId: params.colaboradorId, ip: params.ip, details: { tipo: prepared.type.tipo, status: document.status, versao: document.versao } })
  return document
}

/** Gera o PDF definitivo de um rascunho (retrato dos dados congelado neste momento). */
export async function generateDraft(params: { colaboradorId: string; documentoId: string; dados?: unknown; actor: Actor & { role?: string }; ip?: string | null }) {
  const draft = await prisma.colaboradorDocumento.findFirst({ where: { id: params.documentoId, colaboradorId: params.colaboradorId } })
  if (!draft) throw new DossieError('Documento não encontrado.', 404)
  if (draft.status !== 'RASCUNHO') throw new DossieError('Apenas rascunhos podem ser gerados.', 409)
  const prepared = await prepareDocumento(params.colaboradorId, draft.tipo, params.dados ?? draft.dados)
  if (prepared.errors.length) throw new DossieError('Não foi possível gerar o documento.', 422, prepared.errors)
  const document = await persistGenerated({ colaboradorId: params.colaboradorId, type: prepared.type, snapshot: prepared.snapshot, dados: prepared.dados, actor: params.actor, existingId: draft.id })
  await auditDossie({ actor: params.actor, action: 'UPDATE', entity: 'Documento', entityId: document.id, colaboradorId: params.colaboradorId, ip: params.ip, details: { acao: 'gerar', tipo: draft.tipo } })
  return document
}

export async function updateDraft(params: { colaboradorId: string; documentoId: string; dados: unknown; actor: Actor & { role?: string }; ip?: string | null }) {
  const draft = await prisma.colaboradorDocumento.findFirst({ where: { id: params.documentoId, colaboradorId: params.colaboradorId } })
  if (!draft) throw new DossieError('Documento não encontrado.', 404)
  if (draft.status !== 'RASCUNHO') throw new DossieError('Documentos já gerados não podem ser editados. Duplique para criar uma nova versão.', 409)
  const type = await resolveDocType(draft.tipo)
  if (!type) throw new DossieError('Tipo de documento inválido.', 400)
  const dados = normalizeDados(type, params.dados)
  const updated = await prisma.colaboradorDocumento.update({ where: { id: draft.id }, data: { dados: dados as Prisma.InputJsonValue, titulo: docTitle(type, dados) } })
  await auditDossie({ actor: params.actor, action: 'UPDATE', entity: 'Documento', entityId: draft.id, colaboradorId: params.colaboradorId, ip: params.ip, details: { acao: 'editar-rascunho' } })
  return updated
}

/** "Duplicar" cria uma nova versão editável (rascunho); o documento original permanece intacto. */
export async function duplicateDocumento(params: { colaboradorId: string; documentoId: string; actor: Actor & { role?: string }; ip?: string | null }) {
  const source = await prisma.colaboradorDocumento.findFirst({ where: { id: params.documentoId, colaboradorId: params.colaboradorId } })
  if (!source) throw new DossieError('Documento não encontrado.', 404)
  if (source.origem === 'ANEXADO') throw new DossieError('Anexos não podem ser duplicados.', 409)
  const copy = await prisma.colaboradorDocumento.create({
    data: {
      colaboradorId: params.colaboradorId, tipo: source.tipo, categoria: source.categoria, titulo: source.titulo, status: 'RASCUNHO',
      dados: (source.dados ?? Prisma.JsonNull) as Prisma.InputJsonValue, templateKey: source.templateKey,
      versao: source.versao + 1, origemDocumentoId: source.id, criadoPorId: params.actor.id, criadoPorNome: params.actor.name,
    },
  })
  await auditDossie({ actor: params.actor, action: 'CREATE', entity: 'Documento', entityId: copy.id, colaboradorId: params.colaboradorId, ip: params.ip, details: { acao: 'duplicar', origem: source.id } })
  return copy
}

export async function changeStatus(params: { colaboradorId: string; documentoId: string; status: string; motivo?: string; actor: Actor & { role?: string }; ip?: string | null }) {
  const document = await prisma.colaboradorDocumento.findFirst({ where: { id: params.documentoId, colaboradorId: params.colaboradorId } })
  if (!document) throw new DossieError('Documento não encontrado.', 404)
  if (!TRANSITIONS[document.status]?.includes(params.status)) throw new DossieError(`Não é possível mudar de ${document.status} para ${params.status}.`, 409)
  const now = new Date()
  const data: Prisma.ColaboradorDocumentoUpdateInput = { status: params.status as ColaboradorDocumento['status'] }
  if (params.status === 'CANCELADO') {
    if (!params.motivo || params.motivo.trim().length < 5) throw new DossieError('Informe o motivo do cancelamento (mínimo de 5 caracteres).', 422)
    data.canceladoEm = now; data.canceladoPorNome = params.actor.name; data.motivoCancelamento = params.motivo.trim().slice(0, 500)
  }
  if (params.status === 'ASSINADO' && Array.isArray(document.assinaturas)) {
    // Registro manual (assinatura física conferida pelo RH). Ponto de extensão para provedor de assinatura digital.
    data.assinaturas = (document.assinaturas as { status: string }[]).map((slot) => ({ ...slot, status: 'ASSINADO', em: now.toISOString(), metodo: 'MANUAL', registradoPor: params.actor.name })) as Prisma.InputJsonValue
  }
  const updated = await prisma.colaboradorDocumento.update({ where: { id: document.id }, data })
  await addHistorico({ colaboradorId: params.colaboradorId, tipo: 'DOCUMENTO', dataEvento: now, titulo: `${document.titulo}: ${params.status === 'CANCELADO' ? 'cancelado' : params.status.toLowerCase().replace(/_/g, ' ')}`, motivo: params.motivo ?? null, documentoId: document.id, actor: params.actor })
  await auditDossie({ actor: params.actor, action: params.status === 'CANCELADO' ? 'DELETE' : 'UPDATE', entity: 'Documento', entityId: document.id, colaboradorId: params.colaboradorId, ip: params.ip, details: { de: document.status, para: params.status } })
  return updated
}

/** Reconstrói o PDF a partir do retrato e da versão de template guardados (usado pelo dossiê). */
export async function renderStored(document: ColaboradorDocumento, actorName = ''): Promise<Buffer | null> {
  const type = await resolveDocType(document.tipo)
  const snapshot = unpackSnapshot(document.snapshot)
  if (!type || !snapshot) return null
  const template = await templateFor(type, document.templateVersion)
  return renderDocumentPdf({ type, templateContent: template.content, snapshot, dados: (document.dados ?? {}) as Dados, actorName, geradoEm: document.geradoEm ?? undefined })
}

/** Desenha um documento gerado dentro de um PDF maior (dossiê), com o retrato e o template originais. */
export async function renderStoredInto(pdf: PdfBuilder, document: ColaboradorDocumento, actorName = ''): Promise<boolean> {
  const type = await resolveDocType(document.tipo)
  const snapshot = unpackSnapshot(document.snapshot)
  if (!type || !snapshot) return false
  const template = await templateFor(type, document.templateVersion)
  renderDocumentInto(pdf, { type, templateContent: template.content, snapshot, dados: (document.dados ?? {}) as Dados, actorName })
  return true
}

export async function readDocumentoFile(document: ColaboradorDocumento): Promise<Buffer | null> {
  if (document.arquivoPath) {
    const stored = await readDossieFile(document.arquivoPath)
    if (stored) return stored
  }
  return document.origem === 'GERADO' ? renderStored(document) : null
}

// ─── Aditivos ─────────────────────────────────────────────────────────────────
export type AditivoInput = {
  tipoAlteracao: string
  valorNovo: string
  valorAnterior?: string
  descricao?: string
  vigencia: string
  motivo: string
  clausulas?: string
}

export async function prepareAditivo(colaboradorId: string, input: AditivoInput) {
  const errors: string[] = []
  const meta = AMENDMENT_FIELDS[input.tipoAlteracao]
  if (!meta) errors.push('Selecione o tipo de alteração.')
  const vigencia = parseDateInput(input.vigencia)
  if (!vigencia) errors.push('Informe a data de vigência do aditivo.')
  const valorNovo = (input.valorNovo ?? '').trim()
  if (!valorNovo) errors.push('Informe a nova informação (o que está sendo alterado).')
  if (!input.motivo?.trim()) errors.push('Informe o motivo da alteração.')
  if (input.tipoAlteracao === 'SALARIO') {
    const n = Number(valorNovo)
    if (!Number.isFinite(n) || n <= 0) errors.push('Informe o novo salário (valor maior que zero).')
  }
  if (['BENEFICIO', 'DIVERSA', 'OUTRO'].includes(input.tipoAlteracao) && !input.descricao?.trim()) errors.push('Descreva a cláusula ou o benefício que está sendo alterado.')
  if (errors.length || !meta || !vigencia) return { errors, snapshot: null, dados: null, type: null, vigencia: null, valorAnterior: '' }

  const type = getDocType('ADITIVO_CONTRATUAL')!
  const previousDay = new Date(vigencia.getTime() - 86_400_000)
  const before = await buildSnapshot(colaboradorId, previousDay)
  const now = await buildSnapshot(colaboradorId)
  if (!before || !now) throw new DossieError('Colaborador não encontrado.', 404)
  const lacking = missing(now, type.requires)
  if (lacking.length) errors.push(`Complete o cadastro antes de gerar o aditivo: ${lacking.join(', ')}.`)
  const field = meta.field
  const current = field ? before[field as keyof Snapshot] : null
  const valorAnterior = field
    ? (current == null ? '' : String(current))
    : (input.valorAnterior ?? '').trim()
  if (field && String(valorAnterior) === valorNovo) errors.push('A nova informação é igual à informação atual.')

  const campoAlterado = ['BENEFICIO', 'DIVERSA', 'OUTRO'].includes(input.tipoAlteracao) ? `${meta.label}: ${input.descricao!.trim()}` : meta.label
  const dados: Dados = {
    campoAlterado, tipoAlteracao: input.tipoAlteracao,
    anteriorFmt: amendmentValueLabel(input.tipoAlteracao, valorAnterior), novoFmt: amendmentValueLabel(input.tipoAlteracao, valorNovo),
    vigencia: input.vigencia, motivo: input.motivo.trim(), clausulas: (input.clausulas ?? '').trim(),
  }
  return { errors, snapshot: now, dados, type, vigencia, valorAnterior }
}

export async function previewAditivo(colaboradorId: string, input: AditivoInput, actor: Actor) {
  const prepared = await prepareAditivo(colaboradorId, input)
  if (prepared.errors.length || !prepared.snapshot || !prepared.dados || !prepared.type) throw new DossieError('Não foi possível gerar o aditivo.', 422, prepared.errors)
  const template = await templateFor(prepared.type)
  return renderDocumentPdf({ type: prepared.type, templateContent: template.content, snapshot: prepared.snapshot, dados: prepared.dados, actorName: actor.name })
}

export async function createAditivo(params: { colaboradorId: string; input: AditivoInput; actor: Actor & { role?: string }; ip?: string | null }) {
  const prepared = await prepareAditivo(params.colaboradorId, params.input)
  if (prepared.errors.length || !prepared.snapshot || !prepared.dados || !prepared.type || !prepared.vigencia) throw new DossieError('Não foi possível gerar o aditivo.', 422, prepared.errors)
  const { snapshot, dados, type, vigencia, valorAnterior } = prepared
  const meta = AMENDMENT_FIELDS[params.input.tipoAlteracao]
  const last = await prisma.colaboradorAditivo.aggregate({ where: { colaboradorId: params.colaboradorId }, _max: { numero: true } })
  const numero = (last._max.numero ?? 0) + 1

  // Aditivos são insert-only: gera o PDF (imutável) e grava documento + aditivo + histórico.
  const document = await persistGenerated({ colaboradorId: params.colaboradorId, type, snapshot, dados, actor: params.actor })
  const aditivo = await prisma.colaboradorAditivo.create({
    data: {
      colaboradorId: params.colaboradorId, documentoId: document.id, numero, tipoAlteracao: params.input.tipoAlteracao,
      campoAlterado: dados.campoAlterado, valorAnterior: valorAnterior || null, valorNovo: params.input.valorNovo.trim(),
      vigencia, motivo: dados.motivo, clausulas: dados.clausulas || null, criadoPorId: params.actor.id, criadoPorNome: params.actor.name,
    },
  })
  await addHistorico({
    colaboradorId: params.colaboradorId, tipo: meta.field ? params.input.tipoAlteracao : 'ADITIVO', dataEvento: vigencia,
    titulo: `Aditivo nº ${numero}: ${dados.campoAlterado}`, anterior: dados.anteriorFmt, novo: dados.novoFmt, motivo: dados.motivo,
    documentoId: document.id, aditivoId: aditivo.id, actor: params.actor,
  })
  await auditDossie({ actor: params.actor, action: 'CREATE', entity: 'Aditivo', entityId: aditivo.id, colaboradorId: params.colaboradorId, ip: params.ip, details: { tipo: params.input.tipoAlteracao, numero } })
  return { document, aditivo }
}

// ─── Anexos ───────────────────────────────────────────────────────────────────
export async function createAnexo(params: {
  colaboradorId: string; buffer: Buffer; originalName: string; categoria: string; titulo?: string; observacao?: string
  actor: Actor & { role?: string }; ip?: string | null
}) {
  if (!(CATEGORIAS_ANEXO as readonly string[]).includes(params.categoria)) throw new DossieError('Categoria inválida.', 422)
  let saved
  try { saved = await saveDossieFile(params.colaboradorId, 'anexos', params.buffer) }
  catch (error) { throw new DossieError(error instanceof Error ? error.message : 'Arquivo inválido.', 422) }
  const cleanName = params.originalName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 90) || 'arquivo'
  const titulo = (params.titulo || cleanName.replace(/\.[a-z0-9]+$/i, '')).slice(0, 120)
  const document = await prisma.colaboradorDocumento.create({
    data: {
      colaboradorId: params.colaboradorId, tipo: 'ANEXO', categoria: params.categoria, titulo, origem: 'ANEXADO', status: 'VIGENTE',
      observacao: params.observacao?.trim().slice(0, 500) || null, arquivoPath: saved.storagePath, arquivoNome: cleanName, arquivoMime: saved.mimeType, arquivoTamanho: saved.sizeBytes,
      hash: createHash('sha256').update(params.buffer).digest('hex'), geradoEm: new Date(), criadoPorId: params.actor.id, criadoPorNome: params.actor.name,
    },
  })
  await addHistorico({ colaboradorId: params.colaboradorId, tipo: 'DOCUMENTO', dataEvento: new Date(), titulo: `Documento anexado: ${titulo} (${params.categoria})`, documentoId: document.id, actor: params.actor })
  await auditDossie({ actor: params.actor, action: 'UPLOAD', entity: 'Documento', entityId: document.id, colaboradorId: params.colaboradorId, ip: params.ip, details: { categoria: params.categoria, tamanho: saved.sizeBytes, mime: saved.mimeType } })
  return document
}

// ─── Metadados para a interface (sem carregar arquivos) ─────────────────────────
export async function catalogFor(colaboradorId: string) {
  const snapshot = await buildSnapshot(colaboradorId)
  if (!snapshot) return null
  const custom = await listCustomTemplates()
  const types = [
    ...DOC_TYPES,
    ...(await Promise.all(custom.map((t) => resolveDocType(`${CUSTOM_PREFIX}${t.key}`)))).filter((t): t is DocType => !!t),
  ]
  return {
    types: types.map((type) => ({
      tipo: type.tipo, titulo: type.titulo, categoria: type.categoria, descricao: type.descricao, flow: type.flow ?? null,
      missing: missing(snapshot, type.requires),
      autoFilled: type.requires.map((r) => r.label.replace(/ \(Dados cadastrais\)/, '')),
      fields: type.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, required: !!f.required, options: f.options ?? null, help: f.help ?? null, default: f.defaultFrom?.(snapshot) ?? '' })),
      signatures: type.signatures.map((s) => s.label),
    })),
    dependentesIr: snapshot.dependentes.filter((d) => d.dependenteIr).length,
    dependentesSf: snapshot.dependentes.filter((d) => d.salarioFamilia).length,
  }
}

export { amendmentLabel, fmtCpf }
