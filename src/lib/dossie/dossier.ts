import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ColaboradorAvaliacao, ColaboradorDocumento } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'
import { decryptPdf } from '@/lib/pdfCompress'
import { renderTextAdmissionForm } from '@/lib/admission/documentGenerator'
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
import { employeeDocumentHistory } from './documentHistory'
import { findLinkedAdmissionId } from './perfil'
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
export type AttachmentSource = { titulo: string; categoria: string; data: Date; situacao: string; mime: string; read: () => Promise<Buffer | null> }
type Attachment = { src: AttachmentSource; kind: 'pdf' | 'image' | 'error' | 'skipped'; pdf?: PDFDocument; bytes?: Buffer; pages: number }
type Item = { key: number; kind: 'doc'; row: ColaboradorDocumento; titulo: string } | { key: number; kind: 'aval'; row: ColaboradorAvaliacao; titulo: string }

const docDate = (row: ColaboradorDocumento) => (row.vigenciaInicio ?? row.geradoEm ?? row.createdAt).getTime()
const A4 = { w: 595.28, h: 841.89 }

const ANEXO_MAX_BYTES = 50 * 1024 * 1024
const ANEXO_MAX_PAGES = 500

/** Anexos que passam do limite entram como página de aviso — o dossiê nunca deixa de ser gerado por excesso. */
async function loadAttachments(sources: AttachmentSource[], strictLegal = false): Promise<Attachment[]> {
  const maxBytes = strictLegal ? 200 * 1024 * 1024 : ANEXO_MAX_BYTES
  const maxPages = strictLegal ? 1000 : ANEXO_MAX_PAGES
  const out: Attachment[] = []
  let loadedBytes = 0
  let pages = 0
  for (const src of sources) {
    const bytes = await src.read().catch(() => null)
    if (!bytes) {
      if (strictLegal) throw new DossieError(`Não foi possível ler “${src.titulo}”. O dossiê jurídico não foi gerado para evitar documentos ausentes.`, 422)
      out.push({ src, kind: 'error', pages: 1 }); pages += 1; continue
    }
    if (loadedBytes + bytes.length > maxBytes || pages >= maxPages) {
      if (strictLegal) throw new DossieError('O dossiê jurídico excedeu o limite de 200 MB / 1.000 páginas. Nenhum PDF incompleto foi gerado.', 422)
      out.push({ src, kind: 'skipped', pages: 1 }); pages += 1; continue
    }
    try {
      if (src.mime === 'application/pdf') {
        let pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
        // PDF protegido: sem remover a proteção, as páginas copiadas saem em branco.
        if (pdf.isEncrypted) {
          const decrypted = await decryptPdf(bytes)
          if (!decrypted) {
            if (strictLegal) throw new DossieError(`Não foi possível abrir o PDF protegido “${src.titulo}”.`, 422)
            out.push({ src, kind: 'error', pages: 1 }); pages += 1; continue
          }
          pdf = await PDFDocument.load(decrypted)
        }
        const count = Math.max(1, pdf.getPageCount())
        if (pages + count > maxPages) {
          if (strictLegal) throw new DossieError('O dossiê jurídico excedeu o limite de 1.000 páginas. Nenhum PDF incompleto foi gerado.', 422)
          out.push({ src, kind: 'skipped', pages: 1 }); pages += 1; continue
        }
        pages += count; loadedBytes += bytes.length
        out.push({ src, kind: 'pdf', pdf, pages: count })
      } else { pages += 1; loadedBytes += bytes.length; out.push({ src, kind: 'image', bytes, pages: 1 }) }
    } catch (error) {
      if (strictLegal) throw error instanceof DossieError ? error : new DossieError(`Não foi possível incorporar “${src.titulo}”. O dossiê jurídico não foi gerado.`, 422)
      out.push({ src, kind: 'error', pages: 1 }); pages += 1
    }
  }
  return out
}

