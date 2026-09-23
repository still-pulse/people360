import { prisma } from '@/lib/prisma'
import { createEmployee, findEmployeeByCpf, listErpnextResourceNames } from '@/lib/erpnextClient'
import { decryptAdmissionValue } from './security'

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

  const [companies, departments, designations, employmentTypes] = await Promise.all([
    listErpnextResourceNames('Company'),
    listErpnextResourceNames('Department'),
    listErpnextResourceNames('Designation'),
    listErpnextResourceNames('Employment Type'),
  ])
  const unitHint = admission.unit.name.includes(' - ') ? admission.unit.name.split(' - ').slice(1).join(' - ') : admission.unit.name
  const company = bestMatch(companies, admission.unit.name, unitHint)
  if (!company) throw new Error(`Não foi possível relacionar a unidade “${admission.unit.name}” a uma empresa do ERPNext.`)
  const designation = bestMatch(designations, admission.jobTitle)
  if (!designation) throw new Error(`Não foi possível relacionar o cargo “${admission.jobTitle}” a um cargo do ERPNext.`)
  const department = bestMatch(departments, `${admission.department || ''} ${unitHint}`, admission.department || '', unitHint)
  if (!department) throw new Error(`Não foi possível relacionar o departamento “${admission.department || 'não informado'}” e a unidade ao ERPNext.`)
  const employmentTypeHint = /indeterminado/i.test(admission.contractType) ? 'Prazo indeterminado' : /determinado/i.test(admission.contractType) ? 'Prazo determinado' : admission.contractType
  const employmentType = bestMatch(employmentTypes, employmentTypeHint)

  const employee = await createEmployee({
    ...splitName(admission.candidateName),
    employee_name: admission.candidateName,
    status: 'Active',
    gender,
    date_of_birth: isoDate(birthDate),
    date_of_joining: isoDate(admission.hireDate),
    company,
    department,
    designation,
    ...(employmentType ? { employment_type: employmentType } : {}),
    cell_number: text(fields.phone) || undefined,
    personal_email: text(fields.email) || admission.candidateEmail || undefined,
    custom_cpf: cpf,
    custom_rg: text(fields.rg) || undefined,
    custom_pessoa_com_deficiência: text(fields.disability) === 'Sim' ? 1 : 0,
    custom_tipo_de_deficiencia: text(fields.disabilityDetails) || undefined,
    custom_etnia: text(fields.ethnicity) || undefined,
    custom_carga_horária_mensal: admission.monthlyHours || undefined,
    custom_naturalidade_cidade: text(fields.birthCity) || undefined,
  })
  return { employeeId: employee.name, employeeCode: employee.name }
}
