import { prisma } from '@/lib/prisma'
import { createEmployee, findEmployeeByCpf, listErpnextResourceNames } from '@/lib/erpnextClient'
import { decryptAdmissionValue } from './security'
import { toErpnextMunicipio } from './municipios'

function text(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}

function tokens(value: string) {
  const ignored = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E', 'BHCL', 'BENEFICENCIA', 'HOSPITALAR', 'CESARIO', 'LANGE'])
  return normalize(value).split(' ').filter((token) => token.length > 1 && !ignored.has(token))
}

const GENERIC_LOCATION_TOKENS = new Set(['PA', 'UPA', 'PSI', 'PS', 'SEDE', 'UNIDADE', 'VG', 'GRU'])

/** Evita relacionar, por exemplo, Enfermagem de uma unidade com o departamento de outra. */
function bestScopedMatch(values: string[], subject: string, ...scopeHints: string[]) {
  const scope = new Set(scopeHints.flatMap(tokens).filter((token) => !GENERIC_LOCATION_TOKENS.has(token)))
  const scoped = scope.size ? values.filter((value) => tokens(value).some((token) => scope.has(token))) : values
  return scoped.length ? bestMatch(scoped, subject, ...scopeHints) : null
}

function bestMatch(values: string[], ...hints: string[]) {
  const wanted = new Set(hints.flatMap(tokens))
  if (!wanted.size) return null
  let best: { value: string; score: number } | null = null
  for (const value of values) {
    const candidate = new Set(tokens(value))
    const overlap = [...wanted].filter((token) => candidate.has(token)).length
    const exactBonus = hints.some((hint) => normalize(value) === normalize(hint)) ? 100 : 0
    const containsBonus = hints.some((hint) => normalize(value).includes(normalize(hint)) || normalize(hint).includes(normalize(value))) ? 20 : 0
    const score = exactBonus + containsBonus + overlap * 10 - Math.max(0, candidate.size - overlap)
    if (!best || score > best.score) best = { value, score }
  }
  return best && best.score >= 9 ? best.value : null
}

function isoDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString().slice(0, 10)
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  return {
    first_name: parts[0],
    middle_name: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
    last_name: parts.length > 1 ? parts[parts.length - 1] : undefined,
  }
}

export async function syncAdmissionToERPNext(admissionId: string) {
  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    include: { unit: { select: { name: true } }, fields: true },
  })
  if (!admission) throw new Error('Admissão não encontrada.')
  const fields = Object.fromEntries(admission.fields.map((field) => [field.key, field.sensitive ? decryptAdmissionValue(field.value) : field.value]))
  const cpf = text(fields.cpf).replace(/\D/g, '')
  const gender = text(fields.gender)
  const birthDate = text(fields.birthDate)
  if (!cpf) throw new Error('CPF não informado na admissão.')
  if (!gender) throw new Error('Gênero não informado. Solicite a atualização dos dados pessoais.')
  if (!birthDate) throw new Error('Data de nascimento não informada na admissão.')
  const duplicate = await findEmployeeByCpf(cpf)
  if (duplicate) return { employeeId: duplicate.name, employeeCode: duplicate.name }

  const [companies, branches, departments, designations, employmentTypes] = await Promise.all([
    listErpnextResourceNames('Company'),
    listErpnextResourceNames('Branch'),
    listErpnextResourceNames('Department'),
    listErpnextResourceNames('Designation'),
    listErpnextResourceNames('Employment Type'),
  ])
  const unitHint = admission.unit.name.includes(' - ') ? admission.unit.name.split(' - ').slice(1).join(' - ') : admission.unit.name
  const company = bestMatch(companies, admission.unit.name, unitHint)
  if (!company) throw new Error(`Não foi possível relacionar a unidade “${admission.unit.name}” a uma empresa do ERPNext.`)
  const branch = bestScopedMatch(branches, unitHint, admission.unit.name, unitHint)
  if (!branch) throw new Error(`Não foi possível relacionar a unidade “${admission.unit.name}” a um Local de Trabalho (Branch) do ERPNext. Cadastre o local correspondente no ERPNext antes de tentar novamente.`)
  const designation = bestMatch(designations, admission.jobTitle)
  if (!designation) throw new Error(`Não foi possível relacionar o cargo “${admission.jobTitle}” a um cargo do ERPNext.`)
  const department = bestScopedMatch(departments, admission.department || '', admission.unit.name, unitHint, branch, company)
  if (!department) throw new Error(`Não foi possível relacionar o departamento “${admission.department || 'não informado'}” e a unidade ao ERPNext.`)
  const employmentTypeHint = /indeterminado/i.test(admission.contractType) ? 'Prazo indeterminado' : /determinado/i.test(admission.contractType) ? 'Prazo determinado' : admission.contractType
  const employmentType = bestMatch(employmentTypes, employmentTypeHint)
  if (!employmentType) throw new Error(`Não foi possível relacionar o tipo de contrato “${admission.contractType}” ao ERPNext.`)
  if (admission.salary == null || admission.salary <= 0) throw new Error('Salário base não informado na admissão.')

  const employee = await createEmployee({
    ...splitName(admission.candidateName),
    employee_name: admission.candidateName,
    status: 'Active',
    gender,
    date_of_birth: isoDate(birthDate),
    date_of_joining: isoDate(admission.hireDate),
    company,
    branch,
    department,
    designation,
    employment_type: employmentType,
    ctc: admission.salary,
    cell_number: text(fields.phone) || undefined,
    personal_email: text(fields.email) || admission.candidateEmail || undefined,
    custom_cpf: cpf,
    custom_rg: text(fields.rg) || undefined,
    custom_pessoa_com_deficiência: text(fields.disability) === 'Sim' ? 1 : 0,
    custom_tipo_de_deficiencia: text(fields.disabilityDetails) || undefined,
    custom_etnia: text(fields.ethnicity) || undefined,
    custom_carga_horária_mensal: admission.monthlyHours || undefined,
    custom_naturalidade_cidade: toErpnextMunicipio(text(fields.birthCity)) || undefined,
  })
  return { employeeId: employee.name, employeeCode: employee.name }
}
