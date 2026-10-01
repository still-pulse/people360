import { formatCep, formatCpf, formatPhone, formatPis } from '../fieldFormatters'

// Dados do colaborador, da vaga e do empregador já no formato dos documentos oficiais.

export type EmployerData = { nome: string; cnpj: string; logradouro: string; bairro: string; cidade: string; uf: string }

export type FormDependent = { name: string; birthDate: Date; relationship: string; irrf: boolean; under14: boolean }
export type FormRoute = { type: string; line: string; outbound: number; returnValue: number }

export type FormContext = {
  protocol: string
  employer: EmployerData
  person: {
    name: string; cpf: string; rg: string; rgIssuedAt: string; rgIssuer: string; birthDate: string; birthPlace: string
    nationality: string; maritalStatus: string; fatherName: string; motherName: string; ethnicity: string; gender: string
    education: string; phone: string; pis: string; voterTitle: string; voterZone: string; voterSection: string
    disability: boolean; disabilityDetails: string; registration: string
  }
  address: { street: string; number: string; complement: string; district: string; city: string; state: string; zipCode: string }
  job: { title: string; unit: string; department: string; cbo: string; salary: number | null; schedule: string; breakSchedule: string; hireDate: Date; experienceDays: number | null }
  dependents: FormDependent[]
  transport: { requested: boolean | null; routes: FormRoute[] }
  pcd: Record<string, string>
  /** Data em que o documento é emitido (assinatura). */
  issuedAt: Date
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const GENEROS: Record<string, string> = { Female: 'Feminino', Male: 'Masculino', Other: 'Outro' }

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value)).trim()

/** Datas "só dia" (contratação, nascimento) são gravadas à meia-noite UTC: formatar em UTC evita voltar um dia. */
export function dmy(value: Date | string | null | undefined) {
  if (!value) return ''
  if (typeof value === 'string') {
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
    return value
  }
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(value)
}

/** "24 de Agosto de 2026" (mês com inicial maiúscula, como no relatório). */
export function longDate(value: Date) {
  return `${value.getUTCDate()} de ${MESES[value.getUTCMonth()]} de ${value.getUTCFullYear()}`
}

/** O dia de hoje em São Paulo, como data "só dia" (meia-noite UTC), para combinar com dmy/longDate. */
export function saoPauloDay(value = new Date()) {
  const [day, month, year] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(value).split('/').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000)
}

/** Contrato de experiência: 1º período de até 45 dias e prorrogação até completar o prazo total (máx. 90). */
export function experiencePeriods(hireDate: Date, experienceDays: number | null) {
  const total = Math.max(1, Math.min(90, experienceDays || 90))
  const first = Math.min(45, total)
  const extension = total - first
  return { total, first, firstEnd: addDays(hireDate, first - 1), extension, totalEnd: extension ? addDays(hireDate, total - 1) : null }
}

/** "07h00 às 19h00" → "07:00 às 19:00". */
export function scheduleText(value: string) {
  return value.replace(/(\d{1,2})h(\d{2})/g, '$1:$2')
}

/** Separa "Guarulhos - SP" em cidade e UF. */
export function splitCity(value: string, fallbackUf = '') {
  const match = /^(.*?)\s*[-/]\s*([A-Za-z]{2})$/.exec(value.trim())
  return match ? { city: match[1].trim(), uf: match[2].toUpperCase() } : { city: value.trim(), uf: fallbackUf.toUpperCase() }
}

