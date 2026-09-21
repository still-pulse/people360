import { addDays, diffDays, fmtCpf, fmtDate, fmtLongDate, fmtMoney, isoDay, parseDateInput, toDateInput } from './format'
import { AMENDMENT_FIELDS } from './snapshot'
import type { Snapshot } from './types'

export type Dados = Record<string, string>
export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select'
export type DocField = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: { value: string; label: string }[]
  help?: string
  /** Valor inicial vindo do cadastro (o RH só confirma; não redigita). */
  defaultFrom?: (snap: Snapshot) => string
}
export type SigSlot = { role: string; label: string; name?: (snap: Snapshot, dados: Dados) => string }
export type TableBlock = { head: string[]; rows: string[][]; widths?: number[]; empty?: string }
export type HistoricoDraft = { tipo: string; titulo: string; anterior?: string; novo?: string; motivo?: string; data: Date }

/** Seções do dossiê na ordem sugerida; `selecao` liga cada documento ao checkbox do modal de exportação. */
export const SECOES = [
  { id: 'contrato_trabalho', titulo: 'Contratos de trabalho', ordem: 50 },
  { id: 'contrato_experiencia', titulo: 'Contrato de experiência', ordem: 60 },
  { id: 'prorrogacoes', titulo: 'Prorrogações da experiência', ordem: 80 },
  { id: 'efetivacao', titulo: 'Efetivação da experiência', ordem: 100 },
  { id: 'aditivos', titulo: 'Aditivos contratuais', ordem: 120 },
  { id: 'acordos', titulo: 'Acordos individuais', ordem: 130 },
  { id: 'termos', titulo: 'Termos e declarações', ordem: 140 },
  { id: 'normas_ponto', titulo: 'Normas de cartão de ponto', ordem: 145 },
] as const
export type SecaoId = typeof SECOES[number]['id']

export type DocType = {
  tipo: string
  titulo: string
  categoria: string
  descricao: string
  templateKey: string
  secao: SecaoId
  flow?: 'aditivo'
  requires: { key: keyof Snapshot; label: string }[]
  fields: DocField[]
  signatures: SigSlot[]
  validate?: (snap: Snapshot, dados: Dados) => string[]
  vars?: (snap: Snapshot, dados: Dados) => Record<string, string>
  blocks?: (snap: Snapshot, dados: Dados) => Record<string, TableBlock>
  historico?: (snap: Snapshot, dados: Dados) => HistoricoDraft | null
  vigencia?: (dados: Dados) => { inicio: Date | null; fim: Date | null }
}

const REQ = {
  nome: { key: 'nome', label: 'Nome do colaborador' },
  cpf: { key: 'cpf', label: 'CPF' },
  cargo: { key: 'cargo', label: 'Cargo' },
  admissao: { key: 'admissao', label: 'Data de admissão' },
  salario: { key: 'salario', label: 'Salário (Dados cadastrais)' },
  jornada: { key: 'jornada', label: 'Jornada (Dados cadastrais)' },
  unidade: { key: 'unidade', label: 'Unidade' },
} as const satisfies Record<string, { key: keyof Snapshot; label: string }>

