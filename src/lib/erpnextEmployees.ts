import { resolveEmployeeUnit } from './erpnextEmployeeUnit'
/**
 * Sync Employee (ERPNext) → Colaborador (People360)
 */
import { prisma } from './prisma'
import {
  erpnextConfigured,
  erpnextBaseUrl,
  listEmployeesPage,
  getEmployee,
  countEmployees,
  type EmployeeDoc,
  ErpnextApiError,
} from './erpnextClient'

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function asBool(v: unknown): boolean {
  if (v === true || v === 1 || v === '1') return true
  if (typeof v === 'string' && ['sim', 'yes', 'true'].includes(v.toLowerCase())) return true
  return false
}

async function resolveUnidadeId(company?: string | null, branch?: string | null): Promise<string | null> {
  const units = await prisma.unit.findMany({ where: { active: true }, select: { id: true, name: true } })
  return resolveEmployeeUnit(units, company, branch)?.id ?? null
}

export function mapEmployeeToColaboradorData(doc: EmployeeDoc, unitId: string | null) {
  return {
    erpnextId: doc.name,
    employeeName: (doc.employee_name || doc.name || '').trim() || doc.name,
    status: doc.status || 'Active',
    company: doc.company || null,
    department: doc.department || null,
    designation: doc.designation || null,
    cellNumber: doc.cell_number || null,
    personalEmail: doc.personal_email || null,
    companyEmail: doc.company_email || null,
    dateOfJoining: parseDate(doc.date_of_joining),
    dateOfBirth: parseDate(doc.date_of_birth),
    gender: doc.gender || null,
    reportsTo: doc.reports_to || null,
    imagePath: doc.image || null,
    employmentType: doc.employment_type || null,
    relievingDate: parseDate(doc.relieving_date),
    matricula: (doc.custom_matricula as string) || doc.employee_number || null,
    cpf: (doc.custom_cpf as string) || null,
    rg: (doc.custom_rg as string) || null,
    secao: (doc.custom_seção as string) || null,
    pcd: asBool(doc.custom_pessoa_com_deficiência),
    tipoDeficiencia: (doc.custom_tipo_de_deficiencia as string) || null,
    etnia: (doc.custom_etnia as string) || null,
    cargaHoraria:
      doc.custom_carga_horária_mensal != null
        ? String(doc.custom_carga_horária_mensal)
        : null,
    naturalidade: (doc.custom_naturalidade_cidade as string) || null,
    unitId,
    erpnextModified: parseDate(doc.modified?.slice(0, 19).replace(' ', 'T') || null),
    syncedAt: new Date(),
  }
}

export function employeeImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null
  if (imagePath.startsWith('http')) return imagePath
  const base = erpnextBaseUrl()
  if (!base) return imagePath
  return `${base}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`
}

export type EmployeeSyncResult = {
  configured: boolean
  totalRemote: number
  pages: number
  upserted: number
  errors: { name: string; error: string }[]
}

/**
 * Sincroniza Employees do ERPNext para a tabela local.
 * Por padrão sincroniza todos (Active + Left). `statusFilter` opcional.
 */
export async function syncEmployeesFromErpnext(opts?: {
  statusFilter?: string | null
  pageSize?: number
  maxPages?: number
}): Promise<EmployeeSyncResult> {
  const empty: EmployeeSyncResult = {
    configured: erpnextConfigured(),
    totalRemote: 0,
    pages: 0,
    upserted: 0,
    errors: [],
  }
  if (!empty.configured) return empty

  const pageSize = opts?.pageSize ?? 100
  const maxPages = opts?.maxPages ?? 50 // safety: 5000 rows
  const statusFilter = opts?.statusFilter ?? null

  try {
    empty.totalRemote = await countEmployees(statusFilter)
  } catch (e) {
    const err = e as ErpnextApiError
    empty.errors.push({ name: '*', error: err.message || String(e) })
    return empty
  }

  // Cache de empresa + local de trabalho → unitId
  const unitCache = new Map<string, string | null>()

  for (let page = 0; page < maxPages; page++) {
    const start = page * pageSize
    let batch: EmployeeDoc[]
    try {
      batch = await listEmployeesPage({
        limit: pageSize,
        start,
        status: statusFilter,
      })
    } catch (e) {
      const err = e as ErpnextApiError
      empty.errors.push({ name: `page-${page}`, error: err.message || String(e) })
      break
    }

    empty.pages++
    if (!batch.length) break

    for (const doc of batch) {
      try {
        let unitId: string | null = null
        if (doc.company || doc.branch) {
          const key = JSON.stringify([doc.company, doc.branch])
          if (unitCache.has(key)) {
            unitId = unitCache.get(key)!
          } else {
            unitId = await resolveUnidadeId(doc.company, doc.branch)
            unitCache.set(key, unitId)
          }
        }
        const data = mapEmployeeToColaboradorData(doc, unitId)
        await prisma.colaborador.upsert({
          where: { erpnextId: data.erpnextId },
          create: data,
          update: data,
        })
        empty.upserted++
      } catch (e) {
        const err = e as Error
        empty.errors.push({ name: doc.name, error: err.message || String(e) })
      }
    }

    if (batch.length < pageSize) break
  }

  return empty
}

/** Atualiza um colaborador com GET completo no ERPNext (detalhe / refresh). */
export async function refreshColaboradorFromErpnext(erpnextId: string) {
  const doc = await getEmployee(erpnextId)
  const unitId = await resolveUnidadeId(doc.company, doc.branch)
  const data = mapEmployeeToColaboradorData(doc, unitId)
  return prisma.colaborador.upsert({
    where: { erpnextId: data.erpnextId },
    create: data,
    update: data,
  })
}
