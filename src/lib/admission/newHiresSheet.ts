import ExcelJS from 'exceljs'
import { BRAND, FONT, HEADER_ROW, brandHeader, fill, kpis, pageSetup, styleBodyRow, tableHeader, type Meta } from '@/lib/positionSheet'
import { PCD_QUESTIONS } from './pcd'

// Planilha "Novos colaboradores": dados completos das admissões com a documentação aprovada,
// no mesmo padrão visual (cabeçalho BHCL, indicadores e tabela) da planilha de cargos e salários.

export type NewHire = {
  protocol: string; candidateName: string; candidateEmail: string | null; candidatePhone: string | null
  jobTitle: string; department: string | null; unit: string; hireDate: Date; salary: number | null; hazardPayPercentage: number | null
  workSchedule: string | null; breakSchedule: string | null; weeklyHours: number | null; monthlyHours: number | null
  contractType: string; experienceDays: number | null; contractEndDate: Date | null; status: string
  fields: Record<string, unknown>
  dependents: { name: string; cpfMasked: string | null; birthDate: Date; relationship: string; irrfDependent: boolean; childUnder14: boolean }[]
  transport: { requested: boolean; refusalReason: string | null; routes: { type: string; line: string; outbound: number; returnValue: number }[] } | null
}

type Column = { header: string; width: number; value: (hire: NewHire) => string | number | Date | null; format?: 'money' | 'date' | 'percent' }

const MONEY = '"R$" #,##0.00'
const DATE = 'dd/mm/yyyy'
const GENDER: Record<string, string> = { Female: 'Feminino', Male: 'Masculino', Other: 'Outro', 'Prefer not to say': 'Prefiro não informar' }

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return GENDER[String(value)] ?? String(value)
}

/** Datas do portal chegam como "AAAA-MM-DD"; viram data real no Excel. */
function fieldDate(value: unknown): Date | null {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)) : null
}

function cpf(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length === 11 ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : text(value)
}

const field = (key: string) => (hire: NewHire) => text(hire.fields[key])

export const NEW_HIRE_COLUMNS: Column[] = [
  { header: 'Nome completo', width: 38, value: (h) => text(h.fields.name) || h.candidateName },
  { header: 'CPF', width: 16, value: (h) => cpf(h.fields.cpf) },
  { header: 'Protocolo', width: 20, value: (h) => h.protocol },
  { header: 'Cargo', width: 30, value: (h) => h.jobTitle },
  { header: 'Departamento', width: 22, value: (h) => h.department },
  { header: 'Unidade', width: 26, value: (h) => h.unit },
  { header: 'Data de admissão', width: 16, value: (h) => h.hireDate, format: 'date' },
  { header: 'Salário', width: 15, value: (h) => h.salary, format: 'money' },
  { header: 'Insalubridade', width: 14, value: (h) => h.hazardPayPercentage == null ? null : h.hazardPayPercentage / 100, format: 'percent' },
  { header: 'Tipo de contrato', width: 22, value: (h) => h.contractType },
  { header: 'Experiência (dias)', width: 17, value: (h) => h.experienceDays },
  { header: 'Término previsto', width: 16, value: (h) => h.contractEndDate, format: 'date' },
  { header: 'Jornada', width: 22, value: (h) => h.workSchedule },
  { header: 'Intervalo', width: 18, value: (h) => h.breakSchedule },
  { header: 'Carga horária mensal', width: 19, value: (h) => h.monthlyHours },
  { header: 'Carga horária semanal', width: 19, value: (h) => h.weeklyHours },
  { header: 'Data de nascimento', width: 17, value: (h) => fieldDate(h.fields.birthDate), format: 'date' },
  { header: 'Gênero', width: 13, value: field('gender') },
  { header: 'Estado civil', width: 15, value: field('maritalStatus') },
  { header: 'Grau de instrução', width: 26, value: field('education') },
  { header: 'Etnia', width: 12, value: field('ethnicity') },
  { header: 'Nacionalidade', width: 15, value: field('nationality') },
  { header: 'Cidade de nascimento', width: 24, value: field('birthCity') },
  { header: 'Nome da mãe', width: 32, value: field('motherName') },
  { header: 'Nome do pai', width: 32, value: field('fatherName') },
  { header: 'RG', width: 15, value: field('rg') },
  { header: 'Órgão emissor', width: 14, value: field('rgIssuer') },
  { header: 'Expedição do RG', width: 16, value: (h) => fieldDate(h.fields.rgIssuedAt), format: 'date' },
  { header: 'PIS', width: 16, value: field('pis') },
  { header: 'Título de eleitor', width: 17, value: field('voterTitle') },
  { header: 'Zona', width: 8, value: field('voterZone') },
  { header: 'Seção', width: 8, value: field('voterSection') },
  { header: 'Pessoa com deficiência', width: 20, value: field('disability') },
  { header: 'Deficiência', width: 24, value: field('disabilityDetails') },
  ...PCD_QUESTIONS.map((question): Column => ({ header: `PCD — ${question.label}`, width: 30, value: field(question.key) })),
  { header: 'E-mail', width: 30, value: (h) => text(h.fields.email) || h.candidateEmail },
  { header: 'Telefone', width: 17, value: (h) => text(h.fields.phone) || h.candidatePhone },
  { header: 'Telefone de recado', width: 18, value: field('messagePhone') },
  { header: 'CEP', width: 11, value: field('zipCode') },
  { header: 'Logradouro', width: 32, value: field('street') },
  { header: 'Número', width: 9, value: field('number') },
  { header: 'Complemento', width: 18, value: field('complement') },
  { header: 'Bairro', width: 22, value: field('district') },
  { header: 'Cidade', width: 22, value: field('city') },
  { header: 'UF', width: 6, value: field('state') },
  { header: 'Banco', width: 28, value: field('bank') },
  { header: 'Agência', width: 10, value: field('agency') },
  { header: 'Conta', width: 14, value: field('account') },
  { header: 'Dígito', width: 8, value: field('accountDigit') },
  { header: 'Tipo de conta', width: 16, value: field('accountType') },
  { header: 'Dependentes', width: 13, value: (h) => h.dependents.length },
  { header: 'Vale-transporte', width: 15, value: (h) => h.transport ? (h.transport.requested ? 'Solicitado' : 'Recusado') : '' },
]

