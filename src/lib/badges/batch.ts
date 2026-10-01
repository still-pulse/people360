import { PDFDocument } from 'pdf-lib'

export function safeBadgeArchiveName(value: string, fallback = 'Colaborador') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_')
    .replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '').slice(0, 100) || fallback
}

export function badgeArchiveFolder(index: number, name: string, employeeId: string) {
  const order = String(index + 1).padStart(4, '0')
  const identifier = safeBadgeArchiveName(employeeId, 'sem-matricula')
  return `${order} - ${safeBadgeArchiveName(name)} - ${identifier}`
}

export async function splitBadgePdf(pdf: Buffer) {
  const source = await PDFDocument.load(pdf)
  if (source.getPageCount() < 2) throw new Error('O PDF do crachá não contém frente e verso.')

  async function page(index: number) {
    const target = await PDFDocument.create()
    const [copied] = await target.copyPages(source, [index])
    target.addPage(copied)
    return Buffer.from(await target.save())
  }

  const [front, back] = await Promise.all([page(0), page(1)])
  return { front, back }
}

export function badgeBatchCsvRow(values: string[]) {
  return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')
}
