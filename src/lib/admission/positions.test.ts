import { describe, expect, it } from 'vitest'
import { DOCUMENT_CATALOG } from './documentCatalog'
import { ADMISSION_MONTHLY_HOURS, ADMISSION_POSITIONS, ADMISSION_SCHEDULES, findPosition } from './positions'
import { ADMISSION_TEMPLATE_DEFAULTS } from './templateDefaults'

describe('cargos, salários e horários fixos', () => {
  it('define o salário pelo cargo', () => {
    expect(findPosition('Enfermeiro')?.salario).toBe(3886.36)
    expect(findPosition('Técnico de Enfermagem')?.salario).toBe(2720.45)
  })
  it('reconhece o cargo ignorando acento, caixa e espaços; rejeita o que não está na lista', () => {
    expect(findPosition('  tecnico de enfermagem ')?.cargo).toBe('Técnico de Enfermagem')
    expect(findPosition('Médico')).toBeNull()
    expect(findPosition('')).toBeNull()
  })
  it('mantém os dois horários e a carga mensal de 180 horas', () => {
    expect([...ADMISSION_SCHEDULES]).toEqual(['07h00 às 19h00', '19h00 às 07h00'])
    expect(ADMISSION_MONTHLY_HOURS).toBe(180)
    expect(ADMISSION_POSITIONS.every((p) => p.departamento === 'Enfermagem')).toBe(true)
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
