import { readFile } from 'fs/promises'
import path from 'path'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtDateTime } from '../format'

// ─── Identidade visual BHCL ──────────────────────────────────────────────────
export const BRAND = {
  teal: [15, 155, 142] as const,
  tealDark: [10, 111, 102] as const,
  tealSoft: [232, 246, 244] as const,
  ink: [29, 43, 46] as const,
  muted: [93, 110, 113] as const,
  faint: [157, 174, 176] as const,
  border: [226, 232, 231] as const,
  zebra: [246, 249, 249] as const,
  instituicao: 'BHCL – Beneficência Hospitalar de Cesário Lange',
}

export const PAGE = { w: 210, h: 297, ml: 18, mr: 18, top: 34, bottom: 273, cw: 174 }

type RGB = readonly [number, number, number]
export type Meta = { docLabel: string; colaboradorNome?: string; matricula?: string; geradoEm: Date }
export type TableInput = { head: string[]; rows: string[][]; widths?: number[]; empty?: string }

// Área útil do logotipo dentro do PNG (o arquivo tem margens brancas amplas).
const LOGO = { srcW: 701, srcH: 356, x: 105, y: 52, w: 493, h: 258 }
let logoCache: string | null | undefined

export async function loadLogo(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache
  try {
    const buffer = await readFile(path.join(process.cwd(), 'public', 'bhcl-admissao-logo.png'))
    logoCache = `data:image/png;base64,${buffer.toString('base64')}`
  } catch {
    logoCache = null
  }
  return logoCache
}

/** Remove/normaliza caracteres que a fonte Helvetica padrão (WinAnsi) não codifica. */
export function pdfSafe(text: string): string {
  return text
    .replace(/[\u2010-\u2012]/g, '-').replace(/\u2015/g, '\u2014').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2192/g, '->').replace(/\u00A0/g, ' ').replace(/\t/g, ' ')
    .replace(/[^\u0009\u000A\u0020-\u007E\u00A0-\u00FF\u2013\u2014\u2022\u2026]/g, '?')
}

export class PdfBuilder {
  doc: jsPDF
  y: number = PAGE.top
  private noChrome = new Set<number>()
  sections: { id: string; titulo: string; page: number }[] = []

