import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ColaboradorAvaliacao, ColaboradorDocumento } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decryptAdmissionText } from '@/lib/admission/security'
import { decryptAdmissionValue } from '@/lib/admission/security'
import { fileSlug, fmtCpf, fmtDate, fmtDateTime, fmtMoney } from './format'
import { getDocType, SECOES } from './catalog'
import { DossieError, renderStoredInto, resolveDocType } from './documentos'
import { HISTORY_TYPES } from './history'
import { loadColaboradorPhoto, type ColaboradorPhoto } from './photo'
import { BRAND, loadLogo, PAGE, PdfBuilder, pdfSafe } from './pdf/engine'
import { renderAvaliacaoInto, type AvaliacaoRender } from './pdf/render'
import { toRender } from './avaliacoes'
import { buildSnapshot, unpackSnapshot } from './snapshot'
import { loadTimeline, TIMELINE_GROUPS, type TimelineRow } from './timeline'
import { readDossieFile } from './storage'
import type { Snapshot } from './types'

/** Itens do modal "Gerar Dossiê do Colaborador". */
export const SELECAO = [
  { id: 'dados_cadastrais', label: 'Dados cadastrais' },
  { id: 'foto', label: 'Foto do colaborador' },
  { id: 'informacoes_funcionais', label: 'Informações funcionais' },
  { id: 'contrato_trabalho', label: 'Contrato de trabalho' },
  { id: 'contrato_experiencia', label: 'Contrato de experiência' },
  { id: 'prorrogacoes', label: 'Prorrogações do contrato de experiência' },
  { id: 'efetivacao', label: 'Efetivação do contrato de experiência' },
  { id: 'avaliacoes', label: 'Avaliações do período de experiência' },
  { id: 'aditivos', label: 'Aditivos contratuais' },
  { id: 'acordos', label: 'Acordos individuais' },
  { id: 'dependentes', label: 'Dependentes' },
  { id: 'termos', label: 'Termos de responsabilidade e declarações' },
  { id: 'normas_ponto', label: 'Normas de cartão de ponto' },
  { id: 'historico_alteracoes', label: 'Histórico de alterações' },
  { id: 'historico_salarial', label: 'Histórico salarial' },
  { id: 'historico_cargo', label: 'Histórico de cargo' },
  { id: 'historico_jornada', label: 'Histórico de jornada / escala / horário' },
  { id: 'historico_unidade', label: 'Histórico de unidade / setor' },
  { id: 'documentos_anexados', label: 'Documentos anexados' },
] as const
export const SELECAO_IDS: string[] = SELECAO.map((s) => s.id)

type IndexEntry = { numero: string; titulo: string; page: number; sub: { titulo: string; page: number }[] }
type Attachment = { row: ColaboradorDocumento; kind: 'pdf' | 'image' | 'error'; pdf?: PDFDocument; bytes?: Buffer; pages: number }
type Item = { key: number; kind: 'doc'; row: ColaboradorDocumento; titulo: string } | { key: number; kind: 'aval'; row: ColaboradorAvaliacao; titulo: string }

const docDate = (row: ColaboradorDocumento) => (row.vigenciaInicio ?? row.geradoEm ?? row.createdAt).getTime()
const A4 = { w: 595.28, h: 841.89 }

