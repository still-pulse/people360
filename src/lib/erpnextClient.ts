/**
 * Cliente HTTP para a API REST do Frappe/ERPNext (BHCL).
 * Auth: Authorization: token <api_key>:<api_secret>
 */

const BASE = process.env.ERPNEXT_BASE_URL?.replace(/\/$/, '')
const KEY = process.env.ERPNEXT_API_KEY
const SECRET = process.env.ERPNEXT_API_SECRET

export function erpnextConfigured(): boolean {
  return !!(BASE && KEY && SECRET)
}

export function erpnextBaseUrl(): string | null {
  return BASE || null
}

export function erpnextJrSyncEnabled(): boolean {
  if (!erpnextConfigured()) return false
  const flag = process.env.ERPNEXT_JR_SYNC_ENABLED
  // default: ligado quando credenciais existem
  if (flag === undefined || flag === '') return true
  return flag === '1' || flag.toLowerCase() === 'true' || flag.toLowerCase() === 'yes'
}

/**
 * Normaliza o name da Job Requisition.
 * Cadastros manuais às vezes gravam "2026-00194" em vez de "RP-2026-00194".
 */
export function normalizeRequisicaoNextId(raw?: string | null): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null
  // Já no padrão RP-YYYY-#####
  if (/^RP-\d{4}-\d+$/i.test(s)) return s.toUpperCase().replace(/^rp-/i, 'RP-')
  // Só YYYY-##### → prefixa RP-
  if (/^\d{4}-\d+$/.test(s)) return `RP-${s}`
  // HR-HIREQ-… ou outros nomes oficiais: mantém
  return s
}

export class ErpnextApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ErpnextApiError'
    this.status = status
    this.body = body
  }
}

function authHeader(): string {
  return `token ${KEY}:${SECRET}`
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  if (!erpnextConfigured()) {
    throw new ErpnextApiError('ERPNext não configurado (ERPNEXT_BASE_URL / API_KEY / API_SECRET)', 503)
  }

  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? '' : '/'}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })

  let data: any = null
  const text = await res.text()
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    const msg =
      data?.exc_type || data?.message || data?._error_message || data?.exception ||
      (typeof data === 'string' ? data : null) ||
      `ERPNext HTTP ${res.status}`
    const detail = typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 500)
    throw new ErpnextApiError(detail, res.status, data)
  }

  return data as T
}

// ─── Job Requisition ─────────────────────────────────────────────────────────

export interface JobRequisitionListItem {
  name: string
  designation?: string
  department?: string | null
  company?: string | null
  status?: string
  workflow_state?: string
  no_of_positions?: number
  expected_compensation?: number | null
  requested_by?: string | null
  requested_by_name?: string | null
  requested_by_dept?: string | null
  posting_date?: string | null
  expected_by?: string | null
  custom_turno?: string | null
  custom_motivo_da_requisicao?: string | null
  modified?: string
}

export interface ColaboradorSubstituido {
  colaboradores?: string
  nome_colaborador?: string | null
}

export interface JobRequisitionDoc extends JobRequisitionListItem {
  naming_series?: string
  description?: string | null
  reason_for_requesting?: string | null
  requested_by_designation?: string | null
  custom_colaboradores_substituidos?: ColaboradorSubstituido[]
  custom_aprovado_por?: string | null
  custom_horario_aprovacao?: string | null
  doctype?: string
  docstatus?: number
  [key: string]: unknown
}

const JR_LIST_FIELDS = [
  'name',
  'designation',
  'department',
  'company',
  'status',
  'workflow_state',
  'no_of_positions',
  'expected_compensation',
  'requested_by',
  'requested_by_name',
  'requested_by_dept',
  'posting_date',
  'expected_by',
  'custom_turno',
  'custom_motivo_da_requisicao',
  'modified',
] as const

