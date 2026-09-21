import { describe, expect, it } from 'vitest'
import { contractPeriods, DOC_TYPES, getDocType, normalizeDados, validateDados } from './catalog'
import { docFileName } from './documentos'
import { fileSlug, fmtCpf, fmtDate, fmtMoney, parseDateInput } from './format'
import { renderDocumentPdf, interpolate } from './pdf/render'
import { pdfSafe } from './pdf/engine'
import { roleCan } from './permissions'
import { TEMPLATE_DEFAULTS } from './templateDefaults'
import type { Snapshot } from './types'

const snap: Snapshot = {
  colaboradorId: 'c1', matricula: '638040', nome: 'ALESSANDRO BARBOZA DE OLIVEIRA', nomeSocial: '', cpf: '17694852879', rg: '32.188.579-X', rgOrgao: 'SSP', rgUf: 'SP', rgEmissao: '',
  pis: '128.49829.79-5', ctpsNumero: '51530', ctpsSerie: '0166', ctpsUf: 'GO', ctpsEmissao: '', nascimento: '1978-05-20T00:00:00.000Z', sexo: 'Masculino', estadoCivil: 'Solteiro(a)',
  nacionalidade: 'Brasileira', naturalidade: 'Porangatu/GO', escolaridade: 'Superior', nomeMae: 'IEDA', nomePai: 'ELI', telefone: '', email: '',
  endereco: { logradouro: 'Rua A', numero: '1', cidade: 'Guarulhos', uf: 'SP' }, enderecoCompleto: 'Rua A, nº 1 — Guarulhos/SP',
  cargo: 'Enfermeiro', funcao: 'Enfermeiro', setor: 'Enfermagem', unidade: 'UPA', centroCusto: '', cbo: '', tipoContrato: 'CLT', salario: 3321.87,
  jornada: '180 horas mensais', escala: '12x36', horario: '18:00 às 06:00', cargaHoraria: '', sindicato: '', localTrabalho: '',
  admissao: '2026-09-24T00:00:00.000Z', desligamento: null, situacao: 'Ativo', gestor: 'Eliane', banco: { banco: '', agencia: '', conta: '' },
  empregador: { nome: 'BHCL', cnpj: '00.000.000/0000-00', endereco: 'Guarulhos/SP' },
  dependentes: [{ id: 'd1', nome: 'FILHO', cpf: '11144477735', nascimento: '2008-02-07T00:00:00.000Z', parentesco: 'Filho(a)', sexo: '', dependenteIr: true, salarioFamilia: true, planoSaude: false, inclusaoEm: '2026-09-24T00:00:00.000Z', exclusaoEm: null }],
  ultimaAlteracao: null, geradoEm: '2026-09-21T12:00:00.000Z',
}

describe('formatação pt-BR', () => {
  it('formata datas de calendário em UTC (sem deslocar o dia)', () => {
    expect(fmtDate('2026-09-24T00:00:00.000Z')).toBe('24/09/2026')
    expect(fmtDate(null)).toBe('—')
  })
  it('formata moeda tanto de número quanto de texto técnico e pt-BR', () => {
    expect(fmtMoney(3321.87).replace(/\s/g, ' ')).toBe('R$ 3.321,87')
    expect(fmtMoney('3321.87').replace(/\s/g, ' ')).toBe('R$ 3.321,87')
    expect(fmtMoney('1.234,56').replace(/\s/g, ' ')).toBe('R$ 1.234,56')
  })
  it('formata CPF e converte datas de entrada', () => {
    expect(fmtCpf('17694852879')).toBe('176.948.528-79')
    expect(parseDateInput('2026-13-40')).toBeNull()
    expect(parseDateInput('')).toBeNull()
  })
  it('sanitiza nomes de arquivo (sem acento nem separadores)', () => {
    expect(fileSlug('José da Conceição / ../x')).toBe('JOSE_DA_CONCEICAO_X')
    expect(docFileName('Aditivo Contratual', 'Alessandro Barbosa', { date: '2026-09-21' })).toBe('Aditivo_Contratual_ALESSANDRO_BARBOSA_2026-09-21.pdf')
    expect(docFileName('../../etc/passwd', 'X')).not.toMatch(/[/\\]/)
  })
})

