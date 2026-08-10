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
