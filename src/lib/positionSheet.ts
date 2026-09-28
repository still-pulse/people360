import ExcelJS from 'exceljs'
import { ADMISSION_MONTHLY_HOURS_OPTIONS } from '@/lib/admission/positions'

// Planilha de cargos, salários e unidades: a exportação usa as mesmas colunas da importação,
// então o RH pode exportar, editar e importar de volta o mesmo arquivo.

export const BRAND = {
  teal: 'FF15AFA4', tealDark: 'FF0D8C83', tealLight: 'FFE8F7F6', tealSoft: 'FFF3FBFA',
  ink: 'FF1F2937', muted: 'FF6B7280', border: 'FFE5E7EB', zebra: 'FFF9FBFB', white: 'FFFFFFFF',
  green: 'FF1E8E5A', greenLight: 'FFE6F4EC', gray: 'FF94A3B8', grayLight: 'FFF1F5F9',
  amberLight: 'FFFFF9EE', amber: 'FFB45309',
}

export const ALL_UNITS_LABEL = 'Todas as unidades'
export const IMPORT_SHEET = 'Importar'
export const EXPORT_SHEET = 'Cargos e Salários'
const LISTS_SHEET = 'Listas'
const MONEY_FORMAT = '"R$" #,##0.00'
const HEADER_ROW = 10
const MAX_ROWS = 5000

export const COLUMNS = [
  { key: 'cargo', header: 'Cargo', width: 42 },
  { key: 'unidade', header: 'Unidade', width: 32 },
  { key: 'cargaHoraria', header: 'Carga horária mensal', width: 21 },
  { key: 'salario', header: 'Salário (R$)', width: 17 },
  { key: 'categoria', header: 'Categoria', width: 20 },
  { key: 'departamento', header: 'Departamento', width: 22 },
  { key: 'cbo', header: 'CBO', width: 11 },
  { key: 'codigoInterno', header: 'Código interno', width: 16 },
  { key: 'aliases', header: 'Aliases', width: 38 },
  { key: 'status', header: 'Status', width: 12 },
] as const

type ColumnKey = typeof COLUMNS[number]['key']
/** Número (1-based) da coluna de cada campo, para não depender da ordem das colunas. */
const COL = Object.fromEntries(COLUMNS.map((column, index) => [column.key, index + 1])) as Record<ColumnKey, number>

export const MONTHLY_HOURS_OPTIONS = ADMISSION_MONTHLY_HOURS_OPTIONS
export const ANY_HOURS_LABEL = 'Qualquer'

export type SheetPosition = {
  id: string; name: string; categoria: string | null; departamento: string | null; cbo: string | null; codigoInterno: string | null; active: boolean
  aliases: string[]; salarios: { id: string; unitId: string | null; cargaHorariaMensal: number | null; salario: number }[]
}
export type SheetUnit = { id: string; name: string; color: string; active: boolean }
export type Logo = { buffer: Buffer; extension: 'png' | 'jpeg'; width: number; height: number }
type Meta = { companyName: string; userName: string; logo: Logo | null }

// ─── Texto e números ───────────────────────────────────────────────

export function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Aceita número ou texto como "R$ 3.886,36", "3886,36" e "3886.36". */
export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  const clean = String(value).replace(/[^\d,.-]/g, '')
  if (!clean) return NaN
  return Number(clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean)
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('')
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue)
    if ('text' in value) return String(value.text)
    return ''
  }
  return String(value)
}

// ─── Visual ────────────────────────────────────────────────────────

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const thin = (argb = BRAND.border): Partial<ExcelJS.Borders> => ({
  top: { style: 'thin', color: { argb } }, bottom: { style: 'thin', color: { argb } },
  left: { style: 'thin', color: { argb } }, right: { style: 'thin', color: { argb } },
})
const FONT = 'Calibri'

function formatNow() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

const logoIds = new WeakMap<ExcelJS.Workbook, number>()