async function loadAttachments(rows: ColaboradorDocumento[]): Promise<Attachment[]> {
  const out: Attachment[] = []
  const maxBytes = 50 * 1024 * 1024
  const declaredBytes = rows.reduce((total, row) => total + (row.arquivoTamanho ?? 0), 0)
  if (declaredBytes > maxBytes) throw new DossieError('Os anexos selecionados excedem o limite de 50 MB por exportação.', 413)
  let loadedBytes = 0
  let pages = 0
  for (const row of rows) {
    const bytes = row.arquivoPath ? await readDossieFile(row.arquivoPath) : null
    if (!bytes) { out.push({ row, kind: 'error', pages: 1 }); continue }
    loadedBytes += bytes.length
    if (loadedBytes > maxBytes) throw new DossieError('Os anexos selecionados excedem o limite de 50 MB por exportação.', 413)
    try {
      if (row.arquivoMime === 'application/pdf') {
        const pdf = await PDFDocument.load(bytes)
        const count = Math.max(1, pdf.getPageCount()); pages += count
        out.push({ row, kind: 'pdf', pdf, pages: count })
      } else { pages += 1; out.push({ row, kind: 'image', bytes, pages: 1 }) }
      if (pages > 500) throw new DossieError('Os anexos selecionados excedem o limite de 500 páginas por exportação.', 413)
    } catch (error) {
      if (error instanceof DossieError) throw error
      out.push({ row, kind: 'error', pages: 1 })
    }
  }
  return out
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function drawCover(pdf: PdfBuilder, snap: Snapshot, photo: ColaboradorPhoto | null, geradoEm: Date) {
  const { doc } = pdf
  pdf.skipChrome(1)
  doc.setFillColor(...BRAND.teal); doc.rect(0, 0, PAGE.w, 10, 'F')
  doc.setFillColor(...BRAND.tealDark); doc.rect(0, PAGE.h - 22, PAGE.w, 22, 'F')
  const logoH = 26
  const logoW = 493 * (logoH / 258)
  pdf.drawLogo((PAGE.w - logoW) / 2, 28, logoH)
  pdf.textAt(BRAND.instituicao.replace('BHCL – ', ''), PAGE.w / 2, 66, { size: 11, color: BRAND.muted, align: 'center' })
  pdf.textAt('DOSSIÊ FUNCIONAL DO COLABORADOR', PAGE.w / 2, 88, { size: 21, bold: true, color: BRAND.tealDark, align: 'center' })
  doc.setDrawColor(...BRAND.teal); doc.setLineWidth(0.8); doc.line(PAGE.w / 2 - 22, 94, PAGE.w / 2 + 22, 94)
  const pw = 44, ph = 58, px = (PAGE.w - pw) / 2, py = 106
  if (photo) pdf.photo(photo.buffer, photo.mime, px, py, pw, ph)
  else pdf.photoPlaceholder(px, py, pw, ph, initials(snap.nome))
  pdf.textAt(snap.nome.toUpperCase(), PAGE.w / 2, 182, { size: 17, bold: true, align: 'center' })
  pdf.textAt(`Matrícula: ${snap.matricula}`, PAGE.w / 2, 191, { size: 11, color: BRAND.muted, align: 'center' })
  const lines: [string, string][] = [['Cargo', snap.cargo], ['Unidade', snap.unidade], ['Admissão', fmtDate(snap.admissao)]]
  lines.forEach(([label, value], i) => {
    pdf.textAt(label.toUpperCase(), PAGE.w / 2, 208 + i * 13, { size: 7.5, bold: true, color: BRAND.faint, align: 'center' })
    pdf.textAt(value || '—', PAGE.w / 2, 213.5 + i * 13, { size: 11.5, align: 'center' })
  })
  pdf.textAt('Documento gerado através do People360', PAGE.w / 2, PAGE.h - 13, { size: 9.5, bold: true, color: [255, 255, 255], align: 'center' })
  pdf.textAt(`Gerado em ${fmtDateTime(geradoEm)}`, PAGE.w / 2, PAGE.h - 8, { size: 8, color: [210, 235, 232], align: 'center' })
}

function drawIdentity(pdf: PdfBuilder, snap: Snapshot, photo: ColaboradorPhoto | null, showPhoto: boolean) {
  const x = PAGE.ml, y = pdf.y
  if (showPhoto) {
    if (photo) pdf.photo(photo.buffer, photo.mime, x, y, 30, 40)
    else pdf.photoPlaceholder(x, y, 30, 40, initials(snap.nome))
  }
  const tx = showPhoto ? x + 36 : x
  pdf.textAt(snap.nome.toUpperCase(), tx, y + 6, { size: 14, bold: true })
  pdf.textAt(`Matrícula ${snap.matricula} · ${snap.situacao}`, tx, y + 12.5, { size: 9.5, color: BRAND.muted })
  pdf.textAt(snap.cargo || '—', tx, y + 20, { size: 11, bold: true, color: BRAND.tealDark })
  pdf.textAt([snap.setor, snap.unidade].filter(Boolean).join(' · ') || '—', tx, y + 26, { size: 9.5, color: BRAND.muted })
  pdf.textAt(`Admissão em ${fmtDate(snap.admissao)}`, tx, y + 32, { size: 9.5, color: BRAND.muted })
  pdf.y = y + (showPhoto ? 46 : 38)
}

function funcionais(snap: Snapshot): [string, string][] {
  return [
    ['Matrícula', snap.matricula], ['Data de admissão', fmtDate(snap.admissao)], ['Cargo', snap.cargo], ['Função', snap.funcao],
    ['Setor', snap.setor], ['Unidade', snap.unidade], ['Centro de custo', snap.centroCusto], ['CBO', snap.cbo],
    ['Tipo de contrato', snap.tipoContrato], ['Salário', fmtMoney(snap.salario)], ['Jornada', snap.jornada], ['Escala', snap.escala],
    ['Horário', snap.horario], ['Sindicato', snap.sindicato], ['Gestor imediato', snap.gestor], ['Situação', snap.situacao],
    ['Última alteração contratual', snap.ultimaAlteracao ? fmtDate(snap.ultimaAlteracao) : '—'],
  ]
}

function drawDadosCadastrais(pdf: PdfBuilder, snap: Snapshot) {
  pdf.title('DADOS CADASTRAIS')
  pdf.heading('Dados pessoais')
  pdf.kv([
    ['Nome completo', snap.nome], ['Nome social', snap.nomeSocial], ['CPF', fmtCpf(snap.cpf)],
    ['RG', [snap.rg, snap.rgOrgao, snap.rgUf].filter(Boolean).join(' / ')], ['Emissão do RG', snap.rgEmissao],
    ['PIS/PASEP', snap.pis], ['CTPS', [snap.ctpsNumero, snap.ctpsSerie && `série ${snap.ctpsSerie}`, snap.ctpsUf].filter(Boolean).join(' · ')],
    ['Data de nascimento', fmtDate(snap.nascimento)], ['Sexo', snap.sexo], ['Estado civil', snap.estadoCivil],
    ['Nacionalidade', snap.nacionalidade], ['Naturalidade', snap.naturalidade], ['Escolaridade', snap.escolaridade],
    ['Nome da mãe', snap.nomeMae], ['Nome do pai', snap.nomePai], ['Telefone', snap.telefone], ['E-mail', snap.email],
  ])
  pdf.heading('Endereço')
  const e = snap.endereco
  pdf.kv([['CEP', e.cep ?? ''], ['Logradouro', e.logradouro ?? ''], ['Número', e.numero ?? ''], ['Complemento', e.complemento ?? ''], ['Bairro', e.bairro ?? ''], ['Cidade / UF', [e.cidade, e.uf].filter(Boolean).join(' / ')]])
  pdf.heading('Dados bancários')
  pdf.kv([['Banco', snap.banco.banco], ['Agência', snap.banco.agencia], ['Conta', snap.banco.conta]], 3)
}

type DependenteRow = { nome: string; cpf: string; nascimento: string; parentesco: string; dependenteIr: boolean; salarioFamilia: boolean; planoSaude: boolean; exclusaoEm: Date | null }

function dependentesTable(rows: DependenteRow[]) {
  const yn = (v: boolean) => (v ? 'Sim' : 'Não')
  return {
    head: ['Nome', 'CPF', 'Nascimento', 'Parentesco', 'IR', 'Sal. família', 'Plano', 'Status'], widths: [38, 27, 19, 25, 12, 17, 14, 22],
    empty: 'Nenhum dependente cadastrado.',
    rows: rows.map((d) => [d.nome, fmtCpf(d.cpf), fmtDate(d.nascimento), d.parentesco, yn(d.dependenteIr), yn(d.salarioFamilia), yn(d.planoSaude), d.exclusaoEm ? `Excluído em ${fmtDate(d.exclusaoEm)}` : 'Ativo']),
  }
}

function timelineTable(rows: TimelineRow[], docTitles: Map<string, string>, mode: 'geral' | 'salario' | 'cargo' | 'outro') {
  const doc = (r: TimelineRow) => (r.documentoId && docTitles.get(r.documentoId)) || '—'
  if (mode === 'salario') return { head: ['Data', 'Salário anterior', 'Novo salário', 'Motivo', 'Documento', 'Responsável'], widths: [20, 27, 27, 38, 34, 28], empty: 'Nenhuma alteração salarial registrada.', rows: rows.map((r) => [fmtDate(r.dataEvento), r.anterior || '—', r.novo || '—', r.motivo || '—', doc(r), r.responsavelNome || '—']) }
  if (mode === 'cargo') return { head: ['Data', 'Anterior', 'Novo', 'Motivo', 'Documento', 'Responsável'], widths: [20, 30, 30, 36, 32, 27], empty: 'Nenhuma alteração registrada.', rows: rows.map((r) => [fmtDate(r.dataEvento), r.anterior || '—', r.novo || '—', r.motivo || '—', doc(r), r.responsavelNome || '—']) }
  if (mode === 'outro') return { head: ['Data', 'Alteração', 'Anterior', 'Novo', 'Motivo'], widths: [20, 38, 34, 34, 48], empty: 'Nenhuma alteração registrada.', rows: rows.map((r) => [fmtDate(r.dataEvento), r.tipoLabel, r.anterior || '—', r.novo || '—', r.motivo || '—']) }
  return { head: ['Data', 'Evento', 'Informação anterior', 'Informação nova', 'Responsável', 'Documento'], widths: [19, 44, 29, 29, 26, 27], empty: 'Nenhum evento registrado.', rows: rows.map((r) => [fmtDate(r.dataEvento), r.titulo, r.anterior || '—', r.novo || '—', r.responsavelNome || '—', doc(r)]) }
}

function drawIndex(pdf: PdfBuilder, entries: IndexEntry[], firstPage: number, pages: number) {
  const perPage = Math.floor((PAGE.bottom - PAGE.top - 16) / 6.4)
  const flat: { text: string; page: number; sub: boolean; numero?: string }[] = []
  for (const e of entries) {
    flat.push({ text: e.titulo, page: e.page, sub: false, numero: e.numero })
    for (const s of e.sub) flat.push({ text: s.titulo, page: s.page, sub: true })
  }
  const saved = { page: pdf.page, y: pdf.y }
  flat.forEach((line, index) => {
    const pageIndex = Math.floor(index / perPage)
    if (pageIndex >= pages) return
    pdf.doc.setPage(firstPage + pageIndex)
    const row = index % perPage
    const y = PAGE.top + 16 + row * 6.4
    if (row === 0 && pageIndex === 0) {
      pdf.textAt('ÍNDICE', PAGE.ml, PAGE.top + 4, { size: 15, bold: true })
      pdf.doc.setDrawColor(...BRAND.teal); pdf.doc.setLineWidth(0.7); pdf.doc.line(PAGE.ml, PAGE.top + 8, PAGE.w - PAGE.mr, PAGE.top + 8)
    }
    if (line.sub) {
      pdf.textAt(line.text.length > 88 ? `${line.text.slice(0, 85)}...` : line.text, PAGE.ml + 14, y, { size: 8.5, color: BRAND.muted })
    } else {
      pdf.textAt(line.numero ?? '', PAGE.ml, y, { size: 10.5, bold: true, color: BRAND.teal })
      pdf.textAt(line.text, PAGE.ml + 10, y, { size: 10.5, bold: true })
    }
    // linha pontilhada até o número da página
    pdf.doc.setDrawColor(...BRAND.border); pdf.doc.setLineWidth(0.2)
    pdf.doc.setLineDashPattern([0.6, 1.2], 0)
    const textW = pdf.doc.getTextWidth(pdfSafe(line.text)) + (line.sub ? 16 : 12)
    pdf.doc.line(PAGE.ml + textW + 2, y - 0.6, PAGE.w - PAGE.mr - 10, y - 0.6)
    pdf.doc.setLineDashPattern([], 0)
    pdf.textAt(String(line.page), PAGE.w - PAGE.mr, y, { size: line.sub ? 8.5 : 10.5, bold: !line.sub, color: line.sub ? BRAND.muted : BRAND.tealDark, align: 'right' })
  })
  pdf.doc.setPage(saved.page)
  pdf.y = saved.y
}

async function appendAttachments(main: Buffer, attachments: Attachment[], totalPages: number, mainPages: number) {
  const out = await PDFDocument.load(main)
  const font = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)
  const teal = rgb(15 / 255, 155 / 255, 142 / 255)
  const tag = (page: ReturnType<typeof out.addPage>, att: Attachment, first: boolean, note?: string) => {
    if (!first) return
    const label = pdfSafe(`Anexo — ${att.row.titulo} (${att.row.categoria})`).slice(0, 110)
    page.drawText(label, { x: 28, y: page.getHeight() - 22, size: 8, font: bold, color: teal })
    if (note) page.drawText(pdfSafe(note), { x: 28, y: page.getHeight() - 36, size: 8, font, color: rgb(0.36, 0.43, 0.44) })
  }
  for (const att of attachments) {
    if (att.kind === 'pdf' && att.pdf) {
      const copied = await out.copyPages(att.pdf, att.pdf.getPageIndices())
      copied.forEach((page, index) => { out.addPage(page); tag(page, att, index === 0) })
    } else if (att.kind === 'image' && att.bytes) {
      const page = out.addPage([A4.w, A4.h])
      const image = att.row.arquivoMime === 'image/png' ? await out.embedPng(att.bytes) : await out.embedJpg(att.bytes)
      const maxW = A4.w - 56, maxH = A4.h - 110
      const scale = Math.min(maxW / image.width, maxH / image.height, 1.5)
      const w = image.width * scale, h = image.height * scale
      page.drawImage(image, { x: (A4.w - w) / 2, y: (A4.h - 60 - h) / 2 + 30, width: w, height: h })
      tag(page, att, true)
    } else {
      const page = out.addPage([A4.w, A4.h])
      tag(page, att, true, 'Não foi possível incorporar este arquivo ao dossiê (ausente ou corrompido).')
    }
  }
  // Rodapé com paginação nas páginas de anexos (as demais já receberam o rodapé institucional).
  out.getPages().forEach((page, index) => {
    if (index < mainPages) return
    const text = pdfSafe(`People360 • Dossiê Funcional • ${BRAND.instituicao}`)
    page.drawText(text, { x: 28, y: 12, size: 6.5, font, color: rgb(0.36, 0.43, 0.44) })
    const label = `Página ${index + 1} de ${totalPages}`
    page.drawText(label, { x: page.getWidth() - 28 - bold.widthOfTextAtSize(label, 7.5), y: 12, size: 7.5, font: bold, color: rgb(0.04, 0.44, 0.4) })
  })
  return Buffer.from(await out.save())
}