  constructor(public meta: Meta, private logo: string | null) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    this.doc.setProperties({ title: meta.docLabel, author: 'People360', creator: 'People360' })
    this.doc.setFont('helvetica', 'normal')
  }

  get page() { return this.doc.getNumberOfPages() }

  // ─── controle de página ───────────────────────────────────────────────────
  /** Página sem cabeçalho/rodapé (capa). */
  skipChrome(page: number = this.page) { this.noChrome.add(page) }

  /** Texto em posição absoluta (capa, cartão de identificação). */
  textAt(text: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'center' | 'right'; italic?: boolean } = {}) {
    this.font(!!o.bold, o.size ?? 9.5, o.color ?? BRAND.ink, !!o.italic)
    this.doc.text(pdfSafe(text), x, y, { align: o.align ?? 'left' })
  }

  newPage(withChrome = true) {
    this.doc.addPage()
    if (!withChrome) this.noChrome.add(this.page)
    this.y = PAGE.top
  }

  /** Inicia uma seção em página nova (a primeira reaproveita a página atual se estiver vazia). */
  beginSection(id: string, titulo: string, fresh = true) {
    if (fresh && this.y > PAGE.top + 0.1) this.newPage()
    this.sections.push({ id, titulo, page: this.page })
  }

  ensure(height: number) {
    if (this.y + height > PAGE.bottom) this.newPage()
  }

  space(mm: number) { this.y += mm }

  private color(rgb: RGB) { this.doc.setTextColor(rgb[0], rgb[1], rgb[2]) }
  private font(bold = false, size = 9.5, rgb: RGB = BRAND.ink, italic = false) {
    this.doc.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'))
    this.doc.setFontSize(size)
    this.color(rgb)
  }
  private lineHeight(size: number) { return size * 0.3528 * 1.38 }

  // ─── blocos de texto ──────────────────────────────────────────────────────
  title(text: string) {
    const lines = this.doc.splitTextToSize(pdfSafe(text), PAGE.cw - 10) as string[]
    this.font(true, 14.5, BRAND.ink)
    const height = lines.length * this.lineHeight(14.5) + 6
    this.ensure(height + 8)
    this.doc.text(lines, PAGE.w / 2, this.y + 5, { align: 'center' })
    this.y += height
    this.doc.setDrawColor(...BRAND.teal); this.doc.setLineWidth(0.7)
    this.doc.line(PAGE.ml, this.y, PAGE.w - PAGE.mr, this.y)
    this.y += 6
  }

  subtitle(text: string) {
    this.font(false, 9, BRAND.muted, true)
    this.ensure(8)
    this.doc.text(pdfSafe(text), PAGE.w / 2, this.y, { align: 'center' })
    this.y += 6
  }

  heading(text: string) {
    this.ensure(14)
    this.y += 2.5
    this.doc.setFillColor(...BRAND.teal)
    this.doc.rect(PAGE.ml, this.y - 3.6, 1.4, 5, 'F')
    this.font(true, 10.5, BRAND.tealDark)
    this.doc.text(pdfSafe(text), PAGE.ml + 3.4, this.y)
    this.y += 5.2
  }

  paragraph(text: string, opts: { justify?: boolean; size?: number; gap?: number; indent?: number; color?: RGB; bold?: boolean; italic?: boolean } = {}) {
    const size = opts.size ?? 9.5
    const indent = opts.indent ?? 0
    const width = PAGE.cw - indent
    this.font(!!opts.bold, size, opts.color ?? BRAND.ink, !!opts.italic)
    const lines = this.doc.splitTextToSize(pdfSafe(text), width) as string[]
    const lh = this.lineHeight(size)
    lines.forEach((line, index) => {
      this.ensure(lh)
      this.font(!!opts.bold, size, opts.color ?? BRAND.ink, !!opts.italic)
      const justify = opts.justify && index < lines.length - 1 && line.includes(' ')
      if (justify) this.doc.text(line, PAGE.ml + indent, this.y, { align: 'justify', maxWidth: width })
      else this.doc.text(line, PAGE.ml + indent, this.y)
      this.y += lh
    })
    this.y += opts.gap ?? 1.6
  }

  /** "Rótulo: valor" com o rótulo em negrito. */
  labelLine(label: string, value: string, gap = 1) {
    const size = 9.5
    this.font(true, size)
    const labelText = pdfSafe(`${label}: `)
    const labelWidth = this.doc.getTextWidth(labelText)
    this.font(false, size)
    const lines = this.doc.splitTextToSize(pdfSafe(value || '—'), PAGE.cw - labelWidth) as string[]
    const lh = this.lineHeight(size)
    lines.forEach((line, index) => {
      this.ensure(lh)
      if (index === 0) { this.font(true, size); this.doc.text(labelText, PAGE.ml, this.y) }
      this.font(false, size)
      this.doc.text(line, PAGE.ml + (index === 0 ? labelWidth : labelWidth), this.y)
      this.y += lh
    })
    this.y += gap
  }

  bullet(text: string) {
    const lines = this.doc.splitTextToSize(pdfSafe(text), PAGE.cw - 8) as string[]
    const lh = this.lineHeight(9.5)
    lines.forEach((line, index) => {
      this.ensure(lh)
      this.font(false, 9.5)
      if (index === 0) { this.doc.setFillColor(...BRAND.teal); this.doc.circle(PAGE.ml + 2.2, this.y - 1.1, 0.6, 'F') }
      this.doc.text(line, PAGE.ml + 6, this.y)
      this.y += lh
    })
    this.y += 1
  }

  note(text: string) {
    this.font(false, 8.5, BRAND.muted, true)
    const lines = this.doc.splitTextToSize(pdfSafe(text), PAGE.cw - 8) as string[]
    const height = lines.length * this.lineHeight(8.5) + 5
    this.ensure(height)
    this.doc.setFillColor(...BRAND.tealSoft); this.doc.roundedRect(PAGE.ml, this.y, PAGE.cw, height, 1.5, 1.5, 'F')
    this.font(false, 8.5, BRAND.muted, true)
    this.doc.text(lines, PAGE.ml + 4, this.y + 4.6)
    this.y += height + 2.5
  }

  /** Grade de pares rótulo/valor (dados cadastrais). */
  kv(rows: [string, string][], columns = 2) {
    const colW = PAGE.cw / columns
    const lhLabel = 3.4, lhValue = this.lineHeight(9.5)
    for (let i = 0; i < rows.length; i += columns) {
      const slice = rows.slice(i, i + columns)
      const wrapped = slice.map(([, value]) => {
        this.font(false, 9.5)
        return this.doc.splitTextToSize(pdfSafe(value || '—'), colW - 4) as string[]
      })
      const height = lhLabel + Math.max(...wrapped.map((w) => w.length)) * lhValue + 2.4
      this.ensure(height)
      slice.forEach(([label], index) => {
        const x = PAGE.ml + index * colW
        this.font(true, 7, BRAND.muted)
        this.doc.text(pdfSafe(label.toUpperCase()), x, this.y)
        this.font(false, 9.5)
        this.doc.text(wrapped[index], x, this.y + lhLabel + 1)
      })
      this.y += height
    }
    this.y += 1
  }

  table(input: TableInput) {
    if (!input.rows.length) {
      this.paragraph(input.empty || 'Sem registros.', { italic: true, color: BRAND.muted, size: 9 })
      return
    }
    this.ensure(18)
    const widths = input.widths
    const scale = widths ? PAGE.cw / widths.reduce((a, b) => a + b, 0) : 1
    autoTable(this.doc, {
      startY: this.y,
      head: [input.head.map(pdfSafe)],
      body: input.rows.map((row) => row.map((cell) => pdfSafe(cell ?? ''))),
      margin: { top: PAGE.top, bottom: 26, left: PAGE.ml, right: PAGE.mr },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: { top: 2, bottom: 2, left: 2.2, right: 2.2 }, textColor: [...BRAND.ink], lineColor: [...BRAND.border], lineWidth: 0.2, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: [...BRAND.tealDark], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'left' },
      alternateRowStyles: { fillColor: [...BRAND.zebra] },
      columnStyles: widths ? Object.fromEntries(widths.map((w, i) => [i, { cellWidth: w * scale }])) : undefined,
      showHead: 'everyPage',
    })
    this.y = ((this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? this.y) + 4
  }

  /** Foto com enquadramento 3x4 (recorte "cover", centralizado). */
  photo(buffer: Buffer, mime: string, x: number, y: number, w: number, h: number) {
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`
    const format = mime === 'image/png' ? 'PNG' : 'JPEG'
    const props = this.doc.getImageProperties(dataUrl)
    const scale = Math.max(w / props.width, h / props.height)
    const iw = props.width * scale, ih = props.height * scale
    this.doc.saveGraphicsState()
    this.doc.rect(x, y, w, h, null as unknown as string)
    this.doc.clip()
    this.doc.discardPath()
    this.doc.addImage(dataUrl, format, x - (iw - w) / 2, y - (ih - h) / 2, iw, ih)
    this.doc.restoreGraphicsState()
    this.doc.setDrawColor(...BRAND.border); this.doc.setLineWidth(0.4)
    this.doc.rect(x, y, w, h, 'S')
  }

  photoPlaceholder(x: number, y: number, w: number, h: number, initials: string) {
    this.doc.setFillColor(...BRAND.tealSoft); this.doc.rect(x, y, w, h, 'F')
    this.doc.setDrawColor(...BRAND.border); this.doc.setLineWidth(0.4); this.doc.rect(x, y, w, h, 'S')
    this.font(true, Math.min(w, h) * 0.9, BRAND.teal)
    this.doc.text(pdfSafe(initials), x + w / 2, y + h / 2 + Math.min(w, h) * 0.12, { align: 'center' })
  }

  /** Bloco de assinaturas: linha, papel e nome, em duas colunas. */
  signatures(slots: { label: string; name?: string }[]) {
    if (!slots.length) return
    const rows = Math.ceil(slots.length / 2)
    this.ensure(rows * 26 + 6)
    this.y += 10
    const colW = PAGE.cw / 2
    slots.forEach((slot, index) => {
      const col = index % 2, row = Math.floor(index / 2)
      const x = PAGE.ml + col * colW, y = this.y + row * 26
      this.doc.setDrawColor(...BRAND.ink); this.doc.setLineWidth(0.3)
      this.doc.line(x, y, x + colW - 10, y)
      this.font(true, 8.5); this.doc.text(pdfSafe(slot.label), x, y + 4.2)
      if (slot.name) { this.font(false, 8.5, BRAND.muted); this.doc.text(pdfSafe(slot.name), x, y + 8.2) }
    })
    this.y += rows * 26
  }

  // ─── passada final: cabeçalho, rodapé e paginação ─────────────────────────
  finalize(opts: { totalPages?: number } = {}) {
    const total = opts.totalPages ?? this.page
    for (let i = 1; i <= this.page; i++) {
      if (this.noChrome.has(i)) continue
      this.doc.setPage(i)
      this.drawHeader()
      this.drawFooter(i, total)
    }
    return Buffer.from(this.doc.output('arraybuffer'))
  }

  drawLogo(x: number, y: number, height: number) {
    if (!this.logo) return 0
    const scale = height / LOGO.h
    const width = LOGO.w * scale
    this.doc.saveGraphicsState()
    this.doc.rect(x, y, width, height, null as unknown as string)
    this.doc.clip(); this.doc.discardPath()
    this.doc.addImage(this.logo, 'PNG', x - LOGO.x * scale, y - LOGO.y * scale, LOGO.srcW * scale, LOGO.srcH * scale)
    this.doc.restoreGraphicsState()
    return width
  }

  private drawHeader() {
    this.drawLogo(PAGE.ml, 10, 11)
    this.font(true, 8.5, BRAND.ink)
    this.doc.text(pdfSafe(this.meta.docLabel), PAGE.w - PAGE.mr, 13.4, { align: 'right' })
    this.font(false, 7.5, BRAND.muted)
    const who = [this.meta.colaboradorNome, this.meta.matricula && `Matrícula ${this.meta.matricula}`].filter(Boolean).join(' · ')
    if (who) this.doc.text(pdfSafe(who), PAGE.w - PAGE.mr, 18, { align: 'right' })
    this.doc.setDrawColor(...BRAND.teal); this.doc.setLineWidth(0.6)
    this.doc.line(PAGE.ml, 24, PAGE.w - PAGE.mr, 24)
  }

  private drawFooter(page: number, total: number) {
    this.doc.setDrawColor(...BRAND.border); this.doc.setLineWidth(0.3)
    this.doc.line(PAGE.ml, PAGE.h - 20, PAGE.w - PAGE.mr, PAGE.h - 20)
    this.font(true, 7.5, BRAND.ink)
    this.doc.text(pdfSafe(BRAND.instituicao), PAGE.ml, PAGE.h - 15.5)
    this.font(false, 7, BRAND.muted)
    this.doc.text(pdfSafe(`People360 • ${this.meta.docLabel} • Gerado em ${fmtDateTime(this.meta.geradoEm)}`), PAGE.ml, PAGE.h - 11.5)
    this.font(true, 8, BRAND.tealDark)
    this.doc.text(`Página ${page} de ${total}`, PAGE.w - PAGE.mr, PAGE.h - 15.5, { align: 'right' })
  }
}