function setCell(cell: ExcelJS.Cell, value: string | number | Date | null, format?: Column['format']) {
  cell.value = value === null || value === undefined || value === '' ? '—' : value
  if (cell.value === '—') { cell.font = { name: FONT, size: 10, color: { argb: BRAND.muted } }; return }
  if (format === 'money') { cell.numFmt = MONEY; cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 } }
  if (format === 'date') { cell.numFmt = DATE; cell.alignment = { vertical: 'middle', horizontal: 'center' } }
  if (format === 'percent') { cell.numFmt = '0%'; cell.alignment = { vertical: 'middle', horizontal: 'center' } }
}

function table<T>(sheet: ExcelJS.Worksheet, columns: { header: string; width: number; value: (item: T) => string | number | Date | null; format?: Column['format'] }[], items: T[]) {
  columns.forEach((column, index) => { sheet.getColumn(index + 1).width = column.width })
  tableHeader(sheet, HEADER_ROW, columns.map((column) => column.header))
  sheet.getRow(HEADER_ROW).height = 32
  sheet.getRow(HEADER_ROW).eachCell((cell) => { cell.alignment = { vertical: 'middle', indent: 1, wrapText: true } })
  items.forEach((item, index) => {
    const row = sheet.getRow(HEADER_ROW + 1 + index)
    styleBodyRow(row, columns.length, index)
    columns.forEach((column, col) => setCell(row.getCell(col + 1), column.value(item), column.format))
  })
  if (!items.length) {
    sheet.mergeCells(HEADER_ROW + 1, 1, HEADER_ROW + 1, columns.length)
    Object.assign(sheet.getCell(HEADER_ROW + 1, 1), { value: 'Nenhum registro.', font: { name: FONT, size: 10, italic: true, color: { argb: BRAND.muted } }, fill: fill(BRAND.white) })
  }
  sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + Math.max(items.length, 1), column: columns.length } }
  // Nome sempre visível ao rolar para a direita.
  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW, xSplit: 2, showGridLines: false }]
}

