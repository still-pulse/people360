import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { fileSlug } from '@/lib/dossie/format'
import { pdfSafe } from '@/lib/dossie/pdf/engine'
import { generateAdmissionDocuments } from './documentGenerator'
import { isDocumentResolved } from './documentStatus'
import { readPrivateAdmissionFile } from './storage'

export const ACCOUNTING_DOSSIER_GENERATED = 'ACCOUNTING_DOSSIER_GENERATED'
export const ACCOUNTING_DOSSIER_SENT = 'ACCOUNTING_DOSSIER_SENT'

export async function accountingDossierState(admissionId: string) {
  const [events, latestDocument] = await Promise.all([
    prisma.admissionAuditLog.findMany({
      where: { admissionId, action: { in: [ACCOUNTING_DOSSIER_GENERATED, ACCOUNTING_DOSSIER_SENT] } },
      select: { action: true, createdAt: true }, orderBy: { createdAt: 'desc' },
    }),
    prisma.admissionDocument.findFirst({ where: { admissionId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
  ])
  const generated = events.find((event) => event.action === ACCOUNTING_DOSSIER_GENERATED)
  const generatedAt = generated && (!latestDocument || generated.createdAt >= latestDocument.updatedAt) ? generated.createdAt : null
  const sent = generatedAt ? events.find((event) => event.action === ACCOUNTING_DOSSIER_SENT && event.createdAt >= generatedAt) : null
  return { generatedAt, sentAt: sent?.createdAt ?? null, released: !!sent }
}

type LoadedItem = {
  title: string
  section: string
  kind: 'pdf' | 'image' | 'error'
  pages: number
  pdf?: PDFDocument
  bytes?: Buffer
  mime?: string
}

const A4: [number, number] = [595.28, 841.89]
const formatDate = (value: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(value)
const formatDateTime = (value: Date) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(value)

async function loadItem(input: { title: string; section: string; storagePath: string; mime?: string | null }): Promise<LoadedItem> {
  const bytes = await readPrivateAdmissionFile(input.storagePath)
  if (!bytes) return { title: input.title, section: input.section, kind: 'error', pages: 1 }
  try {
    if ((input.mime || '').startsWith('image/')) return { title: input.title, section: input.section, kind: 'image', pages: 1, bytes, mime: input.mime || undefined }
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
    return { title: input.title, section: input.section, kind: 'pdf', pages: Math.max(1, pdf.getPageCount()), pdf }
  } catch {
    return { title: input.title, section: input.section, kind: 'error', pages: 1 }
  }
}

/** Dossiê pré-admissional para conferência da contabilidade, sem depender de Employee no ERPNext. */
export async function buildAccountingAdmissionDossier(admissionId: string, origin: string) {
  await generateAdmissionDocuments(admissionId, origin)
  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    include: {
      unit: { select: { name: true } },
      documents: { include: { type: { select: { name: true, position: true } } }, orderBy: [{ type: { position: 'asc' } }, { createdAt: 'asc' }] },
      // Contabilidade recebe só o formulário admissional; contrato e termos ficam de fora.
      generatedDocuments: { where: { status: { not: 'CANCELLED' }, storagePath: { not: null }, template: { key: 'ficha_registro' } }, include: { template: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!admission) throw new Error('Admissão não encontrada.')
  if (admission.processType !== 'ADMISSION') throw new Error('O dossiê para contabilidade está disponível somente para admissões.')
  const pending = admission.documents.filter((document) => !isDocumentResolved(document.status))
  if (pending.length) throw new Error(`Ainda existem ${pending.length} documento(s) sem aprovação do RH.`)

  const inputs = [
    ...admission.generatedDocuments.flatMap((document) => document.storagePath ? [{ title: document.template.name, section: 'Formulário admissional', storagePath: document.storagePath, mime: 'application/pdf' }] : []),
    ...admission.documents.flatMap((document) => document.status === 'APPROVED' && document.storagePath ? [{ title: document.type.name, section: 'Documentos enviados e aprovados', storagePath: document.storagePath, mime: document.mimeType }] : []),
  ]
  if (!inputs.length) throw new Error('Nenhum documento disponível para compor o dossiê.')
  const items = await Promise.all(inputs.map(loadItem))

  const output = await PDFDocument.create()
  const regular = await output.embedFont(StandardFonts.Helvetica)
  const bold = await output.embedFont(StandardFonts.HelveticaBold)
  const teal = rgb(15 / 255, 155 / 255, 142 / 255)
  const dark = rgb(18 / 255, 41 / 255, 44 / 255)
  const muted = rgb(93 / 255, 110 / 255, 113 / 255)
  const createdAt = new Date()

  const cover = output.addPage(A4)
  cover.drawRectangle({ x: 0, y: A4[1] - 18, width: A4[0], height: 18, color: teal })
  cover.drawText('DOSSIÊ PRÉ-ADMISSIONAL', { x: 52, y: 690, size: 24, font: bold, color: dark })
  cover.drawText('CONFERÊNCIA DA CONTABILIDADE', { x: 52, y: 660, size: 12, font: bold, color: teal })
  const rows = [
    ['Colaborador', admission.candidateName], ['Protocolo', admission.protocol], ['Cargo', admission.jobTitle],
    ['Departamento', admission.department || '—'], ['Unidade', admission.unit.name], ['Admissão prevista', formatDate(admission.hireDate)],
    ['Tipo de contrato', admission.contractType], ['Documentos no pacote', String(items.length)], ['Gerado em', formatDateTime(createdAt)],
  ]
  rows.forEach(([label, value], index) => {
    const y = 600 - index * 43
    cover.drawText(pdfSafe(label.toUpperCase()), { x: 52, y, size: 8, font: bold, color: muted })
    cover.drawText(pdfSafe(value), { x: 52, y: y - 17, size: 12, font: regular, color: dark, maxWidth: 490 })
  })

  const rowsPerIndexPage = 32
  const indexPages = Math.max(1, Math.ceil(items.length / rowsPerIndexPage))
  let itemPage = 1 + indexPages + 1
  for (let pageIndex = 0; pageIndex < indexPages; pageIndex++) {
    const page = output.addPage(A4)
    page.drawText(pageIndex ? 'ÍNDICE — CONTINUAÇÃO' : 'ÍNDICE DO DOSSIÊ', { x: 44, y: 790, size: 17, font: bold, color: dark })
    page.drawLine({ start: { x: 44, y: 778 }, end: { x: 551, y: 778 }, thickness: 1, color: teal })
    const slice = items.slice(pageIndex * rowsPerIndexPage, (pageIndex + 1) * rowsPerIndexPage)
    slice.forEach((item, row) => {
      const globalIndex = pageIndex * rowsPerIndexPage + row
      const previous = items[globalIndex - 1]
      const y = 750 - row * 22
      const sectionPrefix = !previous || previous.section !== item.section ? `${item.section}: ` : ''
      const title = pdfSafe(`${sectionPrefix}${item.title}`).slice(0, 92)
      page.drawText(title, { x: 44, y, size: 9, font: sectionPrefix ? bold : regular, color: dark })
      page.drawText(String(itemPage), { x: 545, y, size: 9, font: bold, color: teal })
      itemPage += item.pages
    })
  }

  for (const item of items) {
    if (item.kind === 'pdf' && item.pdf) {
      for (const page of await output.copyPages(item.pdf, item.pdf.getPageIndices())) output.addPage(page)
      continue
    }
    const page = output.addPage(A4)
    page.drawText(pdfSafe(item.title), { x: 44, y: 790, size: 14, font: bold, color: dark })
    if (item.kind === 'image' && item.bytes) {
      const image = item.mime === 'image/png' ? await output.embedPng(item.bytes) : await output.embedJpg(item.bytes)
      const scale = Math.min(500 / image.width, 690 / image.height, 1)
      const width = image.width * scale, height = image.height * scale
      page.drawImage(image, { x: (A4[0] - width) / 2, y: 70 + (690 - height) / 2, width, height })
    } else {
      page.drawText('Não foi possível incorporar este arquivo. Consulte o original no People360.', { x: 44, y: 750, size: 10, font: regular, color: muted })
    }
  }

  const totalPages = output.getPageCount()
  output.getPages().forEach((page, index) => {
    const footer = pdfSafe(`People360 • Dossiê pré-admissional • Página ${index + 1} de ${totalPages}`)
    page.drawText(footer, { x: 44, y: 18, size: 7, font: regular, color: muted })
  })
  const bytes = await output.save()
  return {
    buffer: Buffer.from(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength),
    fileName: `Dossie_Pre_Admissional_${fileSlug(admission.candidateName, 'COLABORADOR')}_${admission.protocol}.pdf`,
    pages: totalPages,
    documents: items.length,
  }
}