/** Cabeçalho com logo, título, subtítulo e a faixa na cor do sistema (linhas 1 a 5). */
function brandHeader(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, lastCol: number, title: string, subtitle: string, meta: Meta) {
  sheet.getRow(1).height = 18
  for (const row of [2, 3, 4]) sheet.getRow(row).height = 26
  if (meta.logo) {
    // Uma única imagem por arquivo, reaproveitada em todas as abas.
    let imageId = logoIds.get(workbook)
    if (imageId === undefined) {
      imageId = workbook.addImage({ buffer: meta.logo.buffer as unknown as ExcelJS.Buffer, extension: meta.logo.extension })
      logoIds.set(workbook, imageId)
    }
    const height = 96
    const width = Math.min(260, Math.round(height * meta.logo.width / meta.logo.height))
    sheet.addImage(imageId, { tl: { col: 0.15, row: 0.6 }, ext: { width, height }, editAs: 'absolute' })
  }
  sheet.mergeCells(2, 2, 2, lastCol)
  sheet.mergeCells(3, 2, 3, lastCol)
  sheet.mergeCells(4, 2, 4, lastCol)
  Object.assign(sheet.getCell(2, 2), { value: title, font: { name: FONT, size: 20, bold: true, color: { argb: BRAND.tealDark } }, alignment: { vertical: 'middle' } })
  Object.assign(sheet.getCell(3, 2), { value: subtitle, font: { name: FONT, size: 11, color: { argb: BRAND.ink } }, alignment: { vertical: 'middle' } })
  Object.assign(sheet.getCell(4, 2), {
    value: `${meta.companyName} · People 360 · Gerado em ${formatNow()} por ${meta.userName}`,
    font: { name: FONT, size: 9, italic: true, color: { argb: BRAND.muted } }, alignment: { vertical: 'middle' },
  })
  sheet.getRow(5).height = 6
  for (let col = 1; col <= lastCol; col++) sheet.getCell(5, col).fill = fill(BRAND.teal)
}

/** Cartões de indicadores nas linhas 7 e 8. */
function kpis(sheet: ExcelJS.Worksheet, items: [string, number | string][]) {
  sheet.getRow(7).height = 18
  sheet.getRow(8).height = 30
  items.forEach(([label, value], index) => {
    const col = index + 1
    Object.assign(sheet.getCell(7, col), {
      value: label.toUpperCase(), fill: fill(BRAND.tealLight),
      font: { name: FONT, size: 8, bold: true, color: { argb: BRAND.tealDark } }, alignment: { vertical: 'bottom', indent: 1 },
      border: { top: { style: 'medium', color: { argb: BRAND.teal } } },
    })
    Object.assign(sheet.getCell(8, col), {
      value, fill: fill(BRAND.tealLight),
      font: { name: FONT, size: 18, bold: true, color: { argb: BRAND.ink } }, alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
    })
  })
}

function tableHeader(sheet: ExcelJS.Worksheet, rowNumber: number, headers: string[]) {
  const row = sheet.getRow(rowNumber)
  row.height = 26
  headers.forEach((header, index) => {
    Object.assign(row.getCell(index + 1), {
      value: header, fill: fill(BRAND.teal), border: thin(BRAND.tealDark),
      font: { name: FONT, size: 10, bold: true, color: { argb: BRAND.white } }, alignment: { vertical: 'middle', indent: 1 },
    })
  })
}

function styleBodyRow(row: ExcelJS.Row, columns: number, index: number) {
  row.height = 20
  for (let col = 1; col <= columns; col++) {
    const cell = row.getCell(col)
    cell.fill = fill(index % 2 ? BRAND.zebra : BRAND.white)
    cell.border = { bottom: { style: 'thin', color: { argb: BRAND.border } } }
    cell.font = { name: FONT, size: 10, color: { argb: BRAND.ink }, ...(cell.font?.bold ? { bold: true } : {}) }
    cell.alignment = { vertical: 'middle', indent: 1 }
  }
}

function styleStatus(cell: ExcelJS.Cell) {
  const active = normalize(cellText(cell.value)) !== 'inativo'
  cell.font = { name: FONT, size: 10, bold: true, color: { argb: active ? BRAND.green : BRAND.gray } }
  cell.fill = fill(active ? BRAND.greenLight : BRAND.grayLight)
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
}

function styleMoneyAndHours(row: ExcelJS.Row) {
  row.getCell(COL.salario).numFmt = MONEY_FORMAT
  row.getCell(COL.salario).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }
  const hours = row.getCell(COL.cargaHoraria)
  if (typeof hours.value === 'number') hours.numFmt = '0"h"'
  hours.alignment = { vertical: 'middle', horizontal: 'center' }
  if (hours.value === ANY_HOURS_LABEL) hours.font = { name: FONT, size: 10, color: { argb: BRAND.muted } }
}

function pageSetup(sheet: ExcelJS.Worksheet, title: string) {
  sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
  sheet.headerFooter = { oddFooter: `&L&8${title}&R&8Página &P de &N` }
  sheet.properties.tabColor = { argb: BRAND.teal }
  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }]
}

/** Aba oculta com as listas usadas na validação de Unidade e Status. */
function listsSheet(workbook: ExcelJS.Workbook, units: SheetUnit[]) {
  const sheet = workbook.addWorksheet(LISTS_SHEET, { state: 'hidden' })
  const names = [ALL_UNITS_LABEL, ...units.map((unit) => unit.name)]
  names.forEach((name, index) => { sheet.getCell(index + 1, 1).value = name })
  sheet.getCell(1, 2).value = 'Ativo'
  sheet.getCell(2, 2).value = 'Inativo'
  ;[ANY_HOURS_LABEL, ...MONTHLY_HOURS_OPTIONS].forEach((value, index) => { sheet.getCell(index + 1, 3).value = value })
  return `${LISTS_SHEET}!$A$1:$A$${names.length}`
}

