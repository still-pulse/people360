import { describe, expect, it } from 'vitest'
import { DOCUMENT_CATALOG } from './documentCatalog'
import { ADMISSION_BREAKS, ADMISSION_MONTHLY_HOURS, ADMISSION_MONTHLY_HOURS_OPTIONS, ADMISSION_SCHEDULES, findPosition, salaryForUnit } from './positions'
import { ADMISSION_TEMPLATE_DEFAULTS } from './templateDefaults'

describe('cargos, salários por unidade e horários fixos', () => {
  const enfermeiro = { id: 'p1', name: 'Enfermeiro', departamento: 'Enfermagem', salarios: [{ unitId: null, salario: 3886.36 }, { unitId: 'vg', salario: 4100 }] }
  const tecnico = { id: 'p2', name: 'Técnico de Enfermagem', departamento: 'Enfermagem', salarios: [{ unitId: 'gru', salario: 2720.45 }] }
  const positions = [enfermeiro, tecnico]
  it('usa o salário da unidade e cai no padrão quando a unidade não tem valor próprio', () => {
    expect(salaryForUnit(enfermeiro, 'vg')).toBe(4100)
    expect(salaryForUnit(enfermeiro, 'gru')).toBe(3886.36)
    expect(salaryForUnit(tecnico, 'gru')).toBe(2720.45)
    expect(salaryForUnit(tecnico, 'vg')).toBeNull()
    expect(salaryForUnit(null, 'vg')).toBeNull()
  })
  it('escolhe o salário pela carga horária mensal e cai para "qualquer carga"', () => {
    const auxiliar = { salarios: [
      { unitId: 'gru', cargaHorariaMensal: 180, salario: 1800 },
      { unitId: 'gru', cargaHorariaMensal: 200, salario: 2000 },
      { unitId: null, cargaHorariaMensal: 220, salario: 2200 },
      { unitId: null, cargaHorariaMensal: null, salario: 1700 },
    ] }
    expect(salaryForUnit(auxiliar, 'gru', 180)).toBe(1800)
    expect(salaryForUnit(auxiliar, 'gru', 200)).toBe(2000)
    expect(salaryForUnit(auxiliar, 'gru', 220)).toBe(2200)
    expect(salaryForUnit(auxiliar, 'gru', 150)).toBe(1700)
    expect(salaryForUnit(auxiliar, 'vg', 180)).toBe(1700)
    expect(salaryForUnit({ salarios: [{ unitId: 'gru', cargaHorariaMensal: 200, salario: 2000 }] }, 'gru', 180)).toBeNull()
  })
  it('reconhece o cargo ignorando acento, caixa e espaços; rejeita o que não está cadastrado', () => {
    expect(findPosition(positions, '  tecnico de enfermagem ')?.name).toBe('Técnico de Enfermagem')
    expect(findPosition(positions, 'Médico')).toBeNull()
    expect(findPosition(positions, '')).toBeNull()
  })
  it('mantém os horários, intervalos e cargas mensais (padrão 180 horas)', () => {
    expect([...ADMISSION_SCHEDULES]).toEqual(['07h00 às 19h00', '19h00 às 07h00', '07h00 às 17h00', '08h00 às 17h00'])
    expect([...ADMISSION_BREAKS]).toEqual(['12h00 às 13h00', '20h00 às 21h00'])
    expect([...ADMISSION_MONTHLY_HOURS_OPTIONS]).toEqual([120, 150, 180, 200, 220])
    expect(ADMISSION_MONTHLY_HOURS).toBe(180)
  })
})

describe('catálogo de documentos da admissão', () => {
  const keys = DOCUMENT_CATALOG.map((d) => d.key)
  it('não repete chaves e não solicita a foto 3x4', () => {
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).not.toContain('foto_3x4')
    expect(keys).not.toContain('certidao')
  })
  it('inclui os documentos pedidos e marca como opcionais os dos filhos e o militar', () => {
    for (const key of ['carteira_vacinacao', 'certidao_nascimento', 'certificado_militar', 'comprovante_escolaridade', 'rg_cpf_filhos', 'certidao_nascimento_filhos', 'coren_carteirinha', 'conta_banco_brasil']) expect(keys).toContain(key)
    for (const key of ['certificado_militar', 'rg_cpf_filhos', 'certidao_nascimento_filhos']) expect(DOCUMENT_CATALOG.find((d) => d.key === key)?.required).toBe(false)
  })
})

describe('templates da admissão', () => {
  it('usa carga horária mensal e traz o formulário admissional', () => {
    const contrato = ADMISSION_TEMPLATE_DEFAULTS.find((t) => t.key === 'contrato_trabalho')!
    expect(contrato.version).toBe(3)
    expect(contrato.content).toContain('{{monthlyHours}}')
    expect(contrato.content).not.toContain('{{weeklyHours}}')
    expect(ADMISSION_TEMPLATE_DEFAULTS.find((t) => t.key === 'ficha_registro')?.content).toContain('FORMULÁRIO ADMISSIONAL')
  })
})