export async function buildNewHiresWorkbook(hires: NewHire[], meta: Meta) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'People 360'
  workbook.created = new Date()

  const main = workbook.addWorksheet('Novos colaboradores')
  pageSetup(main, 'Novos colaboradores')
  table(main, NEW_HIRE_COLUMNS, hires)
  brandHeader(workbook, main, NEW_HIRE_COLUMNS.length, 'Novos colaboradores', 'Admissões com a documentação aprovada pelo RH — dados completos para a contabilidade', meta)
  kpis(main, [
    ['Colaboradores', hires.length],
    ['Unidades', new Set(hires.map((hire) => hire.unit)).size],
    ['Com dependentes', hires.filter((hire) => hire.dependents.length).length],
    ['Vale-transporte', hires.filter((hire) => hire.transport?.requested).length],
  ])
  main.views = [{ state: 'frozen', ySplit: HEADER_ROW, xSplit: 2, showGridLines: false }]

  type DependentRow = NewHire['dependents'][number] & { hire: NewHire }
  const dependents = workbook.addWorksheet('Dependentes')
  pageSetup(dependents, 'Dependentes')
  const dependentColumns: { header: string; width: number; value: (row: DependentRow) => string | number | Date | null; format?: Column['format'] }[] = [
    { header: 'Colaborador', width: 36, value: (row) => text(row.hire.fields.name) || row.hire.candidateName },
    { header: 'CPF do colaborador', width: 18, value: (row) => cpf(row.hire.fields.cpf) },
    { header: 'Dependente', width: 34, value: (row) => row.name },
    { header: 'CPF do dependente', width: 18, value: (row) => row.cpfMasked },
    { header: 'Nascimento', width: 14, value: (row) => row.birthDate, format: 'date' },
    { header: 'Parentesco', width: 18, value: (row) => row.relationship },
    { header: 'Dependente de IRRF', width: 18, value: (row) => text(row.irrfDependent) },
    { header: 'Filho menor de 14', width: 17, value: (row) => text(row.childUnder14) },
  ]
  const dependentRows = hires.flatMap((hire) => hire.dependents.map((dependent) => ({ ...dependent, hire })))
  table(dependents, dependentColumns, dependentRows)
  brandHeader(workbook, dependents, dependentColumns.length, 'Dependentes', 'Dependentes informados pelos novos colaboradores', meta)
  kpis(dependents, [['Dependentes', dependentRows.length], ['IRRF', dependentRows.filter((row) => row.irrfDependent).length]])

  type RouteRow = { hire: NewHire; type: string; line: string; outbound: number | null; returnValue: number | null }
  const transport = workbook.addWorksheet('Vale-transporte')
  pageSetup(transport, 'Vale-transporte')
  const routeColumns: { header: string; width: number; value: (row: RouteRow) => string | number | Date | null; format?: Column['format'] }[] = [
    { header: 'Colaborador', width: 36, value: (row) => text(row.hire.fields.name) || row.hire.candidateName },
    { header: 'Unidade', width: 26, value: (row) => row.hire.unit },
    { header: 'Opção', width: 13, value: (row) => row.hire.transport?.requested ? 'Solicitado' : 'Recusado' },
    { header: 'Motivo da recusa', width: 30, value: (row) => row.hire.transport?.requested ? null : row.hire.transport?.refusalReason ?? null },
    { header: 'Tipo', width: 16, value: (row) => row.type },
    { header: 'Linha', width: 30, value: (row) => row.line },
    { header: 'Ida', width: 12, value: (row) => row.outbound, format: 'money' },
    { header: 'Volta', width: 12, value: (row) => row.returnValue, format: 'money' },
    { header: 'Total diário', width: 13, value: (row) => row.outbound == null ? null : row.outbound + (row.returnValue ?? 0), format: 'money' },
  ]
  const routeRows: RouteRow[] = hires.flatMap((hire): RouteRow[] => !hire.transport ? []
    : hire.transport.routes.length ? hire.transport.routes.map((route) => ({ hire, ...route }))
    : [{ hire, type: '', line: '', outbound: null, returnValue: null }])
  table(transport, routeColumns, routeRows)
  brandHeader(workbook, transport, routeColumns.length, 'Vale-transporte', 'Opção e trajetos informados na admissão', meta)
  kpis(transport, [['Solicitaram', hires.filter((hire) => hire.transport?.requested).length], ['Recusaram', hires.filter((hire) => hire.transport && !hire.transport.requested).length]])

  return workbook
}