export async function buildDossierPdf(params: { colaboradorId: string; selecao: string[]; actorName: string }) {
  const valid = new Set(params.selecao.filter((id) => SELECAO_IDS.includes(id)))
  if (!valid.size) throw new Error('Selecione ao menos um item para compor o dossiê.')
  const snap = await buildSnapshot(params.colaboradorId)
  if (!snap) throw new Error('Colaborador não encontrado.')
  const colaborador = await prisma.colaborador.findUniqueOrThrow({ where: { id: params.colaboradorId }, select: { erpnextId: true, cpf: true, imagePath: true } })

  const [documents, avaliacoes, aditivos, dependentes, allTimeline] = await Promise.all([
    prisma.colaboradorDocumento.findMany({ where: { colaboradorId: params.colaboradorId, status: { notIn: ['CANCELADO', 'RASCUNHO'] } }, orderBy: { createdAt: 'asc' } }),
    prisma.colaboradorAvaliacao.findMany({ where: { colaboradorId: params.colaboradorId, status: 'FINALIZADA' }, orderBy: { dataAvaliacao: 'asc' } }),
    prisma.colaboradorAditivo.findMany({ where: { colaboradorId: params.colaboradorId }, orderBy: [{ vigencia: 'asc' }, { numero: 'asc' }], include: { documento: { select: { status: true } } } }),
    prisma.colaboradorDependente.findMany({ where: { colaboradorId: params.colaboradorId }, orderBy: [{ exclusaoEm: 'asc' }, { nascimento: 'asc' }] }),
    loadTimeline(params.colaboradorId, { take: 1000, admissao: snap.admissao ? new Date(snap.admissao) : null }),
  ])
  const photo = valid.has('foto') ? await loadColaboradorPhoto(colaborador) : null
  const geradoEm = new Date()
  const docTitles = new Map(documents.map((d) => [d.id, d.titulo]))
  const generated = documents.filter((d) => d.origem === 'GERADO')

  // Agrupa os documentos gerados nas seções e junta avaliações à linha do tempo contratual.
  const bySecao = new Map<string, ColaboradorDocumento[]>()
  for (const row of generated) {
    const type = await resolveDocType(row.tipo)
    const secao = type?.secao ?? getDocType(row.tipo)?.secao ?? 'termos'
    if (!valid.has(secao)) continue
    bySecao.set(secao, [...(bySecao.get(secao) ?? []), row])
  }
  const contratoItems: Item[] = [
    ...['contrato_trabalho', 'contrato_experiencia', 'prorrogacoes', 'efetivacao'].flatMap((secao) => bySecao.get(secao) ?? []).map((row): Item => ({ key: docDate(row), kind: 'doc', row, titulo: row.titulo })),
    ...(valid.has('avaliacoes') ? avaliacoes.map((row): Item => ({ key: row.dataAvaliacao.getTime(), kind: 'aval', row, titulo: row.tipo === 'AUTOAVALIACAO' ? 'Autoavaliação de experiência' : `Avaliação de experiência${row.periodoDias ? ` — ${row.periodoDias} dias` : ''}` })) : []),
  ].sort((a, b) => a.key - b.key)
  const docItems = (secoes: string[]): Item[] => secoes.flatMap((s) => bySecao.get(s) ?? []).sort((a, b) => docDate(a) - docDate(b)).map((row): Item => ({ key: docDate(row), kind: 'doc', row, titulo: row.titulo }))
  const aditivoItems = docItems(['aditivos']), acordoItems = docItems(['acordos']), termoItems = docItems(['termos', 'normas_ponto'])
  const attachments = valid.has('documentos_anexados') ? await loadAttachments(documents.filter((d) => d.origem === 'ANEXADO')) : []
  const attachmentPages = attachments.reduce((sum, a) => sum + a.pages, 0)

  // Seções previstas (para reservar as páginas do índice antes de renderizar).
  const wantsIdentity = valid.has('foto') || valid.has('informacoes_funcionais')
  const historyBlocks = ['historico_alteracoes', 'historico_salarial', 'historico_cargo', 'historico_jornada', 'historico_unidade'].filter((id) => valid.has(id))
  const plan = [
    wantsIdentity, valid.has('dados_cadastrais'), valid.has('dependentes'), contratoItems.length > 0, aditivoItems.length > 0 || (valid.has('aditivos') && aditivos.length > 0),
    acordoItems.length > 0, termoItems.length > 0, historyBlocks.length > 0, attachments.length > 0 || valid.has('documentos_anexados'),
  ]
  const subCount = contratoItems.length + aditivoItems.length + acordoItems.length + termoItems.length
  const lines = plan.filter(Boolean).length + subCount
  const perPage = Math.floor((PAGE.bottom - PAGE.top - 16) / 6.4)
  const indexPages = Math.max(1, Math.ceil(lines / perPage))

  const pdf = new PdfBuilder({ docLabel: 'Dossiê Funcional', colaboradorNome: snap.nome, matricula: snap.matricula, geradoEm }, await loadLogo())
  drawCover(pdf, snap, photo, geradoEm)
  for (let i = 0; i < indexPages; i++) pdf.newPage()
  const entries: IndexEntry[] = []
  let counter = 0
  const start = (titulo: string) => {
    counter += 1
    pdf.newPage()
    const entry: IndexEntry = { numero: String(counter).padStart(2, '0'), titulo, page: pdf.page, sub: [] }
    entries.push(entry)
    return entry
  }

  const renderItems = async (entry: IndexEntry, items: Item[], firstPageUsed: boolean) => {
    let first = firstPageUsed
    for (const item of items) {
      if (first) pdf.newPage()
      first = true
      entry.sub.push({ titulo: item.titulo, page: pdf.page })
      if (item.kind === 'doc') await renderStoredInto(pdf, item.row, params.actorName)
      else {
        const rowSnap = unpackSnapshot(item.row.snapshot) ?? snap
        renderAvaliacaoInto(pdf, rowSnap, toRender(item.row) as AvaliacaoRender)
      }
    }
  }

  if (wantsIdentity) {
    start('Identificação')
    pdf.title('FICHA DE REGISTRO DO COLABORADOR')
    drawIdentity(pdf, snap, photo, valid.has('foto'))
    if (valid.has('informacoes_funcionais')) { pdf.heading('Informações funcionais'); pdf.kv(funcionais(snap)) }
  }
  if (valid.has('dados_cadastrais')) { start('Dados cadastrais'); drawDadosCadastrais(pdf, snap) }
  if (valid.has('dependentes')) {
    start('Dependentes')
    pdf.title('DEPENDENTES')
    pdf.table(dependentesTable(dependentes.map((d) => ({ ...unpackDependente(d) }))))
  }
  if (contratoItems.length) {
    const entry = start('Contratos e período de experiência')
    await renderItems(entry, contratoItems, false)
  }
  if (aditivoItems.length || (valid.has('aditivos') && aditivos.length)) {
    const entry = start('Aditivos contratuais')
    pdf.title('HISTÓRICO DE ADITIVOS CONTRATUAIS')
    pdf.table({
      head: ['Nº', 'Vigência', 'Alteração', 'Anterior', 'Nova informação', 'Motivo'], widths: [9, 20, 36, 33, 33, 43], empty: 'Nenhum aditivo registrado.',
      rows: aditivos.filter((a) => a.documento?.status === 'VIGENTE').map((a) => { const anterior = decryptAdmissionText(a.valorAnterior); const novo = decryptAdmissionText(a.valorNovo); return [String(a.numero), fmtDate(a.vigencia), decryptAdmissionText(a.campoAlterado) || '—', a.tipoAlteracao === 'SALARIO' ? fmtMoney(anterior) : (anterior || '—'), a.tipoAlteracao === 'SALARIO' ? fmtMoney(novo) : (novo || '—'), decryptAdmissionText(a.motivo) || '—'] }),
    })
    await renderItems(entry, aditivoItems, true)
  }
  if (acordoItems.length) { const entry = start('Acordos individuais'); await renderItems(entry, acordoItems, false) }
  if (termoItems.length) { const entry = start('Termos e declarações'); await renderItems(entry, termoItems, false) }
  if (historyBlocks.length) {
    start('Histórico funcional')
    pdf.title('HISTÓRICO FUNCIONAL')
    const filter = (grupo: string) => allTimeline.items.filter((r) => TIMELINE_GROUPS[grupo].includes(r.tipo))
    if (valid.has('historico_alteracoes')) { pdf.heading('Linha do tempo'); pdf.table(timelineTable(allTimeline.items, docTitles, 'geral')) }
    if (valid.has('historico_salarial')) { pdf.heading('Histórico salarial'); pdf.table(timelineTable(filter('salario'), docTitles, 'salario')) }
    if (valid.has('historico_cargo')) { pdf.heading('Histórico de cargo e função'); pdf.table(timelineTable(filter('cargo'), docTitles, 'cargo')) }
    if (valid.has('historico_jornada')) { pdf.heading('Histórico de jornada, escala e horário'); pdf.table(timelineTable(filter('jornada'), docTitles, 'outro')) }
    if (valid.has('historico_unidade')) { pdf.heading('Histórico de unidade, setor e centro de custo'); pdf.table(timelineTable(filter('unidade'), docTitles, 'outro')) }
  }
  if (valid.has('documentos_anexados')) {
    const entry = start('Documentos complementares')
    pdf.title('DOCUMENTOS COMPLEMENTARES')
    let page = pdf.page + 1
    pdf.table({
      head: ['Documento', 'Categoria', 'Data', 'Enviado por', 'Página'], widths: [58, 28, 22, 40, 14], empty: 'Nenhum documento anexado.',
      rows: attachments.map((a) => { const row = [a.row.titulo, a.row.categoria, fmtDate(a.row.createdAt), a.row.criadoPorNome || '—', String(page)]; entry.sub.push({ titulo: a.row.titulo, page }); page += a.pages; return row }),
    })
  }

  const mainPages = pdf.page
  drawIndex(pdf, entries, 2, indexPages)
  const total = mainPages + attachmentPages
  let buffer = pdf.finalize({ totalPages: total })
  if (attachments.length) buffer = await appendAttachments(buffer, attachments, total, mainPages)
  const fileName = `Dossie_Funcional_${fileSlug(snap.nome, 'COLABORADOR')}_${snap.matricula.replace(/[^a-zA-Z0-9]/g, '')}.pdf`
  return { buffer, fileName, pages: total, snapshot: snap }
}

function unpackDependente(row: { nome: string; cpfCifrado: unknown; cpfMascarado: string | null; nascimento: Date; parentesco: string; dependenteIr: boolean; salarioFamilia: boolean; planoSaude: boolean; exclusaoEm: Date | null }): DependenteRow {
  const cpf = decryptAdmissionValue(row.cpfCifrado)
  return { nome: row.nome, cpf: typeof cpf === 'string' ? cpf : (row.cpfMascarado || ''), nascimento: row.nascimento.toISOString(), parentesco: row.parentesco, dependenteIr: row.dependenteIr, salarioFamilia: row.salarioFamilia, planoSaude: row.planoSaude, exclusaoEm: row.exclusaoEm }
}

export { HISTORY_TYPES, SECOES }