/** Validações nas colunas editáveis (lista de unidades, salário positivo e status). */
function validations(sheet: ExcelJS.Worksheet, unitRange: string, firstRow: number, lastRow: number) {
  for (let row = firstRow; row <= lastRow; row++) {
    sheet.getCell(row, COL.unidade).dataValidation = { type: 'list', allowBlank: true, formulae: [unitRange], showErrorMessage: true, errorTitle: 'Unidade inválida', error: 'Escolha uma unidade da lista ou "Todas as unidades".' }
    sheet.getCell(row, COL.cargaHoraria).dataValidation = { type: 'list', allowBlank: true, formulae: [`${LISTS_SHEET}!$C$1:$C$${MONTHLY_HOURS_OPTIONS.length + 1}`], showErrorMessage: true, errorTitle: 'Carga horária inválida', error: `Use ${ANY_HOURS_LABEL} ou ${MONTHLY_HOURS_OPTIONS.join(', ')}.` }
    sheet.getCell(row, COL.salario).dataValidation = { type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: 'Salário inválido', error: 'Informe um valor maior que zero.' }
    sheet.getCell(row, COL.salario).numFmt = MONEY_FORMAT
    sheet.getCell(row, COL.status).dataValidation = { type: 'list', allowBlank: true, formulae: [`${LISTS_SHEET}!$B$1:$B$2`], showErrorMessage: true, errorTitle: 'Status inválido', error: 'Use Ativo ou Inativo.' }
  }
}

function newWorkbook(meta: Meta) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = `${meta.userName} · People 360`
  workbook.company = meta.companyName
  workbook.created = new Date()
  return workbook
}

// ─── Exportação ────────────────────────────────────────────────────

export async function buildExportWorkbook(positions: SheetPosition[], units: SheetUnit[], meta: Meta) {
  const workbook = newWorkbook(meta)
  const unitName = new Map(units.map((unit) => [unit.id, unit.name]))
  const sheet = workbook.addWorksheet(EXPORT_SHEET)
  COLUMNS.forEach((column, index) => { sheet.getColumn(index + 1).width = column.width })

  const lines = positions.flatMap((position) => {
    const salarios = position.salarios.slice().sort((a, b) => (a.unitId ? 0 : 1) - (b.unitId ? 0 : 1) || (unitName.get(a.unitId ?? '') ?? '').localeCompare(unitName.get(b.unitId ?? '') ?? '', 'pt-BR') || (a.cargaHorariaMensal ?? 0) - (b.cargaHorariaMensal ?? 0))
    const base = { cargo: position.name, categoria: position.categoria ?? '', departamento: position.departamento ?? '', cbo: position.cbo ?? '', codigoInterno: position.codigoInterno ?? '', aliases: position.aliases.join('; '), status: position.active ? 'Ativo' : 'Inativo' }
    return salarios.length
      ? salarios.map((salario) => ({ ...base, unidade: salario.unitId ? unitName.get(salario.unitId) ?? '' : ALL_UNITS_LABEL, cargaHoraria: (salario.cargaHorariaMensal ?? ANY_HOURS_LABEL) as number | string, salario: salario.salario as number | null }))
      : [{ ...base, unidade: '', cargaHoraria: '' as number | string, salario: null as number | null }]
  })

  const unitsWithSalary = new Set(positions.flatMap((position) => position.salarios.map((salario) => salario.unitId).filter(Boolean)))
  brandHeader(workbook, sheet, COLUMNS.length, 'Cargos, salários e unidades', 'Tabela oficial de cargos com o salário de cada unidade. Este arquivo pode ser editado e importado de volta.', meta)
  kpis(sheet, [
    ['Cargos cadastrados', positions.length],
    ['Unidades com salário', unitsWithSalary.size],
    ['Ativos', positions.filter((position) => position.active).length],
    ['Salários', lines.filter((line) => line.salario !== null).length],
  ])
  tableHeader(sheet, HEADER_ROW, COLUMNS.map((column) => column.header))

  lines.forEach((line, index) => {
    const row = sheet.getRow(HEADER_ROW + 1 + index)
    COLUMNS.forEach((column, col) => { row.getCell(col + 1).value = line[column.key as ColumnKey] ?? '' })
    row.getCell(1).font = { bold: true }
    styleBodyRow(row, COLUMNS.length, index)
    styleMoneyAndHours(row)
    if (line.unidade === ALL_UNITS_LABEL) row.getCell(COL.unidade).font = { name: FONT, size: 10, italic: true, color: { argb: BRAND.tealDark } }
    if (!line.unidade) row.getCell(COL.unidade).value = null
    styleStatus(row.getCell(COL.status))
  })

  const lastRow = HEADER_ROW + Math.max(lines.length, 1)
  sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: lastRow, column: COLUMNS.length } }
  const unitRange = listsSheet(workbook, units)
  validations(sheet, unitRange, HEADER_ROW + 1, lastRow + 200)
  pageSetup(sheet, 'Cargos, salários e unidades')

  buildUnitsSheet(workbook, positions, units, meta)
  buildInstructionsSheet(workbook, meta, false)
  return workbook
}

