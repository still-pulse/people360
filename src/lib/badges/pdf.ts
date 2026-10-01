import { jsPDF } from 'jspdf'
import type { BadgeSnapshot } from './types'
import { badgeBackName, badgeDepartmentLines, printableBadgeDocument } from './format'

const MM_TO_PT = 72 / 25.4
const COLORS = {
  petroleum: [5, 64, 94] as const,
  institutional: [20, 103, 143] as const,
  turquoise: [12, 175, 210] as const,
  white: [255, 255, 255] as const,
  ink: [31, 50, 64] as const,
}
type RGB = readonly [number, number, number]

function safe(text: string) {
  return text.replace(/[\u2010-\u2012]/g, '-').replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"').replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '?')
}

function rotate(x: number, y: number) {
  const rad = Math.PI / 6
  return [x * Math.cos(rad) - y * Math.sin(rad), x * Math.sin(rad) + y * Math.cos(rad)] as const
}

function polygon(doc: jsPDF, points: readonly (readonly [number, number])[], color: RGB) {
  doc.setFillColor(...color)
  const [first, ...rest] = points
  doc.lines(rest.map(([x, y], index) => [x - (index ? rest[index - 1][0] : first[0]), y - (index ? rest[index - 1][1] : first[1])]), first[0], first[1], [1, 1], 'F', true)
}

function rotatedRect(doc: jsPDF, x: number, y: number, width: number, height: number, color: RGB) {
  polygon(doc, [rotate(x, y), rotate(x + width, y), rotate(x + width, y + height), rotate(x, y + height)], color)
}

function backgroundFront(doc: jsPDF) {
  doc.setFillColor(...COLORS.institutional); doc.rect(0, 0, 54, 86, 'F')
  rotatedRect(doc, -150, 14.12, 400, 220, COLORS.petroleum)
  polygon(doc, [[-150, -4.76], [37, -4.76], [39, -2.76], [39, 31.77], [37, 33.77], [-150, 33.77]].map(([x, y]) => rotate(x, y)), COLORS.turquoise)
  rotatedRect(doc, -150, 54.13, 400, 12.55, COLORS.white)
  rotatedRect(doc, -150, 66.68, 400, 200, COLORS.turquoise)
  polygon(doc, [[-150, 69.28], [46, 69.28], [47.5, 70.78], [47.5, 260], [-150, 260]].map(([x, y]) => rotate(x, y)), COLORS.institutional)
}

function backgroundBack(doc: jsPDF) {
  doc.setFillColor(...COLORS.white); doc.rect(0, 0, 54, 86, 'F')
  rotatedRect(doc, -150, -200, 400, 198.18, COLORS.institutional)
  polygon(doc, [[-150, -1.82], [28.4, -1.82], [28.4, 4.24], [26.4, 6.24], [-150, 6.24]].map(([x, y]) => rotate(x, y)), COLORS.turquoise)
  rotatedRect(doc, -150, 67.55, 400, 200, COLORS.turquoise)
  polygon(doc, [[-150, 69.1], [46.5, 69.1], [48, 70.6], [48, 260], [-150, 260]].map(([x, y]) => rotate(x, y)), COLORS.institutional)
}

function logoPoint(x: number, y: number) { return [30.4 + (x - 217) * 0.1258, 2 + (y - 9) * 0.1258] as const }
function drawLogo(doc: jsPDF) {
  polygon(doc, [[225.4,26.5],[250.6,9],[250.6,26],[233,26],[233,48],[250.6,48],[250.6,65.5],[270,65.5],[226,93.6],[226,57],[217,57],[217,37],[226,30.5]].map(([x,y]) => logoPoint(x,y)), COLORS.white)
  polygon(doc, [[273,47.5],[286,47.5],[273,57.5]].map(([x,y]) => logoPoint(x,y)), COLORS.white)
  doc.setTextColor(...COLORS.white)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.49); doc.text('BHCL', 33.419, 6.277, { maxWidth: 5.032 })
  doc.setFontSize(4.38); doc.text('BENEFICÊNCIA', 40.841, 5.145, { maxWidth: 10.19 }); doc.text('HOSPITALAR', 40.841, 6.907, { maxWidth: 9.121 })
  doc.setFont('helvetica', 'normal'); doc.text('CESÁRIO', 40.841, 8.605, { maxWidth: 5.976 }); doc.text('LANGE', 40.841, 10.303, { maxWidth: 4.655 })
}

