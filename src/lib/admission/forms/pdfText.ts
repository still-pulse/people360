import { readFile } from 'fs/promises'
import path from 'path'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'

// Os formulários oficiais (PDF original) ficam em assets/admission-forms; os dados do colaborador são
// escritos por cima, nas posições medidas no PDF (coordenadas a partir do topo da página, em pontos).

export const FORMS_DIR = path.join(process.cwd(), 'assets', 'admission-forms')

export async function loadForm(file: string) {
  return PDFDocument.load(await readFile(path.join(FORMS_DIR, file)))
}

export type Fonts = { regular: PDFFont; bold: PDFFont; courier: PDFFont; courierBold: PDFFont }

export async function embedFonts(pdf: PDFDocument): Promise<Fonts> {
  const [regular, bold, courier, courierBold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica), pdf.embedFont(StandardFonts.HelveticaBold),
    pdf.embedFont(StandardFonts.Courier), pdf.embedFont(StandardFonts.CourierBold),
  ])
  return { regular, bold, courier, courierBold }
}

/** As fontes padrão do PDF só codificam WinAnsi: troca o que não existe nela. */
export function safe(text: string) {
  return text
    .replace(/[‐-‒]/g, '-')
    .replace(/[^ -~ -ÿ–—‘’“”•…]/g, '?')
}

export type TextOptions = {
  size: number; font: PDFFont; color?: RGB
  /** Largura máxima: o tamanho da fonte diminui até caber (mínimo 60% do original). */
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
}

/** Escreve uma linha. `x` é a esquerda (ou o centro / a direita, conforme `align`); `top` é a linha de base medida do topo. */
export function drawLine(page: PDFPage, value: string | null | undefined, x: number, top: number, options: TextOptions) {
  const text = safe(String(value ?? '').replace(/\s+/g, ' ').trim())
  if (!text) return
  let size = options.size
  if (options.maxWidth) while (size > options.size * 0.6 && options.font.widthOfTextAtSize(text, size) > options.maxWidth) size -= 0.2
  const width = options.font.widthOfTextAtSize(text, size)
  const left = options.align === 'center' ? x - width / 2 : options.align === 'right' ? x - width : x
  page.drawText(text, { x: left, y: page.getHeight() - top, size, font: options.font, color: options.color ?? rgb(0, 0, 0) })
}

/** Apaga o marcador impresso no formulário e escreve o dado no mesmo espaço. */
export function replaceLine(page: PDFPage, value: string | null | undefined, x: number, top: number, width: number, options: Omit<TextOptions, 'maxWidth'> & { height?: number }) {
  const height = options.height ?? Math.max(11, options.size + 4)
  page.drawRectangle({ x: x - 1, y: page.getHeight() - top - 3, width: width + 2, height, color: rgb(1, 1, 1) })
  drawLine(page, value, x, top, { ...options, maxWidth: width })
}

/** Quebra o texto em linhas que caibam na largura (por palavras). */
export function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []
  let line = ''
  for (const word of safe(text).split(/ +/)) {
    const candidate = line ? `${line} ${word}` : word
    if (!line || font.widthOfTextAtSize(candidate, size) <= width) line = candidate
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Parágrafo em linhas fixas (como no relatório original): começa em `top` e avança `leading` por linha.
 * Se não couber em `maxLines`, reduz a fonte aos poucos até caber.
 */
export function drawParagraph(page: PDFPage, text: string, x: number, top: number, width: number, options: { font: PDFFont; size: number; leading: number; maxLines: number; indent?: string; justify?: boolean }) {
  let size = options.size, leading = options.leading, lines: string[] = []
  for (; size >= options.size * 0.7; size -= 0.25, leading = options.leading * size / options.size) {
    lines = wrap(`${options.indent ?? ''}${text}`, options.font, size, width)
    if (lines.length <= options.maxLines) break
  }
  const color = rgb(0, 0, 0)
  lines.forEach((line, index) => {
    const y = page.getHeight() - top - index * leading
    const words = line.split(' ')
    // Justificado como no relatório original: o espaço que sobra é distribuído entre as palavras (exceto na última linha).
    if (!options.justify || index === lines.length - 1 || words.length < 2) { page.drawText(line, { x, y, size, font: options.font, color }); return }
    const gap = (width - options.font.widthOfTextAtSize(line, size)) / (words.length - 1)
    let cursor = x
    for (const word of words) {
      page.drawText(word, { x: cursor, y, size, font: options.font, color })
      cursor += options.font.widthOfTextAtSize(`${word} `, size) + gap
    }
  })
  return lines.length
}

/** Marca uma caixa de seleção (☐) com um "X" centralizado. */
export function drawCheck(page: PDFPage, centerX: number, centerTop: number, font: PDFFont, size = 9, color = rgb(0, 0, 0)) {
  const width = font.widthOfTextAtSize('X', size)
  page.drawText('X', { x: centerX - width / 2, y: page.getHeight() - centerTop - size * 0.35, size, font, color })
}

/** Preenche uma opção redonda ("o") com um ponto. */
export function drawDot(page: PDFPage, centerX: number, centerTop: number, color: RGB, radius = 2.3) {
  page.drawCircle({ x: centerX, y: page.getHeight() - centerTop, size: radius, color })
}

/** Rodapé discreto de validação, abaixo da margem de todos os formulários. */
export function stampValidation(pdf: PDFDocument, font: PDFFont, text: string) {
  for (const page of pdf.getPages()) {
    const size = 5.5, value = safe(text)
    const width = font.widthOfTextAtSize(value, size)
    page.drawText(value, { x: (page.getWidth() - width) / 2, y: 4, size, font, color: rgb(0.45, 0.5, 0.52) })
  }
}