function buildUnitsSheet(workbook: ExcelJS.Workbook, positions: SheetPosition[], units: SheetUnit[], meta: Meta) {
  const sheet = workbook.addWorksheet('Unidades')
  const headers = ['Unidade', 'Cor', 'Status', 'Cargos com salário', 'Menor salário', 'Maior salário']
  ;[34, 14, 12, 20, 17, 17].forEach((width, index) => { sheet.getColumn(index + 1).width = width })
  brandHeader(workbook, sheet, headers.length, 'Unidades', 'Unidades cadastradas e a faixa salarial dos cargos em cada uma.', meta)
  const defaults = positions.flatMap((position) => position.salarios.filter((salario) => !salario.unitId).map((salario) => ({ positionId: position.id, salario: salario.salario })))
  kpis(sheet, [['Unidades', units.length], ['Ativas', units.filter((unit) => unit.active).length], ['Salários padrão', defaults.length]])
  tableHeader(sheet, HEADER_ROW, headers)
  units.forEach((unit, index) => {
    const values = positions.flatMap((position) => position.salarios.filter((salario) => salario.unitId === unit.id).map((salario) => salario.salario))
    const row = sheet.getRow(HEADER_ROW + 1 + index)
    row.values = [unit.name, unit.color.toUpperCase(), unit.active ? 'Ativo' : 'Inativo', values.length, values.length ? Math.min(...values) : null, values.length ? Math.max(...values) : null]
    row.getCell(1).font = { bold: true }
    styleBodyRow(row, headers.length, index)
    const color = unit.color.replace('#', '').toUpperCase()
    if (/^[0-9A-F]{6}$/.test(color)) {
      row.getCell(2).fill = fill(`FF${color}`)
      row.getCell(2).font = { name: FONT, size: 9, bold: true, color: { argb: BRAND.white } }
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' }
    }
    styleStatus(row.getCell(3))
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' }
    for (const col of [5, 6]) { row.getCell(col).numFmt = MONEY_FORMAT; row.getCell(col).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 } }
  })
  sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + Math.max(units.length, 1), column: headers.length } }
  pageSetup(sheet, 'Unidades')
}

// ─── Modelo de importação ──────────────────────────────────────────

export async function buildTemplateWorkbook(units: SheetUnit[], meta: Meta) {
  const workbook = newWorkbook(meta)
  const unitRange = `${LISTS_SHEET}!$A$1:$A$${units.length + 1}`

  const sheet = workbook.addWorksheet(IMPORT_SHEET)
  COLUMNS.forEach((column, index) => { sheet.getColumn(index + 1).width = column.width })
  brandHeader(workbook, sheet, COLUMNS.length, 'Importação de cargos e salários', 'Preencha a partir da linha 11 (uma linha por cargo e unidade) e envie em Administração → Cargos → Importar.', meta)
  hintRow(sheet)
  tableHeader(sheet, HEADER_ROW, COLUMNS.map((column) => column.key === 'cargo' ? 'Cargo *' : column.header))
  for (let index = 0; index < 300; index++) styleBodyRow(sheet.getRow(HEADER_ROW + 1 + index), COLUMNS.length, index)
  validations(sheet, unitRange, HEADER_ROW + 1, HEADER_ROW + 1000)
  pageSetup(sheet, 'Importação de cargos e salários')

  const example = workbook.addWorksheet('Exemplo')
  COLUMNS.forEach((column, index) => { example.getColumn(index + 1).width = column.width })
  brandHeader(workbook, example, COLUMNS.length, 'Exemplo preenchido', 'Somente para consulta: esta aba NÃO é importada. Copie o formato para a aba "Importar".', meta)
  hintRow(example)
  tableHeader(example, HEADER_ROW, COLUMNS.map((column) => column.key === 'cargo' ? 'Cargo *' : column.header))
  const [first, second] = [units[0]?.name ?? 'UPA Exemplo', units[1]?.name ?? 'PA Exemplo']
  const samples = [
    ['Enfermeiro', first, ANY_HOURS_LABEL, 3886.36, 'Assistencial', 'Enfermagem', '223505', 'ENF-01', 'Enf.; Enfermeira', 'Ativo'],
    ['Enfermeiro', second, ANY_HOURS_LABEL, 3950, 'Assistencial', 'Enfermagem', '223505', 'ENF-01', '', 'Ativo'],
    ['Técnico de Enfermagem', ALL_UNITS_LABEL, ANY_HOURS_LABEL, 2720.45, 'Assistencial', 'Enfermagem', '322205', '', 'Tec. Enfermagem', 'Ativo'],
    ['Auxiliar Administrativo', first, 180, 2100, 'Administrativo', 'Administrativo', '411005', '', '', 'Ativo'],
    ['Auxiliar Administrativo', first, 200, 2333.33, 'Administrativo', 'Administrativo', '411005', '', '', 'Ativo'],
    ['Recepcionista', '', '', null, 'Administrativo', '', '', '', '', 'Inativo'],
  ]
  samples.forEach((values, index) => {
    const row = example.getRow(HEADER_ROW + 1 + index)
    row.values = values
    row.getCell(1).font = { bold: true }
    styleBodyRow(row, COLUMNS.length, index)
    styleMoneyAndHours(row)
    styleStatus(row.getCell(COL.status))
  })
  pageSetup(example, 'Exemplo de importação')
  example.properties.tabColor = { argb: 'FFF59E0B' }

  buildInstructionsSheet(workbook, meta, true)
  listsSheet(workbook, units)
  return workbook
}