function roundedHexPath(x: number, y: number, width: number, height: number) {
  const point = (nx: number, ny: number) => [x + nx * width, y + ny * height]
  const ops: { op: 'm'|'l'|'c'|'h'; c: number[] }[] = []
  let current = point(.4886, .0058)
  ops.push({ op: 'm', c: current })
  const line = (nx: number, ny: number) => { current = point(nx, ny); ops.push({ op: 'l', c: current }) }
  const quad = (cx: number, cy: number, ex: number, ey: number) => {
    const control = point(cx, cy), end = point(ex, ey)
    ops.push({ op: 'c', c: [
      current[0] + (control[0] - current[0]) * 2 / 3, current[1] + (control[1] - current[1]) * 2 / 3,
      end[0] + (control[0] - end[0]) * 2 / 3, end[1] + (control[1] - end[1]) * 2 / 3,
      end[0], end[1],
    ] }); current = end
  }
  quad(.5, 0, .5114, .0058); line(.9886, .2457); quad(1, .2515, 1, .263)
  line(1, .737); quad(1, .7485, .9886, .7543); line(.5114, .9942); quad(.5, 1, .4886, .9942)
  line(.0114, .7543); quad(0, .7485, 0, .737); line(0, .263); quad(0, .2515, .0114, .2457)
  ops.push({ op: 'h', c: [] })
  return ops
}

function roundedHex(doc: jsPDF, x: number, y: number, width: number, height: number, color?: RGB, clip = false) {
  if (color) doc.setFillColor(...color)
  doc.path(roundedHexPath(x, y, width, height), color ? 'F' : undefined)
  if (clip) { doc.clip(); doc.discardPath() }
}

function fitSize(doc: jsPDF, text: string, maxMm: number, minMm: number, width: number, style: 'normal'|'bold'|'italic' = 'normal') {
  doc.setFont('helvetica', style)
  for (let mm = maxMm; mm >= minMm; mm -= 0.05) {
    doc.setFontSize(mm * MM_TO_PT)
    if (doc.getTextWidth(safe(text)) <= width) return mm
  }
  return minMm
}

function centerText(doc: jsPDF, text: string, y: number, width: number, maxMm: number, minMm: number, style: 'normal'|'bold'|'italic', color: RGB) {
  const mm = fitSize(doc, text, maxMm, minMm, width, style)
  doc.setFontSize(mm * MM_TO_PT); doc.setTextColor(...color); doc.text(safe(text), 27, y, { align: 'center' })
  return mm
}

export function coverImagePlacement(imageWidth: number, imageHeight: number, boxWidth: number, boxHeight: number, focusY: number) {
  const scale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight)
  const width = imageWidth * scale, height = imageHeight * scale
  return { width, height, x: -(width - boxWidth) / 2, y: -(height - boxHeight) * (Math.min(100, Math.max(0, focusY)) / 100) }
}

function drawPhoto(doc: jsPDF, photo: Buffer, mime: string, focusY: number) {
  const x = 11.7, y = 13.748, w = 30.6, h = 35.125
  roundedHex(doc, 10.1, 11.9, 33.8, 38.82, COLORS.petroleum)
  roundedHex(doc, 11.2, 13, 31.6, 36.62, COLORS.white)
  doc.saveGraphicsState()
  roundedHex(doc, x, y, w, h, undefined, true)
  const data = `data:${mime};base64,${photo.toString('base64')}`
  const props = doc.getImageProperties(data)
  const placement = coverImagePlacement(props.width, props.height, w, h, focusY)
  doc.addImage(data, mime.includes('png') ? 'PNG' : 'JPEG', x + placement.x, y + placement.y, placement.width, placement.height, undefined, 'FAST')
  doc.restoreGraphicsState()
}

function drawRole(doc: jsPDF, role: string) {
  let mm = fitSize(doc, role, 3.85, 3.3, 46.2)
  let lines = [safe(role)]
  if (doc.getTextWidth(safe(role)) > 46.2) {
    mm = 3.3
    for (; mm >= 2.4; mm -= 0.05) {
      doc.setFontSize(mm * MM_TO_PT)
      lines = doc.splitTextToSize(safe(role), 46.2) as string[]
      if (lines.length <= 2) break
    }
  }
  const boxH = lines.length === 1 ? 7.5 : 10.6
  const boxY = 74.25 - boxH / 2
  const widest = Math.max(...lines.map((line) => doc.getTextWidth(line)))
  const boxW = Math.min(49, widest + 2.8)
  doc.setFillColor(...COLORS.turquoise); doc.roundedRect(27 - boxW / 2, boxY, boxW, boxH, 1.1, 1.1, 'F')
  doc.setTextColor(...COLORS.white); doc.setFont('helvetica', 'normal'); doc.setFontSize(mm * MM_TO_PT)
  const lineH = mm * 1.15
  const start = 74.25 - ((lines.length - 1) * lineH) / 2 + mm * 0.34
  lines.slice(0, 2).forEach((line, i) => doc.text(line, 27, start + i * lineH, { align: 'center' }))
}