const SITUACAO: Record<string, string> = {
  APPROVED: 'Aprovado', NOT_APPLICABLE: 'Não se aplica', REJECTED: 'Reprovado', RESUBMISSION_REQUIRED: 'Reenvio solicitado', UPLOADED: 'Em análise', UNDER_REVIEW: 'Em análise',
  PROCESSING: 'Em análise', SIGNED: 'Assinado', GENERATED: 'Gerado', VIGENTE: 'Vigente', ASSINADO: 'Assinado',
}

/**
 * Todos os documentos enviados na plataforma (admissões e atualizações cadastrais, com as versões anteriores),
 * contratos assinados e anexos do dossiê. Cópias importadas da admissão ficam de fora para não duplicar.
 */
async function platformAttachments(colaborador: { id: string; erpnextId: string; cpf: string | null }, documents: ColaboradorDocumento[]): Promise<AttachmentSource[]> {
  const history = await employeeDocumentHistory(colaborador)
  const signed = new Set(history.filter((f) => f.id.startsWith('signed-')).map((f) => f.id.slice('signed-'.length)))
  const fromPlatform = history
    .filter((f) => f.id.startsWith('upload-') || f.id.startsWith('revision-') || f.id.startsWith('signed-') || (f.id.startsWith('generated-') && !signed.has(f.id.slice('generated-'.length))))
    .map((f): AttachmentSource => ({
      titulo: `${f.title}${f.previous ? ` — versão ${f.version} (anterior)` : f.version > 1 ? ` — versão ${f.version}` : ''}`,
      categoria: `${f.origin}${f.protocol ? ` ${f.protocol}` : ''}`,
      data: new Date(f.date), situacao: SITUACAO[f.status] ?? f.status, mime: f.mimeType, read: f.read,
    }))
  const anexos = documents.filter((d) => d.origem === 'ANEXADO' && !d.admissaoOrigemId).map((d): AttachmentSource => ({
    titulo: d.titulo, categoria: d.categoria, data: d.createdAt, situacao: d.criadoPorNome ? `Enviado por ${d.criadoPorNome}` : '—',
    mime: d.arquivoMime || 'application/pdf', read: async () => (d.arquivoPath ? readDossieFile(d.arquivoPath) : null),
  }))
  return [...fromPlatform, ...anexos].sort((a, b) => a.data.getTime() - b.data.getTime())
}

/**
 * Arquivos que pertencem exclusivamente ao processo admissional que originou o colaborador.
 * O formulário assinado tem precedência sobre o original e, dos documentos enviados pelo
 * candidato, entram apenas as versões atuais aprovadas pelo RH (nunca revisões rejeitadas).
 */
async function admissionAttachments(colaborador: { erpnextId: string; cpf: string | null }) {
  const admissionId = await findLinkedAdmissionId(colaborador)
  if (!admissionId) throw new DossieError('Este colaborador não possui uma admissão digital vinculada.', 422)
  return admissionDossierSources(admissionId)
}