const num = (value: string | undefined, fallback = 0) => {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

const SIG = {
  empregadora: { role: 'EMPREGADORA', label: 'Representante da BHCL', name: (s: Snapshot) => s.empregador.nome },
  colaborador: { role: 'COLABORADOR', label: 'Colaborador(a)', name: (s: Snapshot) => s.nome },
  gestor: { role: 'GESTOR', label: 'Gestor(a) responsável', name: (s: Snapshot, d: Dados) => d.responsavel || s.gestor },
  rh: { role: 'RH', label: 'Recursos Humanos' },
  t1: { role: 'TESTEMUNHA_1', label: 'Testemunha 1' },
  t2: { role: 'TESTEMUNHA_2', label: 'Testemunha 2' },
} satisfies Record<string, SigSlot>

const dependentesAtivos = (s: Snapshot) => s.dependentes.filter((d) => !d.exclusaoEm)

function dependentesTable(s: Snapshot, kind: 'ir' | 'sf'): TableBlock {
  const list = dependentesAtivos(s).filter((d) => (kind === 'ir' ? d.dependenteIr : d.salarioFamilia))
  return kind === 'ir'
    ? { head: ['Nº', 'Nome completo', 'CPF', 'Nascimento', 'Parentesco'], widths: [10, 62, 32, 26, 34], empty: 'Nenhum dependente cadastrado para esta finalidade.', rows: list.map((d, i) => [String(i + 1), d.nome, fmtCpf(d.cpf), fmtDate(d.nascimento), d.parentesco]) }
    : { head: ['Nº', 'Nome do dependente', 'Nascimento', 'Parentesco', 'CPF', 'Inclusão'], widths: [10, 58, 24, 28, 30, 24], empty: 'Nenhum dependente cadastrado para esta finalidade.', rows: list.map((d, i) => [String(i + 1), d.nome, fmtDate(d.nascimento), d.parentesco, fmtCpf(d.cpf), fmtDate(d.inclusaoEm)]) }
}

export function contractPeriods(snap: Snapshot, dados: Dados) {
  const inicio = parseDateInput(dados.dataInicio) ?? (snap.admissao ? new Date(snap.admissao) : null)
  const p1 = num(dados.primeiroPeriodoDias, 45)
  const p2 = num(dados.segundoPeriodoDias, 0)
  if (!inicio) return null
  return {
    inicio, p1, p2, total: p1 + p2,
    fim1: addDays(inicio, p1 - 1),
    final: addDays(inicio, p1 + p2 - 1),
  }
}

/** Variáveis comuns a qualquer template (dados do cadastro já formatados em pt-BR). */
export function commonVars(s: Snapshot, actorName = ''): Record<string, string> {
  const cidade = process.env.ADMISSION_EMPLOYER_CITY || 'Guarulhos'
  return {
    empregadorNome: s.empregador.nome, empregadorCnpj: s.empregador.cnpj, empregadorEndereco: s.empregador.endereco,
    nome: s.nome, nomeSocial: s.nomeSocial, matricula: s.matricula, cpf: fmtCpf(s.cpf), rg: s.rg,
    rgOrgao: s.rgOrgao, rgUf: s.rgUf, pis: s.pis, ctpsNumero: s.ctpsNumero, ctpsSerie: s.ctpsSerie, ctpsUf: s.ctpsUf,
    estadoCivil: s.estadoCivil, nacionalidade: s.nacionalidade, escolaridade: s.escolaridade,
    enderecoCompleto: s.enderecoCompleto, cargo: s.cargo, funcao: s.funcao || s.cargo, setor: s.setor, unidade: s.unidade,
    centroCusto: s.centroCusto, cbo: s.cbo, tipoContrato: s.tipoContrato, salario: fmtMoney(s.salario),
    jornada: s.jornada, escala: s.escala, horario: s.horario, admissao: fmtDate(s.admissao), gestor: s.gestor,
    rhNome: actorName, data: fmtDate(new Date()), localData: `${cidade}, ${fmtLongDate()}`,
  }
}

const dateField = (key: string, label: string, required = true, defaultFrom?: (s: Snapshot) => string): DocField => ({ key, label, type: 'date', required, defaultFrom })

export const DOC_TYPES: DocType[] = [
  {
    tipo: 'CONTRATO_EXPERIENCIA', titulo: 'Contrato de Experiência', categoria: 'Contrato', secao: 'contrato_experiencia',
    descricao: 'Contrato por prazo determinado, com 1º período e prorrogação opcionais (máximo de 90 dias).',
    templateKey: 'colab_contrato_experiencia',
    requires: [REQ.nome, REQ.cpf, REQ.cargo, REQ.admissao, REQ.salario, REQ.jornada],
    fields: [
      dateField('dataInicio', 'Data de início', true, (s) => toDateInput(s.admissao)),
      { key: 'primeiroPeriodoDias', label: 'Primeiro período (dias)', type: 'number', required: true, defaultFrom: () => '45' },
      { key: 'segundoPeriodoDias', label: 'Segundo período / prorrogação (dias)', type: 'number', help: 'Use 0 se não houver prorrogação.', defaultFrom: () => '45' },
    ],
    signatures: [SIG.empregadora, SIG.colaborador, SIG.t1, SIG.t2],
    validate: (s, d) => {
      const p = contractPeriods(s, d)
      const errors: string[] = []
      if (!p) return ['Informe a data de início do contrato.']
      if (p.p1 < 1) errors.push('O primeiro período deve ter pelo menos 1 dia.')
      if (p.p2 < 0) errors.push('O segundo período não pode ser negativo.')
      if (p.total > 90) errors.push('O contrato de experiência não pode ultrapassar 90 dias (art. 445, parágrafo único, da CLT).')
      return errors
    },
    vars: (s, d) => {
      const p = contractPeriods(s, d)!
      return {
        dataInicio: fmtDate(p.inicio), primeiroPeriodoDias: String(p.p1), fimPrimeiroPeriodo: fmtDate(p.fim1),
        prazoTotalDias: String(p.total), dataFinal: fmtDate(p.final),
        clausulaProrrogacao: p.p2 > 0
          ? `O contrato poderá ser prorrogado uma única vez, por mais ${p.p2} dias, até ${fmtDate(p.final)}, mediante Termo de Prorrogação, observado o limite máximo de 90 (noventa) dias previsto no parágrafo único do artigo 445 da CLT.`
          : 'Não há previsão de prorrogação.',
      }
    },
    vigencia: (d) => ({ inicio: parseDateInput(d.dataInicio), fim: null }),
  },
  {
    tipo: 'CONTRATO_TRABALHO', titulo: 'Contrato de Trabalho (prazo indeterminado)', categoria: 'Contrato', secao: 'contrato_trabalho',
    descricao: 'Contrato por prazo indeterminado, inclusive o que sucede a experiência.',
    templateKey: 'colab_contrato_trabalho',
    requires: [REQ.nome, REQ.cpf, REQ.cargo, REQ.admissao, REQ.salario, REQ.jornada],
    fields: [
      dateField('dataInicio', 'Data de início do contrato'),
      { key: 'observacoes', label: 'Cláusulas adicionais (opcional)', type: 'textarea' },
    ],
    signatures: [SIG.empregadora, SIG.colaborador, SIG.t1, SIG.t2],
    validate: (_s, d) => (parseDateInput(d.dataInicio) ? [] : ['Informe a data de início do contrato.']),
    vars: (_s, d) => ({ dataInicio: fmtDate(parseDateInput(d.dataInicio)), observacoes: d.observacoes || '' }),
    vigencia: (d) => ({ inicio: parseDateInput(d.dataInicio), fim: null }),
  },
  {
    tipo: 'PRORROGACAO', titulo: 'Prorrogação do Contrato de Experiência', categoria: 'Contrato', secao: 'prorrogacoes',
    descricao: 'Termo de prorrogação do contrato de experiência, com o novo prazo final.',
    templateKey: 'colab_prorrogacao',
    requires: [REQ.nome, REQ.cpf, REQ.cargo, REQ.admissao],
    fields: [
      dateField('dataInicial', 'Data inicial da experiência', true, (s) => toDateInput(s.admissao)),
      dateField('fimPrimeiroPeriodo', 'Data final do primeiro período'),
      dateField('novaDataFinal', 'Nova data final'),
      { key: 'responsavel', label: 'Responsável (gestor)', type: 'text', defaultFrom: (s) => s.gestor },
    ],
    signatures: [SIG.gestor, SIG.rh, SIG.colaborador],
    validate: (_s, d) => {
      const inicio = parseDateInput(d.dataInicial), fim1 = parseDateInput(d.fimPrimeiroPeriodo), nova = parseDateInput(d.novaDataFinal)
      if (!inicio || !fim1 || !nova) return ['Informe a data inicial, o fim do primeiro período e a nova data final.']
      const errors: string[] = []
      if (nova <= fim1) errors.push('A nova data final deve ser posterior ao fim do primeiro período.')
      if (diffDays(inicio, nova) + 1 > 90) errors.push('A experiência, somada à prorrogação, não pode ultrapassar 90 dias (art. 445, parágrafo único, da CLT).')
      return errors
    },
    vars: (_s, d) => {
      const inicio = parseDateInput(d.dataInicial)!, fim1 = parseDateInput(d.fimPrimeiroPeriodo)!, nova = parseDateInput(d.novaDataFinal)!
      return {
        dataInicial: fmtDate(inicio), fimPrimeiroPeriodo: fmtDate(fim1), novaDataFinal: fmtDate(nova),
        diasProrrogados: String(diffDays(fim1, nova)), prazoTotalDias: String(diffDays(inicio, nova) + 1),
      }
    },
    historico: (_s, d) => {
      const fim1 = parseDateInput(d.fimPrimeiroPeriodo)!, nova = parseDateInput(d.novaDataFinal)!
      return { tipo: 'PRORROGACAO', titulo: 'Prorrogação do contrato de experiência', anterior: `até ${fmtDate(fim1)}`, novo: `até ${fmtDate(nova)}`, data: addDays(fim1, 1) }
    },
    vigencia: (d) => ({ inicio: parseDateInput(d.fimPrimeiroPeriodo), fim: parseDateInput(d.novaDataFinal) }),
  },
  {
    tipo: 'EFETIVACAO', titulo: 'Efetivação do Contrato de Experiência', categoria: 'Contrato', secao: 'efetivacao',
    descricao: 'Parecer do gestor sobre efetivar, não efetivar ou prorrogar a experiência.',
    templateKey: 'colab_efetivacao',
    requires: [REQ.nome, REQ.cargo, REQ.admissao, REQ.unidade],
    fields: [
      dateField('dataPrevistaEncerramento', 'Data prevista para o encerramento da experiência'),
      { key: 'resultado', label: 'Resultado', type: 'select', required: true, options: [{ value: 'EFETIVAR', label: 'Efetivar colaborador' }, { value: 'NAO_EFETIVAR', label: 'Não efetivar colaborador' }, { value: 'PRORROGAR', label: 'Prorrogar experiência' }] },
      { key: 'parecer', label: 'Justificativa / Parecer do Gestor', type: 'textarea', required: true },
      { key: 'responsavel', label: 'Responsável', type: 'text', required: true, defaultFrom: (s) => s.gestor },
      dateField('data', 'Data', true, () => isoDay()),
      { key: 'observacoes', label: 'Observações', type: 'textarea' },
    ],
    signatures: [SIG.gestor, SIG.rh],
    validate: (_s, d) => (['EFETIVAR', 'NAO_EFETIVAR', 'PRORROGAR'].includes(d.resultado) ? [] : ['Selecione o resultado da experiência.']),
    vars: (_s, d) => ({
      dataPrevistaEncerramento: fmtDate(parseDateInput(d.dataPrevistaEncerramento)), data: fmtDate(parseDateInput(d.data)),
      resEfetivar: d.resultado === 'EFETIVAR' ? '(X)' : '( )', resNaoEfetivar: d.resultado === 'NAO_EFETIVAR' ? '(X)' : '( )', resProrrogar: d.resultado === 'PRORROGAR' ? '(X)' : '( )',
      parecer: d.parecer || '', observacoes: d.observacoes || '—', responsavel: d.responsavel || '',
    }),
    historico: (_s, d) => {
      const data = parseDateInput(d.data) ?? new Date()
      if (d.resultado === 'EFETIVAR') return { tipo: 'EFETIVACAO', titulo: 'Efetivação do colaborador', novo: 'Efetivado(a)', motivo: d.parecer, data }
      if (d.resultado === 'PRORROGAR') return { tipo: 'PRORROGACAO', titulo: 'Parecer: prorrogar a experiência', motivo: d.parecer, data }
      return { tipo: 'OUTRO', titulo: 'Parecer: não efetivar o colaborador', motivo: d.parecer, data }
    },
    vigencia: (d) => ({ inicio: parseDateInput(d.data), fim: null }),
  },
  {
    tipo: 'ADITIVO_CONTRATUAL', titulo: 'Aditivo Contratual', categoria: 'Aditivo', secao: 'aditivos', flow: 'aditivo',
    descricao: 'Alteração de cargo, salário, jornada, unidade e demais cláusulas, sem sobrescrever o histórico.',
    templateKey: 'colab_aditivo',
    requires: [REQ.nome, REQ.cpf, REQ.cargo, REQ.admissao, REQ.unidade],
    fields: [],
    signatures: [SIG.empregadora, SIG.colaborador, SIG.t1, SIG.t2],
    vars: (_s, d) => ({
      campoAlterado: d.campoAlterado || '', vigencia: fmtDate(parseDateInput(d.vigencia)), motivo: d.motivo || '',
      clausulasAdicionais: d.clausulas ? `## CLÁUSULA 2ª — DAS CLÁUSULAS ADICIONAIS\n${d.clausulas}` : '',
    }),
    blocks: (_s, d) => ({
      aditivo: {
        head: ['Cláusula alterada', 'Informação anterior', 'Nova informação', 'Vigência'], widths: [42, 50, 50, 26],
        rows: [[d.campoAlterado || '—', d.anteriorFmt || '—', d.novoFmt || '—', fmtDate(parseDateInput(d.vigencia))]],
      },
    }),
    vigencia: (d) => ({ inicio: parseDateInput(d.vigencia), fim: null }),
  },
  {
    tipo: 'ACORDO_COMPENSACAO', titulo: 'Acordo de Compensação de Horas', categoria: 'Acordo', secao: 'acordos',
    descricao: 'Acordo individual para compensação de horas de trabalho.',
    templateKey: 'colab_acordo_compensacao',
    requires: [REQ.nome, REQ.cargo, REQ.unidade, REQ.jornada],
    fields: [
      { key: 'horario', label: 'Horário', type: 'text', required: true, defaultFrom: (s) => s.horario },
      { key: 'modelo', label: 'Modelo de compensação', type: 'select', required: true, options: [{ value: 'Compensação no mesmo mês', label: 'Compensação no mesmo mês' }, { value: 'Banco de horas semestral', label: 'Banco de horas semestral' }, { value: 'Compensação semanal', label: 'Compensação semanal' }, { value: 'Outro (descrito nas observações)', label: 'Outro (descrito nas observações)' }] },
      dateField('vigenciaInicio', 'Início da vigência', true, () => isoDay()),
      dateField('vigenciaFim', 'Fim da vigência (opcional)', false),
      { key: 'observacoes', label: 'Observações', type: 'textarea' },
    ],
    signatures: [SIG.empregadora, SIG.colaborador],
    vars: (_s, d) => ({
      vigenciaInicio: fmtDate(parseDateInput(d.vigenciaInicio)),
      vigenciaFimTexto: parseDateInput(d.vigenciaFim) ? ` até ${fmtDate(parseDateInput(d.vigenciaFim))}` : ', por prazo indeterminado',
      horario: d.horario || '', modelo: d.modelo || '', observacoes: d.observacoes || '',
    }),
    vigencia: (d) => ({ inicio: parseDateInput(d.vigenciaInicio), fim: parseDateInput(d.vigenciaFim) }),
  },
  {
    tipo: 'DECLARACAO_DEPENDENTES_IR', titulo: 'Declaração de Dependentes (Imposto de Renda)', categoria: 'Dependente', secao: 'termos',
    descricao: 'Declaração de encargos de família para fins de IRRF, com os dependentes cadastrados.',
    templateKey: 'colab_declaracao_dependentes_ir',
    requires: [REQ.nome, REQ.cpf],
    fields: [],
    signatures: [SIG.colaborador],
    validate: (s) => (dependentesAtivos(s).some((d) => d.dependenteIr) ? [] : ['Nenhum dependente está marcado como dependente de Imposto de Renda.']),
    blocks: (s) => ({ dependentes_ir: dependentesTable(s, 'ir') }),
  },
  {
    tipo: 'TERMO_RESPONSABILIDADE', titulo: 'Termo de Responsabilidade (Salário-Família)', categoria: 'Termo', secao: 'termos',
    descricao: 'Termo de responsabilidade para concessão de salário-família, com os dependentes abrangidos.',
    templateKey: 'colab_termo_responsabilidade',
    requires: [REQ.nome],
    fields: [],
    signatures: [SIG.colaborador],
    validate: (s) => (dependentesAtivos(s).some((d) => d.salarioFamilia) ? [] : ['Nenhum dependente está marcado para salário-família.']),
    blocks: (s) => ({ dependentes_sf: dependentesTable(s, 'sf') }),
  },
  {
    tipo: 'FICHA_SALARIO_FAMILIA', titulo: 'Ficha de Salário-Família', categoria: 'Termo', secao: 'termos',
    descricao: 'Ficha de controle do salário-família, com dependentes e datas de entrega.',
    templateKey: 'colab_ficha_salario_familia',
    requires: [REQ.nome, REQ.admissao],
    fields: [{ key: 'valorCota', label: 'Valor de uma cota (opcional)', type: 'text', help: 'Ex.: 65,00' }],
    signatures: [SIG.colaborador, SIG.rh],
    validate: (s) => (dependentesAtivos(s).some((d) => d.salarioFamilia) ? [] : ['Nenhum dependente está marcado para salário-família.']),
    vars: (_s, d) => ({ valorCota: d.valorCota ? fmtMoney(d.valorCota) : '—' }),
    blocks: (s) => ({ dependentes_sf: dependentesTable(s, 'sf') }),
  },
  {
    tipo: 'NORMAS_PONTO', titulo: 'Normas de Cartão de Ponto', categoria: 'Termo', secao: 'normas_ponto',
    descricao: 'Normas para ocorrências de cartão de ponto, com declaração de ciência.',
    templateKey: 'colab_normas_ponto',
    requires: [REQ.nome, REQ.cargo, REQ.unidade],
    fields: [dateField('data', 'Data', true, () => isoDay())],
    signatures: [SIG.colaborador],
    vars: (_s, d) => ({ data: fmtDate(parseDateInput(d.data)) }),
    vigencia: (d) => ({ inicio: parseDateInput(d.data), fim: null }),
  },
  {
    tipo: 'OUTRO_DOCUMENTO', titulo: 'Outro Documento', categoria: 'Outro', secao: 'termos',
    descricao: 'Declaração, termo ou comunicado livre, com identificação automática do colaborador.',
    templateKey: 'colab_outro_documento',
    requires: [REQ.nome],
    fields: [
      { key: 'titulo', label: 'Título do documento', type: 'text', required: true },
      { key: 'categoria', label: 'Categoria', type: 'select', options: ['Termo', 'Declaração', 'Acordo', 'Contrato', 'Outro'].map((v) => ({ value: v, label: v })) },
      { key: 'corpo', label: 'Texto do documento', type: 'textarea', required: true },
    ],
    signatures: [SIG.colaborador, SIG.rh],
    vars: (_s, d) => ({ titulo: (d.titulo || '').toUpperCase(), corpo: d.corpo || '' }),
  },
]

export const DOC_TYPE_MAP = new Map(DOC_TYPES.map((t) => [t.tipo, t]))

export function getDocType(tipo: string) {
  return DOC_TYPE_MAP.get(tipo)
}

/** Rótulo de exibição do valor de um campo alterado por aditivo (salário formatado, demais em texto). */
export function amendmentValueLabel(tipoAlteracao: string, value: string | null | undefined) {
  if (value == null || value === '') return '—'
  return tipoAlteracao === 'SALARIO' ? fmtMoney(value) : value
}

export function amendmentLabel(tipo: string) {
  return AMENDMENT_FIELDS[tipo]?.label ?? tipo
}

/** Normaliza o que o formulário enviou: só campos conhecidos, texto aparado e com limite de tamanho. */
export function normalizeDados(type: DocType, raw: unknown): Dados {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out: Dados = {}
  for (const field of type.fields) {
    const value = source[field.key]
    const text = value == null ? '' : String(value).trim()
    out[field.key] = text.slice(0, field.type === 'textarea' ? 8000 : 300)
  }
  return out
}

export function validateDados(type: DocType, snap: Snapshot, dados: Dados): string[] {
  const errors: string[] = []
  for (const field of type.fields) {
    if (field.required && !dados[field.key]) errors.push(`Informe: ${field.label}.`)
    if (field.type === 'date' && dados[field.key] && !parseDateInput(dados[field.key])) errors.push(`Data inválida: ${field.label}.`)
    if (field.type === 'select' && dados[field.key] && field.options && !field.options.some((o) => o.value === dados[field.key])) errors.push(`Valor inválido: ${field.label}.`)
  }
  if (!errors.length && type.validate) errors.push(...type.validate(snap, dados))
  return errors
}