export async function listPendingJobRequisitions(limit = 50): Promise<JobRequisitionListItem[]> {
  const fields = JSON.stringify([...JR_LIST_FIELDS])
  const filters = JSON.stringify([
    ['status', '=', 'Pending'],
    ['workflow_state', '=', 'Pending'],
  ])
  const qs = new URLSearchParams({
    fields,
    filters,
    order_by: 'modified desc',
    limit_page_length: String(limit),
  })
  const res = await request<{ data: JobRequisitionListItem[] }>(
    'GET',
    `/api/resource/Job%20Requisition?${qs}`,
  )
  return res.data ?? []
}

/**
 * RPs já aprovadas no ERPNext (úteis se a aprovação ocorreu no Desk e o People ainda não tem a Vaga).
 * `sinceDays` limita o volume histórico (default 30 dias).
 */
export async function listRecentlyApprovedJobRequisitions(
  limit = 30,
  sinceDays = 30,
): Promise<JobRequisitionListItem[]> {
  const since = new Date()
  since.setDate(since.getDate() - sinceDays)
  const sinceStr = since.toISOString().slice(0, 19).replace('T', ' ')
  const fields = JSON.stringify([...JR_LIST_FIELDS])
  const filters = JSON.stringify([
    ['status', '=', 'Open & Approved'],
    ['modified', '>=', sinceStr],
  ])
  const qs = new URLSearchParams({
    fields,
    filters,
    order_by: 'modified desc',
    limit_page_length: String(limit),
  })
  const res = await request<{ data: JobRequisitionListItem[] }>(
    'GET',
    `/api/resource/Job%20Requisition?${qs}`,
  )
  return res.data ?? []
}

export async function getJobRequisition(name: string): Promise<JobRequisitionDoc> {
  const encoded = encodeURIComponent(name)
  const res = await request<{ data: JobRequisitionDoc }>(
    'GET',
    `/api/resource/Job%20Requisition/${encoded}`,
  )
  if (!res.data) throw new ErpnextApiError(`Job Requisition ${name} não encontrada`, 404)
  return res.data
}

/**
 * Aplica ação do workflow. Actions válidas na BHCL: Approve | Reject | Reaberto
 * O Frappe espera o documento completo (ou pelo menos o estado atual) em `doc`.
 */
export async function applyJobRequisitionWorkflow(
  doc: JobRequisitionDoc,
  action: 'Approve' | 'Reject' | 'Reaberto',
): Promise<JobRequisitionDoc> {
  const res = await request<{ message: JobRequisitionDoc }>(
    'POST',
    '/api/method/frappe.model.workflow.apply_workflow',
    { doc, action },
  )
  return res.message ?? doc
}

/**
 * Grava comentário na timeline do documento.
 * Preferir `frappe.desk.form.utils.add_comment` — POST em /api/resource/Comment
 * retorna 403 para o user de integração (sem create em Comment).
 */
export async function addJobRequisitionComment(name: string, content: string): Promise<void> {
  await request('POST', '/api/method/frappe.desk.form.utils.add_comment', {
    reference_doctype: 'Job Requisition',
    reference_name: name,
    content,
    comment_email: process.env.ERPNEXT_COMMENT_EMAIL || 'api-people360@ossbhcl.org.br',
    comment_by: process.env.ERPNEXT_COMMENT_BY || 'People360',
  })
}

/** Ping leve: lista 1 JR e confirma auth. */
export async function pingErpnext(): Promise<{ ok: boolean; user?: string; error?: string }> {
  try {
    const userRes = await request<{ message: string }>('GET', '/api/method/frappe.auth.get_logged_user')
    await request('GET', '/api/resource/Job%20Requisition?limit_page_length=1')
    return { ok: true, user: userRes.message }
  } catch (e) {
    const err = e as ErpnextApiError
    return { ok: false, error: err.message || String(e) }
  }
}

// ─── Employee (Colaborador) ──────────────────────────────────────────────────

export const EMPLOYEE_SYNC_FIELDS = [
  'name',
  'employee_name',
  'status',
  'company',
  'branch',
  'department',
  'designation',
  'cell_number',
  'personal_email',
  'company_email',
  'date_of_joining',
  'date_of_birth',
  'gender',
  'reports_to',
  'image',
  'employment_type',
  'relieving_date',
  'employee_number',
  'modified',
  'custom_cpf',
  'custom_rg',
  'custom_seção',
  'custom_pessoa_com_deficiência',
  'custom_tipo_de_deficiencia',
  'custom_etnia',
  'custom_carga_horária_mensal',
  'custom_naturalidade_cidade',
  'custom_matricula',
] as const