/** Formulário admissional e documentos aprovados de uma admissão (usado também antes da integração com o ERPNext). */
export async function admissionDossierSources(admissionId: string) {
  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: {
      protocol: true,
      documents: {
        where: { status: 'APPROVED', storagePath: { not: null } },
        include: { type: { select: { name: true, position: true } } },
        orderBy: [{ type: { position: 'asc' } }, { createdAt: 'asc' }],
      },
      createdAt: true,
      generatedDocuments: {
        where: { template: { key: 'ficha_registro' }, status: { not: 'CANCELLED' } },
        include: { template: { select: { name: true, content: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!admission) throw new DossieError('A admissão digital vinculada não foi encontrada.', 422)

  // Todas as versões válidas do formulário (ex.: o "Formulário Admissional" em texto já assinado e a ficha
  // oficial "Registro de Empregado"), da mais antiga para a mais nova, cada uma na versão assinada quando houver.
  const formulario: AttachmentSource[] = admission.generatedDocuments
    .filter((doc) => !!(doc.signedStoragePath ?? doc.storagePath))
    .reverse()
    .map((doc) => ({
      titulo: `${doc.template.name}${doc.signedStoragePath ? ' (assinado)' : ''}`,
      categoria: `Admissão ${admission.protocol}`,
      data: doc.signedAt ?? doc.generatedAt ?? doc.createdAt,
      situacao: doc.signedStoragePath ? 'Assinado' : (SITUACAO[doc.status] ?? doc.status),
      mime: 'application/pdf',
      read: () => readPrivateAdmissionFile(doc.signedStoragePath ?? doc.storagePath!),
    }))
  // Admissões feitas depois da ficha oficial não têm o "Formulário Admissional" em texto: ele é montado na hora
  // (o template de layout guarda um texto descritivo que começa com "Documento oficial").
  const hasTextForm = admission.generatedDocuments.some((doc) => !doc.template.content.startsWith('Documento oficial'))
  if (!hasTextForm) formulario.unshift({
    titulo: 'Formulário Admissional', categoria: `Admissão ${admission.protocol}`, data: admission.createdAt,
    situacao: 'Gerado', mime: 'application/pdf', read: () => renderTextAdmissionForm(admissionId),
  })
  const documentos: AttachmentSource[] = admission.documents.map((doc) => ({
    titulo: `${doc.type.name}${doc.side ? ` (${doc.side})` : ''}`,
    categoria: `Admissão ${admission.protocol}`,
    data: doc.reviewedAt ?? doc.uploadedAt ?? doc.createdAt,
    situacao: SITUACAO[doc.status] ?? doc.status,
    mime: doc.mimeType || 'application/pdf',
    read: () => readPrivateAdmissionFile(doc.storagePath!),
  }))
  return { formulario, documentos }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export type CoverInfo = Pick<Snapshot, 'nome' | 'matricula' | 'cargo' | 'unidade' | 'admissao'>

function drawCover(pdf: PdfBuilder, snap: CoverInfo, photo: ColaboradorPhoto | null, geradoEm: Date, title = 'DOSSIÊ FUNCIONAL DO COLABORADOR', identifier = `Matrícula: ${snap.matricula}`) {
  const { doc } = pdf
  pdf.skipChrome(1)
  doc.setFillColor(...BRAND.teal); doc.rect(0, 0, PAGE.w, 10, 'F')
  doc.setFillColor(...BRAND.tealDark); doc.rect(0, PAGE.h - 22, PAGE.w, 22, 'F')
  const logoH = 26
  const logoW = 493 * (logoH / 258)
  pdf.drawLogo((PAGE.w - logoW) / 2, 28, logoH)
  pdf.textAt(BRAND.instituicao.replace('BHCL – ', ''), PAGE.w / 2, 66, { size: 11, color: BRAND.muted, align: 'center' })
  pdf.textAt(title, PAGE.w / 2, 88, { size: 21, bold: true, color: BRAND.tealDark, align: 'center' })
  doc.setDrawColor(...BRAND.teal); doc.setLineWidth(0.8); doc.line(PAGE.w / 2 - 22, 94, PAGE.w / 2 + 22, 94)
  const pw = 44, ph = 58, px = (PAGE.w - pw) / 2, py = 106
  if (photo) pdf.photo(photo.buffer, photo.mime, px, py, pw, ph)
  else pdf.photoPlaceholder(px, py, pw, ph, initials(snap.nome))
  pdf.textAt(snap.nome.toUpperCase(), PAGE.w / 2, 182, { size: 17, bold: true, align: 'center' })
  pdf.textAt(identifier, PAGE.w / 2, 191, { size: 11, color: BRAND.muted, align: 'center' })
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

async function appendAttachments(main: Buffer, attachments: Attachment[], totalPages: number, mainPages: number, docLabel = 'Dossiê Funcional') {
  const out = await PDFDocument.load(main)
  const font = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)
  const teal = rgb(15 / 255, 155 / 255, 142 / 255)
  const tag = (page: ReturnType<typeof out.addPage>, att: Attachment, first: boolean, note?: string) => {
    if (!first) return
    const label = pdfSafe(`Anexo — ${att.src.titulo} (${att.src.categoria})`).slice(0, 110)
    // Na margem superior: mais abaixo, a etiqueta ficava em cima do título dos formulários anexados.
    page.drawText(label, { x: 28, y: page.getHeight() - 9, size: 6.5, font: bold, color: teal })
    if (note) page.drawText(pdfSafe(note), { x: 28, y: page.getHeight() - 36, size: 8, font, color: rgb(0.36, 0.43, 0.44) })
  }
  for (const att of attachments) {
    if (att.kind === 'pdf' && att.pdf) {
      const copied = await out.copyPages(att.pdf, att.pdf.getPageIndices())
      copied.forEach((page, index) => { out.addPage(page); tag(page, att, index === 0) })
    } else if (att.kind === 'image' && att.bytes) {
      const page = out.addPage([A4.w, A4.h])
      const image = att.src.mime === 'image/png' ? await out.embedPng(att.bytes) : await out.embedJpg(att.bytes)
      const maxW = A4.w - 56, maxH = A4.h - 110
      const scale = Math.min(maxW / image.width, maxH / image.height, 1.5)
      const w = image.width * scale, h = image.height * scale
      page.drawImage(image, { x: (A4.w - w) / 2, y: (A4.h - 60 - h) / 2 + 30, width: w, height: h })
      tag(page, att, true)
    } else {
      const page = out.addPage([A4.w, A4.h])
      tag(page, att, true, att.kind === 'skipped'
        ? 'Arquivo não incorporado: o dossiê atingiu o limite de 50 MB / 500 páginas de anexos. Consulte o arquivo original no People360.'
        : 'Não foi possível incorporar este arquivo ao dossiê (ausente, corrompido ou protegido por senha). Consulte o arquivo original no People360.')
    }
  }
  // Rodapé com paginação nas páginas de anexos (as demais já receberam o rodapé institucional).
  out.getPages().forEach((page, index) => {
    if (index < mainPages) return
    const text = pdfSafe(`People360 • ${docLabel} • ${BRAND.instituicao}`)
    page.drawText(text, { x: 28, y: 12, size: 6.5, font, color: rgb(0.36, 0.43, 0.44) })
    const label = `Página ${index + 1} de ${totalPages}`
    page.drawText(label, { x: page.getWidth() - 28 - bold.widthOfTextAtSize(label, 7.5), y: 12, size: 7.5, font: bold, color: rgb(0.04, 0.44, 0.4) })
  })
  return Buffer.from(await out.save())
}

/** Gera capa, índice, formulário admissional e os documentos enviados pelo colaborador. */
export async function buildAdmissionDossierPdf(params: { colaboradorId: string; actorName: string }) {
  const snap = await buildSnapshot(params.colaboradorId)
  if (!snap) throw new Error('Colaborador não encontrado.')
  const colaborador = await prisma.colaborador.findUniqueOrThrow({
    where: { id: params.colaboradorId }, select: { erpnextId: true, cpf: true, imagePath: true },
  })
  const [photo, sources] = await Promise.all([
    loadColaboradorPhoto(colaborador),
    admissionAttachments(colaborador),
  ])
  const { buffer, pages } = await renderAdmissionDossier({ info: snap, photo, sources })
  const fileName = `Dossie_Admissional_${fileSlug(snap.nome, 'COLABORADOR')}_${snap.matricula.replace(/[^a-zA-Z0-9]/g, '')}.pdf`
  return { buffer, fileName, pages, snapshot: snap }
}

/** Layout do Dossiê Admissional, compartilhado pelo colaborador já integrado e pela pré-admissão (contabilidade). */
export async function renderAdmissionDossier(params: {
  info: CoverInfo
  photo: ColaboradorPhoto | null
  sources: { formulario: AttachmentSource[]; documentos: AttachmentSource[]; certificados?: AttachmentSource[] }
  identifier?: string
  juridico?: boolean
}) {
  const { info, photo, sources } = params
  const loaded = await loadAttachments([...sources.formulario, ...sources.documentos, ...(sources.certificados ?? [])], params.juridico)
  const formulario = loaded.slice(0, sources.formulario.length)
  const documentos = loaded.slice(sources.formulario.length, sources.formulario.length + sources.documentos.length)
  const certificados = loaded.slice(sources.formulario.length + sources.documentos.length)
  if (!formulario.length && !params.juridico) throw new DossieError('O formulário admissional ainda não está disponível para este colaborador.', 422)
  const attachments = [...formulario, ...documentos, ...certificados]
  if (!formulario.length && !documentos.length) throw new DossieError('Ainda não há contratos ou termos assinados disponíveis para o dossiê jurídico.', 422)
  const attachmentPages = attachments.reduce((sum, item) => sum + item.pages, 0)
  const geradoEm = new Date()
  const docLabel = params.juridico ? 'Dossiê Jurídico' : 'Dossiê Admissional'
  const pdf = new PdfBuilder({ docLabel, colaboradorNome: info.nome, matricula: info.matricula || undefined, geradoEm }, await loadLogo())

  drawCover(pdf, info, photo, geradoEm, params.juridico ? 'DOSSIÊ JURÍDICO DO COLABORADOR' : 'DOSSIÊ ADMISSIONAL DO COLABORADOR', params.identifier)
  const indexLines = (formulario.length ? 1 + (params.juridico ? formulario.length : 0) : 0) + (documentos.length ? 1 + documentos.length : 0) + (certificados.length ? 1 + certificados.length : 0)
  const perIndexPage = Math.floor((PAGE.bottom - PAGE.top - 16) / 6.4)
  const indexPages = Math.max(1, Math.ceil(indexLines / perIndexPage))
  for (let index = 0; index < indexPages; index++) pdf.newPage()
  let attachmentPage = pdf.page + 1
  const formPage = attachmentPage
  attachmentPage += formulario.reduce((sum, item) => sum + item.pages, 0)
  const entries: IndexEntry[] = []
  if (formulario.length) {
    let page = formPage
    entries.push({ numero: '01', titulo: params.juridico ? 'Contratos, aditivos e acordos' : 'Formulário admissional', page: formPage,
      sub: params.juridico ? formulario.map(item => { const entry = { titulo: item.src.titulo, page }; page += item.pages; return entry }) : [] })
  }
  if (documentos.length) {
    const documentEntry: IndexEntry = { numero: String(entries.length + 1).padStart(2, '0'), titulo: params.juridico ? 'Termos, declarações e normas' : 'Documentos do colaborador', page: attachmentPage, sub: [] }
    for (const item of documentos) {
      documentEntry.sub.push({ titulo: item.src.titulo, page: attachmentPage })
      attachmentPage += item.pages
    }
    entries.push(documentEntry)
  }
  if (certificados.length) {
    const entry: IndexEntry = { numero: String(entries.length + 1).padStart(2, '0'), titulo: 'Comprovantes de assinatura', page: attachmentPage, sub: [] }
    for (const item of certificados) {
      entry.sub.push({ titulo: item.src.titulo, page: attachmentPage })
      attachmentPage += item.pages
    }
    entries.push(entry)
  }
  const mainPages = pdf.page
  drawIndex(pdf, entries, 2, indexPages)
  const total = mainPages + attachmentPages
  let buffer = pdf.finalize({ totalPages: total })
  if (attachments.length) buffer = await appendAttachments(buffer, attachments, total, mainPages, docLabel)
  return { buffer, pages: total, documents: attachments.length }
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
  const attachments = valid.has('documentos_anexados') ? await loadAttachments(await platformAttachments({ id: params.colaboradorId, erpnextId: colaborador.erpnextId, cpf: colaborador.cpf }, documents)) : []
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
      head: ['Documento', 'Origem', 'Data', 'Situação', 'Página'], widths: [58, 34, 20, 34, 14], empty: 'Nenhum documento enviado.',
      rows: attachments.map((a) => { const row = [a.src.titulo, a.src.categoria, fmtDate(a.src.data), a.src.situacao, String(page)]; entry.sub.push({ titulo: a.src.titulo, page }); page += a.pages; return row }),
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