function hintRow(sheet: ExcelJS.Worksheet) {
  sheet.mergeCells(7, 1, 8, COLUMNS.length)
  Object.assign(sheet.getCell(7, 1), {
    value: 'Cargo é obrigatório. Unidade vazia ou "Todas as unidades" define o salário padrão. Carga horária vazia ou "Qualquer" vale para qualquer carga (use 180, 200… quando o salário muda conforme a carga). Aliases separados por ponto e vírgula. Campos vazios mantêm o valor atual.',
    fill: fill(BRAND.amberLight), font: { name: FONT, size: 10, color: { argb: BRAND.amber } },
    alignment: { vertical: 'middle', wrapText: true, indent: 1 }, border: { left: { style: 'thick', color: { argb: 'FFF59E0B' } } },
  })
}

function buildInstructionsSheet(workbook: ExcelJS.Workbook, meta: Meta, template: boolean) {
  const sheet = workbook.addWorksheet('Instruções')
  sheet.getColumn(1).width = 26
  sheet.getColumn(2).width = 96
  brandHeader(workbook, sheet, 2, 'Como importar', 'Regras da importação em massa de cargos, salários e unidades.', meta)
  const rules: [string, string][] = [
    ['Onde preencher', template ? 'Na aba "Importar", a partir da linha 11. A aba "Exemplo" é só para consulta e não é lida.' : 'Na aba "Cargos e Salários". Edite, inclua linhas e importe este mesmo arquivo.'],
    ['Uma linha por unidade e carga', 'Cada linha liga um cargo a uma unidade e a uma carga horária com o seu salário. Repita o cargo em várias linhas para várias unidades ou cargas.'],
    ['Cargo *', 'Obrigatório. Se já existir (sem diferenciar maiúsculas e acentos) ou for um alias cadastrado, o cargo existente é atualizado; senão, é criado.'],
    ['Unidade', 'Use o nome exato da unidade (a célula tem lista). Vazia ou "Todas as unidades" = salário padrão para as unidades sem valor próprio. Unidades não são criadas pela importação.'],
    ['Carga horária mensal', `${MONTHLY_HOURS_OPTIONS.join(', ')} ou "${ANY_HOURS_LABEL}" (vazia = ${ANY_HOURS_LABEL}). Use quando o mesmo cargo tem salários diferentes conforme a carga (ex.: 180h e 200h). "${ANY_HOURS_LABEL}" vale quando não há salário para a carga escolhida na admissão.`],
    ['Salário (R$)', 'Obrigatório quando a unidade ou a carga horária é informada. Aceita 3886,36 ou 3.886,36. Se a unidade já tiver salário para essa carga neste cargo, o valor é substituído.'],
    ['Categoria, Departamento, CBO, Código', 'Opcionais. Em branco mantêm o valor atual. Nas linhas do mesmo cargo, use sempre o mesmo valor.'],
    ['Aliases', 'Opcionais, separados por ponto e vírgula (;). Apenas acrescenta: nenhum alias existente é removido.'],
    ['Status', 'Ativo ou Inativo. Em branco mantém o status atual (cargos novos entram como Ativo).'],
    ['O que NÃO acontece', 'A importação nunca exclui cargos, salários, aliases ou unidades. Para remover algo, use a tela de Cargos.'],
    ['Conferência', 'Antes de gravar, o sistema mostra uma prévia com o que será criado ou alterado e os erros por linha. Nada é gravado se houver erro.'],
  ]
  rules.forEach(([label, text], index) => {
    const row = sheet.getRow(7 + index)
    row.values = [label, text]
    row.height = 34
    Object.assign(row.getCell(1), { fill: fill(BRAND.tealLight), font: { name: FONT, size: 10, bold: true, color: { argb: BRAND.tealDark } }, alignment: { vertical: 'middle', indent: 1, wrapText: true }, border: thin() })
    Object.assign(row.getCell(2), { fill: fill(BRAND.white), font: { name: FONT, size: 10, color: { argb: BRAND.ink } }, alignment: { vertical: 'middle', indent: 1, wrapText: true }, border: thin() })
  })
  sheet.views = [{ showGridLines: false }]
  sheet.properties.tabColor = { argb: BRAND.gray }
}