export type EmployeeDoc = {
  name: string
  employee_name?: string
  status?: string
  company?: string | null
  branch?: string | null
  department?: string | null
  designation?: string | null
  cell_number?: string | null
  personal_email?: string | null
  company_email?: string | null
  date_of_joining?: string | null
  date_of_birth?: string | null
  gender?: string | null
  reports_to?: string | null
  image?: string | null
  employment_type?: string | null
  relieving_date?: string | null
  employee_number?: string | null
  modified?: string
  custom_cpf?: string | null
  custom_rg?: string | null
  custom_seção?: string | null
  custom_pessoa_com_deficiência?: number | string | boolean | null
  custom_tipo_de_deficiencia?: string | null
  custom_etnia?: string | null
  custom_carga_horária_mensal?: string | number | null
  custom_naturalidade_cidade?: string | null
  custom_matricula?: string | null
  [key: string]: unknown
}

export async function listEmployeesPage(opts: {
  limit?: number
  start?: number
  status?: string | null
}): Promise<EmployeeDoc[]> {
  const limit = opts.limit ?? 100
  const start = opts.start ?? 0
  const fields = JSON.stringify([...EMPLOYEE_SYNC_FIELDS])
  const params = new URLSearchParams({
    fields,
    limit_page_length: String(limit),
    limit_start: String(start),
    order_by: 'modified desc',
  })
  if (opts.status) {
    params.set('filters', JSON.stringify([['status', '=', opts.status]]))
  }
  const res = await request<{ data: EmployeeDoc[] }>(
    'GET',
    `/api/resource/Employee?${params}`,
  )
  return res.data ?? []
}

export async function getEmployee(name: string): Promise<EmployeeDoc> {
  const encoded = encodeURIComponent(name)
  const res = await request<{ data: EmployeeDoc }>(
    'GET',
    `/api/resource/Employee/${encoded}`,
  )
  if (!res.data) throw new ErpnextApiError(`Employee ${name} não encontrado`, 404)
  return res.data
}

export async function countEmployees(status?: string | null): Promise<number> {
  const body: Record<string, unknown> = { doctype: 'Employee' }
  if (status) body.filters = [['status', '=', status]]
  const res = await request<{ message: number }>(
    'POST',
    '/api/method/frappe.client.get_count',
    body,
  )
  return Number(res.message) || 0
}

export async function listErpnextResourceNames(doctype: string): Promise<string[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(['name']),
    limit_page_length: '1000',
    order_by: 'name asc',
  })
  const res = await request<{ data: { name: string }[] }>('GET', `/api/resource/${encodeURIComponent(doctype)}?${params}`)
  return (res.data ?? []).map((item) => item.name).filter(Boolean)
}

export async function findEmployeeByCpf(cpf: string): Promise<EmployeeDoc | null> {
  const params = new URLSearchParams({
    fields: JSON.stringify(['name', 'employee_name', 'custom_cpf']),
    filters: JSON.stringify([['custom_cpf', '=', cpf]]),
    limit_page_length: '1',
  })
  const res = await request<{ data: EmployeeDoc[] }>('GET', `/api/resource/Employee?${params}`)
  return res.data?.[0] ?? null
}

export async function createEmployee(data: Record<string, unknown>): Promise<EmployeeDoc> {
  const res = await request<{ data: EmployeeDoc }>('POST', '/api/resource/Employee', data)
  if (!res.data?.name) throw new ErpnextApiError('O ERPNext não retornou o identificador do Employee criado.', 502, res)
  return res.data
}

export async function updateEmployee(name: string, data: Record<string, unknown>): Promise<EmployeeDoc> {
  const res = await request<{ data: EmployeeDoc }>('PUT', `/api/resource/Employee/${encodeURIComponent(name)}`, data)
  if (!res.data?.name) throw new ErpnextApiError('O ERPNext não confirmou a atualização do Employee.', 502, res)
  return res.data
}
