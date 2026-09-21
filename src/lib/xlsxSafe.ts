type Merge = { s: { r: number; c: number }; e: { r: number; c: number } }
type Sheet = { rows: unknown[][]; '!cols'?: { wch?: number }[]; '!merges'?: Merge[] }
type Book = { sheets: { name: string; sheet: Sheet }[] }

function aoaToSheet(rows: unknown[][]): Sheet {
  return { rows: rows.map((row) => [...row]) }
}

function jsonToSheet(rows: Record<string, unknown>[]): Sheet {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  return { rows: [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))] }
}

export const utils = {
  book_new: (): Book => ({ sheets: [] }),
  aoa_to_sheet: aoaToSheet,
  json_to_sheet: jsonToSheet,
  book_append_sheet: (book: Book, sheet: Sheet, name: string) => { book.sheets.push({ name, sheet }) },
}

/** Exportador compatível com o pequeno subconjunto de SheetJS usado pelo projeto. */
export async function writeFile(book: Book, fileName: string) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  for (const item of book.sheets) {
    const worksheet = workbook.addWorksheet(item.name.slice(0, 31))
    item.sheet.rows.forEach((row) => worksheet.addRow(row))
    item.sheet['!cols']?.forEach((column, index) => { worksheet.getColumn(index + 1).width = column.wch ?? 12 })
    item.sheet['!merges']?.forEach((merge) => worksheet.mergeCells(merge.s.r + 1, merge.s.c + 1, merge.e.r + 1, merge.e.c + 1))
  }
  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = fileName; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const XLSX = { utils, writeFile }
export default XLSX