function drawFront(doc: jsPDF, data: BadgeSnapshot, photo: Buffer, photoMime: string) {
  backgroundFront(doc); drawLogo(doc); drawPhoto(doc, photo, photoMime, data.photoFocusY)
  centerText(doc, data.firstName, 58.25, 49, 5.3, 3.2, 'bold', COLORS.white)
  centerText(doc, data.lastName, 65.25, 49, 4.8, 2.6, 'italic', COLORS.white)
  drawRole(doc, data.role)
}

function pairLine(doc: jsPDF, label: string, value: string, y: number, maxMm = 3, minMm = 1.8) {
  let mm = maxMm
  for (; mm >= minMm; mm -= 0.05) {
    doc.setFontSize(mm * MM_TO_PT); doc.setFont('helvetica', 'bold'); const lw = doc.getTextWidth(label + ': ')
    doc.setFont('helvetica', 'normal'); const vw = doc.getTextWidth(safe(value))
    if (lw + vw <= 39.9) {
      const start = 27 - (lw + vw) / 2
      doc.setTextColor(...COLORS.white); doc.setFont('helvetica', 'bold'); doc.text(label + ': ', start, y)
      doc.setFont('helvetica', 'normal'); doc.text(safe(value), start + lw, y); return
    }
  }
  doc.setFontSize(minMm * MM_TO_PT); doc.setTextColor(...COLORS.white); doc.setFont('helvetica', 'bold')
  const lw = doc.getTextWidth(label + ': '); doc.setFont('helvetica', 'normal'); const vw = doc.getTextWidth(safe(value))
  const start = 27 - (lw + vw) / 2; doc.setFont('helvetica', 'bold'); doc.text(label + ': ', start, y); doc.setFont('helvetica', 'normal'); doc.text(safe(value), start + lw, y)
}

function centeredLine(doc: jsPDF, value: string, y: number, maxMm = 3, minMm = 1.8) {
  const mm = fitSize(doc, value, maxMm, minMm, 39.9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(mm * MM_TO_PT); doc.setTextColor(...COLORS.white)
  doc.text(safe(value), 27, y, { align: 'center' })
}

function drawBack(doc: jsPDF, data: BadgeSnapshot) {
  backgroundBack(doc); drawLogo(doc)
  const departmentLines = badgeDepartmentLines(data.department)
  const document = printableBadgeDocument(data.document)
  const rows = [
    { label: 'Nome', value: badgeBackName(data.fullName) },
    ...departmentLines.map((value, index) => ({ label: index === 0 ? 'Setor' : '', value })),
    { label: 'Admissão', value: data.admissionDate },
    ...(document ? [{ label: 'Registro', value: document }] : []),
  ]
  const extraHeight = Math.max(0, rows.length - 4) * 4.6
  doc.setFillColor(...COLORS.turquoise); doc.roundedRect(5.25, 28.6, 43.5, 22.2 + extraHeight, 1.3, 1.3, 'F')
  rows.forEach(({ label, value }, index) => label
    ? pairLine(doc, label, value, 33.25 + index * 4.6, 3, 1.8)
    : centeredLine(doc, value, 33.25 + index * 4.6))
  const employeeBoxY = 53 + extraHeight
  doc.setFillColor(...COLORS.turquoise)
  doc.roundedRect(5.25, employeeBoxY, 43.5, 8.7, 1.3, 1.3, 'F'); pairLine(doc, 'Matrícula', data.employeeId, employeeBoxY + 5.25)
  doc.setTextColor(...COLORS.ink); doc.setFont('helvetica', 'normal'); doc.setFontSize(1.9 * MM_TO_PT)
  doc.text('Este crachá é de uso pessoal e', 7.2, 66.2 + extraHeight)
  doc.text('intransferível. É obrigatório o uso durante', 7.2, 69 + extraHeight)
  doc.text('a permanência na Unidade.', 7.2, 71.8 + extraHeight)
  doc.setFillColor(...COLORS.turquoise); doc.circle(19.4, 81.85, 1.25, 'F')
  doc.setDrawColor(...COLORS.white); doc.setLineWidth(0.13); doc.circle(19.4, 81.85, 0.95, 'S'); doc.line(18.45,81.85,20.35,81.85); doc.line(19.4,80.9,19.4,82.8)
  doc.setTextColor(...COLORS.petroleum); doc.setFontSize(2.08 * MM_TO_PT); doc.text('www.bhcl.org.br', 21.55, 82.55)
}

export function renderBadgePdf(data: BadgeSnapshot, photo: Buffer, photoMime: string) {
  const doc = new jsPDF({ unit: 'mm', format: [54, 86], orientation: 'portrait', compress: true, putOnlyUsedFonts: true })
  doc.setProperties({ title: `Crachá - ${data.fullName}`, author: 'People360', creator: 'People360' })
  drawFront(doc, data, photo, photoMime)
  doc.addPage([54, 86], 'portrait'); drawBack(doc, data)
  return Buffer.from(doc.output('arraybuffer'))
}