export function money(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function upper(value: string) {
  return value.toLocaleUpperCase('pt-BR')
}

type EmployerConfig = Partial<EmployerData> & { endereco?: string }

/**
 * Empregador da unidade: ADMISSION_EMPLOYERS_BY_UNIT[unitId] (nome, cnpj, logradouro, bairro, cidade, uf),
 * com o cadastro padrão (ADMISSION_EMPLOYER_*, Matriz em Cesário Lange) para o que não estiver configurado.
 */
export function employerForUnit(unitId?: string | null): EmployerData {
  let configured: Record<string, EmployerConfig> = {}
  try { configured = JSON.parse(process.env.ADMISSION_EMPLOYERS_BY_UNIT || '{}') } catch { configured = {} }
  const unit = (unitId && configured[unitId]) || {}
  return {
    nome: upper(unit.nome || process.env.ADMISSION_EMPLOYER_LEGAL_NAME || 'BENEFICENCIA HOSPITALAR DE CESARIO LANGE'),
    cnpj: unit.cnpj || process.env.ADMISSION_EMPLOYER_CNPJ || '50.351.626/0001-10',
    logradouro: upper(unit.logradouro || process.env.ADMISSION_EMPLOYER_STREET || 'AVENIDA SÃO PAULO, 340'),
    bairro: upper(unit.bairro || process.env.ADMISSION_EMPLOYER_DISTRICT || 'VILA BRASIL'),
    cidade: upper(unit.cidade || process.env.ADMISSION_EMPLOYER_CITY || 'CESÁRIO LANGE'),
    uf: upper(unit.uf || process.env.ADMISSION_EMPLOYER_UF || 'SP'),
  }
}

type AdmissionForForms = {
  protocol: string; candidateName: string; unitId: string; jobTitle: string; department: string | null; salary: number | null
  workSchedule: string | null; breakSchedule: string | null; hireDate: Date; experienceDays: number | null
  unit: { name: string }
  dependents: { name: string; birthDate: Date; relationship: string; irrfDependent: boolean; childUnder14: boolean }[]
  transport: { requested: boolean; routes: FormRoute[] } | null
}

export function buildFormContext(admission: AdmissionForForms, fields: Record<string, unknown>, extra: { cbo?: string | null; issuedAt?: Date; registration?: string | null } = {}): FormContext {
  const addressCity = splitCity(text(fields.city), text(fields.state))
  const birth = splitCity(text(fields.birthCity))
  const pcd: Record<string, string> = {}
  for (const key of ['pcdReport', 'pcdType', 'pcdDegree', 'pcdShareReport', 'pcdSupport', 'pcdBenefits']) pcd[key] = text(fields[key])
  return {
    protocol: admission.protocol,
    employer: employerForUnit(admission.unitId),
    person: {
      name: upper(text(fields.name) || admission.candidateName),
      cpf: text(fields.cpf) ? formatCpf(text(fields.cpf)) : '',
      rg: text(fields.rg), rgIssuedAt: dmy(text(fields.rgIssuedAt)), rgIssuer: upper(text(fields.rgIssuer)),
      birthDate: dmy(text(fields.birthDate)),
      birthPlace: birth.city ? upper(birth.uf ? `${birth.city} - ${birth.uf}` : birth.city) : '',
      nationality: upper(text(fields.nationality) || 'Brasil'),
      maritalStatus: text(fields.maritalStatus), fatherName: upper(text(fields.fatherName)), motherName: upper(text(fields.motherName)),
      ethnicity: text(fields.ethnicity) === 'Não informado' ? '' : text(fields.ethnicity),
      gender: GENEROS[text(fields.gender)] ?? '', education: text(fields.education),
      phone: text(fields.phone) ? formatPhone(text(fields.phone)) : '', pis: text(fields.pis) ? formatPis(text(fields.pis)) : '',
      voterTitle: text(fields.voterTitle), voterZone: text(fields.voterZone), voterSection: text(fields.voterSection),
      disability: text(fields.disability) === 'Sim', disabilityDetails: text(fields.disabilityDetails), registration: text(extra.registration),
    },
    address: {
      street: text(fields.street), number: text(fields.number), complement: text(fields.complement), district: text(fields.district),
      city: addressCity.city, state: text(fields.state).toUpperCase() || addressCity.uf, zipCode: text(fields.zipCode) ? formatCep(text(fields.zipCode)) : '',
    },
    job: {
      title: admission.jobTitle, unit: admission.unit.name, department: admission.department || '', cbo: text(extra.cbo),
      salary: admission.salary, schedule: scheduleText(text(admission.workSchedule)), breakSchedule: scheduleText(text(admission.breakSchedule)),
      hireDate: admission.hireDate, experienceDays: admission.experienceDays,
    },
    dependents: admission.dependents.map((dependent) => ({ name: upper(dependent.name), birthDate: dependent.birthDate, relationship: dependent.relationship, irrf: dependent.irrfDependent, under14: dependent.childUnder14 })),
    transport: { requested: admission.transport ? admission.transport.requested : null, routes: admission.transport?.requested ? admission.transport.routes : [] },
    pcd,
    issuedAt: saoPauloDay(extra.issuedAt ?? new Date()),
  }
}