// ─── Leitura da planilha ───────────────────────────────────────────

export type SheetRow = {
  line: number; cargo: string; unidade: string; cargaHoraria: number | null; salario: number | null
  categoria: string; departamento: string; cbo: string; codigoInterno: string; aliases: string[]; status: boolean | null
}
export type RowError = { line: number; message: string }

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  cargo: ['cargo', 'cargo *', 'nome do cargo'],
  unidade: ['unidade'],
  cargaHoraria: ['carga horaria mensal', 'carga horaria', 'carga', 'horas mensais'],
  salario: ['salario (r$)', 'salario'],
  categoria: ['categoria'],
  departamento: ['departamento'],
  cbo: ['cbo', 'c.b.o.'],
  codigoInterno: ['codigo interno', 'codigo'],
  aliases: ['aliases', 'alias'],
  status: ['status'],
}
const IGNORED_SHEETS = new Set(['exemplo', 'instrucoes', 'unidades', 'listas'])

function findHeader(sheet: ExcelJS.Worksheet) {
  for (let rowNumber = 1; rowNumber <= Math.min(30, sheet.rowCount); rowNumber++) {
    const map = new Map<ColumnKey, number>()
    sheet.getRow(rowNumber).eachCell((cell, col) => {
      const text = normalize(cellText(cell.value)).replace(/\s*\*$/, '')
      const key = (Object.keys(HEADER_ALIASES) as ColumnKey[]).find((k) => HEADER_ALIASES[k].includes(text))
      if (key && !map.has(key)) map.set(key, col)
    })
    if (map.has('cargo') && (map.has('unidade') || map.has('salario'))) return { rowNumber, map }
  }
  return null
}

export async function readSheet(buffer: ArrayBuffer): Promise<{ rows: SheetRow[]; errors: RowError[]; sheetName?: string }> {
  const workbook = new ExcelJS.Workbook()
  try { await workbook.xlsx.load(buffer) } catch { return { rows: [], errors: [{ line: 0, message: 'Arquivo inválido. Envie uma planilha .xlsx.' }] } }
  const candidates = workbook.worksheets
    .filter((sheet) => sheet.state === 'visible' && !IGNORED_SHEETS.has(normalize(sheet.name)))
    .sort((a, b) => Number(b.name === IMPORT_SHEET || b.name === EXPORT_SHEET) - Number(a.name === IMPORT_SHEET || a.name === EXPORT_SHEET))
  let found: { sheet: ExcelJS.Worksheet; header: NonNullable<ReturnType<typeof findHeader>> } | null = null
  for (const sheet of candidates) { const header = findHeader(sheet); if (header) { found = { sheet, header }; break } }
  if (!found) return { rows: [], errors: [{ line: 0, message: 'Não encontrei o cabeçalho (Cargo, Unidade, Salário). Use o modelo de importação.' }] }

  const { sheet, header } = found
  const rows: SheetRow[] = []
  const errors: RowError[] = []
  const get = (row: ExcelJS.Row, key: ColumnKey) => header.map.has(key) ? row.getCell(header.map.get(key)!).value : null
  for (let rowNumber = header.rowNumber + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    const text = (key: ColumnKey) => cellText(get(row, key)).replace(/\s+/g, ' ').trim()
    const values = COLUMNS.map((column) => column.key === 'salario' ? cellText(get(row, 'salario')).trim() : text(column.key))
    if (values.every((value) => !value)) continue
    if (rows.length + errors.length >= MAX_ROWS) { errors.push({ line: rowNumber, message: `Limite de ${MAX_ROWS} linhas por importação.` }); break }

    const salarioRaw = get(row, 'salario')
    const salario = parseMoney(typeof salarioRaw === 'object' && salarioRaw !== null && 'result' in salarioRaw ? salarioRaw.result : salarioRaw)
    const hoursText = normalize(text('cargaHoraria')).replace(/\s*(h|hs|horas?)( mensais)?$/, '')
    const cargaHoraria = !hoursText || hoursText.startsWith(normalize(ANY_HOURS_LABEL)) ? null : Number(hoursText.replace(',', '.'))
    const statusText = normalize(text('status'))
    const status = !statusText ? null : statusText === 'ativo' ? true : statusText === 'inativo' ? false : undefined
    const rowErrors: string[] = []
    if (!text('cargo')) rowErrors.push('Informe o cargo.')
    if (salario !== null && !(salario > 0)) rowErrors.push('Salário inválido (use um valor maior que zero, ex.: 3.886,36).')
    if (status === undefined) rowErrors.push('Status deve ser Ativo ou Inativo.')
    if (cargaHoraria !== null && !(MONTHLY_HOURS_OPTIONS as readonly number[]).includes(cargaHoraria)) rowErrors.push(`Carga horária inválida. Use ${MONTHLY_HOURS_OPTIONS.join(', ')} ou ${ANY_HOURS_LABEL}.`)
    if (rowErrors.length) { rowErrors.forEach((message) => errors.push({ line: rowNumber, message })); continue }
    rows.push({
      line: rowNumber, cargo: text('cargo'), unidade: text('unidade'), cargaHoraria,
      salario: salario === null ? null : Math.round(salario * 100) / 100,
      categoria: text('categoria'), departamento: text('departamento'), cbo: text('cbo'), codigoInterno: text('codigoInterno'),
      aliases: text('aliases').split(/[;\n]/).map((alias) => alias.trim()).filter(Boolean),
      status: status ?? null,
    })
  }
  return { rows, errors, sheetName: sheet.name }
}

