import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildExportWorkbook, buildTemplateWorkbook, imageSize, parseMoney, planImport, readSheet, type SheetPosition, type SheetRow, type SheetUnit } from './positionSheet'

const units: SheetUnit[] = [
  { id: 'u1', name: 'GRU - UPA São João', color: '#84CC16', active: true },
  { id: 'u2', name: 'VG - PA Luiz Gonzaga', color: '#EC4899', active: true },
]
const positions: SheetPosition[] = [
  { id: 'p1', name: 'Enfermeiro', categoria: 'Assistencial', departamento: 'Enfermagem', codigoInterno: null, active: true, aliases: ['Enf.'], salarios: [{ id: 's1', unitId: 'u1', salario: 3886.36 }, { id: 's2', unitId: null, salario: 3800 }] },
  { id: 'p2', name: 'Técnico de Enfermagem', categoria: null, departamento: null, codigoInterno: null, active: false, aliases: [], salarios: [] },
]
const logoBuffer = readFileSync(path.join(__dirname, '../../public/bhcl-admissao-logo.png'))
const meta = { companyName: 'BHCL', userName: 'Teste', logo: { buffer: logoBuffer, ...imageSize(logoBuffer)! } }

async function toBuffer(workbook: ExcelJS.Workbook) {
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer
}

const row = (patch: Partial<SheetRow>): SheetRow => ({ line: 11, cargo: '', unidade: '', salario: null, categoria: '', departamento: '', codigoInterno: '', aliases: [], status: null, ...patch })

describe('planilha de cargos', () => {
  it('lê as dimensões do logo PNG', () => {
    expect(imageSize(logoBuffer)).toEqual({ extension: 'png', width: 701, height: 356 })
  })

  it('aceita salário em número ou texto brasileiro', () => {
    expect(parseMoney('R$ 3.886,36')).toBe(3886.36)
    expect(parseMoney('3886.36')).toBe(3886.36)
    expect(parseMoney(2720.45)).toBe(2720.45)
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('abc')).toBeNaN()
  })

  it('exportar e importar o mesmo arquivo não altera nada', async () => {
    const buffer = await toBuffer(await buildExportWorkbook(positions, units, meta))
    const sheet = await readSheet(buffer)
    expect(sheet.errors).toEqual([])
    expect(sheet.rows).toHaveLength(3)
    const plan = planImport(sheet.rows, positions, units)
    expect(plan.errors).toEqual([])
    expect(plan.positions).toEqual([])
    expect(plan.summary.semAlteracao).toBe(2)
  })

  it('o modelo vazio não importa a aba de exemplo', async () => {
    const sheet = await readSheet(await toBuffer(await buildTemplateWorkbook(units, meta)))
    expect(sheet.sheetName).toBe('Importar')
    expect(sheet.rows).toEqual([])
    expect(sheet.errors).toEqual([])
  })

  it('cria cargo novo, atualiza salário existente e acrescenta unidade', () => {
    const plan = planImport([
      row({ line: 11, cargo: 'ENFERMEIRO', unidade: 'GRU - UPA SAO JOAO', salario: 4000 }),
      row({ line: 12, cargo: 'Enfermeiro', unidade: 'VG - PA Luiz Gonzaga', salario: 3950 }),
      row({ line: 13, cargo: 'Recepcionista', unidade: 'Todas as unidades', salario: 1900, categoria: 'Administrativo' }),
    ], positions, units)
    expect(plan.errors).toEqual([])
    expect(plan.summary).toMatchObject({ cargosNovos: 1, cargosAtualizados: 1, salariosNovos: 2, salariosAtualizados: 1 })
    const enfermeiro = plan.positions.find((position) => position.existingId === 'p1')!
    expect(enfermeiro.salaries).toEqual([
      { unitId: 'u1', salario: 4000, existingSalaryId: 's1', previous: 3886.36 },
      { unitId: 'u2', salario: 3950, existingSalaryId: null, previous: null },
    ])
  })

  it('reconhece o cargo pelo alias', () => {
    const plan = planImport([row({ cargo: 'enf.', unidade: 'VG - PA Luiz Gonzaga', salario: 3950 })], positions, units)
    expect(plan.positions[0].existingId).toBe('p1')
  })

  it('aponta erros por linha', () => {
    const plan = planImport([
      row({ line: 11, cargo: 'Enfermeiro', unidade: 'Unidade inexistente', salario: 100 }),
      row({ line: 12, cargo: 'Enfermeiro', unidade: 'VG - PA Luiz Gonzaga' }),
      row({ line: 13, cargo: 'Recepcionista', unidade: 'VG - PA Luiz Gonzaga', salario: 1 }),
      row({ line: 14, cargo: 'Recepcionista', unidade: 'VG - PA Luiz Gonzaga', salario: 2 }),
      row({ line: 15, cargo: 'Recepcionista', categoria: 'A' }),
      row({ line: 16, cargo: 'Recepcionista', categoria: 'B' }),
      row({ line: 17, cargo: 'Recepcionista', aliases: ['Enf.'] }),
    ], positions, units)
    expect(plan.errors.map((error) => error.line)).toEqual([11, 12, 14, 16, 17])
  })

  it('reativa cargo inativo pelo status', () => {
    const plan = planImport([row({ cargo: 'Técnico de Enfermagem', status: true })], positions, units)
    expect(plan.positions[0].data).toEqual({ active: true })
  })
})