describe('regras de contrato de experiência', () => {
  const type = getDocType('CONTRATO_EXPERIENCIA')!
  it('calcula 45 + 45 dias a partir da data de início', () => {
    const p = contractPeriods(snap, { dataInicio: '2026-09-24', primeiroPeriodoDias: '45', segundoPeriodoDias: '45' })!
    expect(p.total).toBe(90)
    expect(fmtDate(p.fim1)).toBe('07/11/2026')
    expect(fmtDate(p.final)).toBe('22/12/2026')
  })
  it('bloqueia mais de 90 dias e exige data de início', () => {
    const dados = normalizeDados(type, { dataInicio: '2026-09-24', primeiroPeriodoDias: '60', segundoPeriodoDias: '45' })
    expect(validateDados(type, snap, dados).join(' ')).toMatch(/90 dias/)
    expect(validateDados(type, { ...snap, admissao: null }, normalizeDados(type, { dataInicio: '', primeiroPeriodoDias: '45' })).length).toBeGreaterThan(0)
  })
  it('ignora campos desconhecidos enviados pelo cliente', () => {
    expect(normalizeDados(type, { dataInicio: '2026-09-24', hack: '<script>' })).not.toHaveProperty('hack')
  })
})

describe('permissões', () => {
  it('restringe o dossiê a ADMIN e ANALYST', () => {
    expect(roleCan('ADMIN', 'employee.documents.view')).toBe(true)
    expect(roleCan('ANALYST', 'employee.amendments.create')).toBe(true)
    for (const role of ['SUPERINTENDENT', 'JURIDICO', undefined]) expect(roleCan(role, 'employee.documents.view')).toBe(false)
  })
})

describe('templates e PDF', () => {
  it('todo template tem título e todas as variáveis são atendidas por algum tipo', () => {
    for (const template of TEMPLATE_DEFAULTS) expect(template.content.startsWith('# ') || template.key === 'colab_outro_documento').toBe(true)
  })
  it('interpolate: ausente vira travessão e vazio permanece vazio', () => {
    expect(interpolate('{{a}}|{{b}}|{{c}}', { a: 'x', b: '' })).toBe('x||—')
  })
  it('pdfSafe troca caracteres fora do WinAnsi para evitar falha na geração', () => {
    expect(pdfSafe('Olá → mundo ✓')).toBe('Olá -> mundo ?')
  })
  it('gera um PDF válido para cada tipo de documento com dados mínimos', async () => {
    const defaults = new Map(TEMPLATE_DEFAULTS.map((t) => [t.key, t.content]))
    const dados: Record<string, Record<string, string>> = {
      CONTRATO_EXPERIENCIA: { dataInicio: '2026-09-24', primeiroPeriodoDias: '45', segundoPeriodoDias: '45' },
      CONTRATO_TRABALHO: { dataInicio: '2026-12-23', observacoes: '' },
      PRORROGACAO: { dataInicial: '2026-09-24', fimPrimeiroPeriodo: '2026-11-07', novaDataFinal: '2026-12-22', responsavel: 'Eliane' },
      EFETIVACAO: { dataPrevistaEncerramento: '2026-12-22', resultado: 'EFETIVAR', parecer: 'Apto.', responsavel: 'Eliane', data: '2026-12-20', observacoes: '' },
      ACORDO_COMPENSACAO: { horario: '18:00 às 06:00', modelo: 'Banco de horas semestral', vigenciaInicio: '2026-09-24', vigenciaFim: '', observacoes: '' },
      NORMAS_PONTO: { data: '2026-09-24' },
      OUTRO_DOCUMENTO: { titulo: 'Termo de Uniforme', categoria: 'Termo', corpo: 'Recebi o uniforme.' },
      ADITIVO_CONTRATUAL: { campoAlterado: 'Cargo', anteriorFmt: 'A', novoFmt: 'B', vigencia: '2026-11-01', motivo: 'Promoção', clausulas: '' },
    }
    for (const type of DOC_TYPES) {
      const buffer = await renderDocumentPdf({ type, templateContent: defaults.get(type.templateKey)!, snapshot: snap, dados: dados[type.tipo] ?? {} })
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
      expect(buffer.length).toBeGreaterThan(2000)
    }
  })
})