// ─── Plano de importação (puro, sem banco) ─────────────────────────

export type PlannedPosition = {
  key: string; existingId: string | null; name: string
  data: { categoria?: string; departamento?: string; cbo?: string; codigoInterno?: string; active?: boolean }
  salaries: { unitId: string | null; cargaHorariaMensal: number | null; salario: number; existingSalaryId: string | null; previous: number | null }[]
  aliases: string[]
}
export type ImportSummary = {
  cargosNovos: number; cargosAtualizados: number; salariosNovos: number; salariosAtualizados: number; aliasesNovos: number; linhas: number; semAlteracao: number
}
export type ImportPlan = { positions: PlannedPosition[]; errors: RowError[]; summary: ImportSummary }

export function planImport(rows: SheetRow[], positions: SheetPosition[], units: SheetUnit[]): ImportPlan {
  const errors: RowError[] = []
  const byName = new Map(positions.map((position) => [normalize(position.name), position]))
  const aliasOwner = new Map<string, SheetPosition>()
  for (const position of positions) for (const alias of position.aliases) aliasOwner.set(normalize(alias), position)
  const unitByName = new Map(units.map((unit) => [normalize(unit.name), unit]))
  const allUnits = new Set([normalize(ALL_UNITS_LABEL), 'todas', normalize(`${ALL_UNITS_LABEL} (padrão)`), 'padrao'])

  type Draft = PlannedPosition & { existing: SheetPosition | null; firstLine: number; fieldLines: Record<string, number>; salaryLines: Map<string, number>; newAliases: Set<string> }
  const drafts = new Map<string, Draft>()

  for (const row of rows) {
    const existing = byName.get(normalize(row.cargo)) ?? aliasOwner.get(normalize(row.cargo)) ?? null
    const key = existing ? existing.id : `new:${normalize(row.cargo)}`
    let draft = drafts.get(key)
    if (!draft) {
      draft = { key, existingId: existing?.id ?? null, name: existing?.name ?? row.cargo, data: {}, salaries: [], aliases: [], existing, firstLine: row.line, fieldLines: {}, salaryLines: new Map(), newAliases: new Set() }
      drafts.set(key, draft)
    }

    let unitId: string | null = null
    const unitText = normalize(row.unidade)
    if (unitText && !allUnits.has(unitText)) {
      const unit = unitByName.get(unitText)
      if (!unit) { errors.push({ line: row.line, message: `Unidade "${row.unidade}" não encontrada. Use o nome exato de uma unidade cadastrada.` }); continue }
      unitId = unit.id
    }
    if ((unitText || row.cargaHoraria !== null) && row.salario === null) { errors.push({ line: row.line, message: `Informe o salário do cargo${unitText ? ` em ${row.unidade}` : ''}${row.cargaHoraria !== null ? ` para ${row.cargaHoraria}h` : ''}.` }); continue }

    const fields: [keyof PlannedPosition['data'], string | boolean | null][] = [
      ['categoria', row.categoria || null], ['departamento', row.departamento || null], ['cbo', row.cbo || null], ['codigoInterno', row.codigoInterno || null], ['active', row.status],
    ]
    let conflict = false
    for (const [field, value] of fields) {
      if (value === null) continue
      const current = draft.data[field]
      if (current !== undefined && current !== value) {
        errors.push({ line: row.line, message: `${fieldLabel(field)} diferente da linha ${draft.fieldLines[field]} para o mesmo cargo.` })
        conflict = true
      } else if (current === undefined) {
        ;(draft.data as Record<string, unknown>)[field] = value
        draft.fieldLines[field] = row.line
      }
    }
    if (conflict) continue

    if (row.salario !== null) {
      const salaryKey = `${unitId ?? '*'}|${row.cargaHoraria ?? '*'}`
      const previousLine = draft.salaryLines.get(salaryKey)
      if (previousLine) { errors.push({ line: row.line, message: `Unidade e carga horária repetidas para o mesmo cargo (já informadas na linha ${previousLine}).` }); continue }
      draft.salaryLines.set(salaryKey, row.line)
      const current = existing?.salarios.find((salario) => salario.unitId === unitId && (salario.cargaHorariaMensal ?? null) === row.cargaHoraria) ?? null
      draft.salaries.push({ unitId, cargaHorariaMensal: row.cargaHoraria, salario: row.salario, existingSalaryId: current?.id ?? null, previous: current?.salario ?? null })
    }

    for (const alias of row.aliases) {
      const normalized = normalize(alias)
      if (normalized === normalize(draft.name) || draft.newAliases.has(normalized)) continue
      const owner = aliasOwner.get(normalized)
      if (owner && owner.id === draft.existingId) continue
      if (owner) { errors.push({ line: row.line, message: `O alias "${alias}" já pertence ao cargo ${owner.name}.` }); continue }
      const nameOwner = byName.get(normalized)
      if (nameOwner) { errors.push({ line: row.line, message: `O alias "${alias}" é o nome do cargo ${nameOwner.name}.` }); continue }
      draft.newAliases.add(normalized)
      draft.aliases.push(alias)
    }
  }

  // Um mesmo alias novo não pode ir para dois cargos.
  const aliasTaken = new Map<string, Draft>()
  for (const draft of drafts.values()) for (const alias of draft.aliases) {
    const other = aliasTaken.get(normalize(alias))
    if (other) errors.push({ line: draft.firstLine, message: `O alias "${alias}" foi informado para ${other.name} e ${draft.name}.` })
    else aliasTaken.set(normalize(alias), draft)
  }

  const summary: ImportSummary = { cargosNovos: 0, cargosAtualizados: 0, salariosNovos: 0, salariosAtualizados: 0, aliasesNovos: 0, linhas: rows.length, semAlteracao: 0 }
  const planned: PlannedPosition[] = []
  for (const draft of drafts.values()) {
    const existing = draft.existing
    const data = Object.fromEntries(Object.entries(draft.data).filter(([field, value]) => !existing || (existing as Record<string, unknown>)[field] !== value)) as PlannedPosition['data']
    const salaries = draft.salaries.filter((salary) => salary.previous !== salary.salario)
    const changed = !existing || Object.keys(data).length > 0 || salaries.length > 0 || draft.aliases.length > 0
    if (!changed) { summary.semAlteracao++; continue }
    if (existing) summary.cargosAtualizados++; else summary.cargosNovos++
    summary.salariosNovos += salaries.filter((salary) => !salary.existingSalaryId).length
    summary.salariosAtualizados += salaries.filter((salary) => salary.existingSalaryId).length
    summary.aliasesNovos += draft.aliases.length
    planned.push({ key: draft.key, existingId: draft.existingId, name: draft.name, data, salaries, aliases: draft.aliases })
  }
  return { positions: planned, errors: errors.sort((a, b) => a.line - b.line), summary }
}

function fieldLabel(field: string) {
  return ({ categoria: 'Categoria', departamento: 'Departamento', cbo: 'CBO', codigoInterno: 'Código interno', active: 'Status' } as Record<string, string>)[field] ?? field
}

// ─── Logo ──────────────────────────────────────────────────────────

/** Lê largura e altura de PNG ou JPEG para manter a proporção do logo na planilha. */
export function imageSize(buffer: Buffer): { extension: 'png' | 'jpeg'; width: number; height: number } | null {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) return { extension: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset++; continue }
      const marker = buffer[offset + 1]
      const length = buffer.readUInt16BE(offset + 2)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { extension: 'jpeg', height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
      }
      offset += 2 + length
    }
  }
  return null
}
