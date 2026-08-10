/**
 * Sync Job Requisition (ERPNext) → Vaga (People360) + write-back de aprovação.
 */
import { prisma } from './prisma'
import { notifyAdmins } from './notify'
import {
  erpnextConfigured,
  erpnextJrSyncEnabled,
  listPendingJobRequisitions,
  listRecentlyApprovedJobRequisitions,
  getJobRequisition,
  applyJobRequisitionWorkflow,
  addJobRequisitionComment,
  normalizeRequisicaoNextId,
  type JobRequisitionDoc,
  type JobRequisitionListItem,
  ErpnextApiError,
} from './erpnextClient'
import type { PeriodoTrabalho, TipoRequisicao } from '@prisma/client'

// ─── Mapeamentos ─────────────────────────────────────────────────────────────

function mapMotivo(motivo?: string | null): TipoRequisicao | null {
  if (!motivo) return null
  const m = motivo.trim().toLowerCase()
  if (m.includes('reposi') || m.includes('reposição') || m.includes('reposicao')) return 'SUBSTITUICAO'
  if (m.includes('amplia') || m.includes('aumento')) return 'AUMENTO_QUADRO'
  return null
}

function mapTurno(turno?: string | null): PeriodoTrabalho | null {
  if (!turno) return null
  const t = turno.trim().toLowerCase()
  if (t.startsWith('diur')) return 'DIURNO'
  if (t.startsWith('notur')) return 'NOTURNO'
  return null
}

function stripHtml(html?: string | null): string | null {
  if (!html) return null
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  return text || null
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null
  // YYYY-MM-DD → meio-dia local-ish (evita shift de fuso em date-only)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function companyKey(name: string): string {
  // "UPA CENTRO - Beneficência..." → "upa centro"
  return name.split(' - ')[0].trim().toLowerCase()
}

async function resolveUnidadeId(company?: string | null): Promise<string | null> {
  if (!company) return null
  const units = await prisma.unit.findMany({
    where: { active: true },
    select: { id: true, name: true },
  })
  if (units.length === 0) return null

  const c = company.trim().toLowerCase()
  const key = companyKey(company)

  // 1) match exato
  let hit = units.find((u) => u.name.toLowerCase() === c)
  if (hit) return hit.id

  // 2) unit name contido em company ou vice-versa
  hit = units.find((u) => {
    const n = u.name.toLowerCase()
    return c.includes(n) || n.includes(key) || n.includes(c)
  })
  if (hit) return hit.id

  // 3) primeiro segmento da company vs nome da unit
  hit = units.find((u) => u.name.toLowerCase() === key || companyKey(u.name) === key)
  return hit?.id ?? null
}

async function resolveCargo(designation?: string | null): Promise<{ cargo: string; cargoId: string | null }> {
  const cargo = (designation || 'Sem cargo').trim()
  if (!designation) return { cargo, cargoId: null }

  const byName = await prisma.position.findFirst({
    where: { name: { equals: designation, mode: 'insensitive' }, active: true },
    select: { id: true, name: true },
  })
  if (byName) return { cargo: byName.name, cargoId: byName.id }

  const alias = await prisma.cargoAlias.findFirst({
    where: { alias: { equals: designation, mode: 'insensitive' } },
    include: { position: { select: { id: true, name: true, active: true } } },
  })
  if (alias?.position?.active) {
    return { cargo: alias.position.name, cargoId: alias.position.id }
  }

  return { cargo, cargoId: null }
}

function nomesSubstituidos(doc: JobRequisitionDoc | JobRequisitionListItem): string | null {
  const rows = (doc as JobRequisitionDoc).custom_colaboradores_substituidos
  if (!Array.isArray(rows) || rows.length === 0) return null
  const names = rows
    .map((r) => r.nome_colaborador || r.colaboradores)
    .filter((n): n is string => !!n && n.trim().length > 0)
    .map((n) => n.trim())
  if (names.length === 0) return null
  return names.join(', ')
}

function buildObservacoes(doc: JobRequisitionDoc): string | null {
  const parts: string[] = []
  const desc = stripHtml(doc.description)
  if (desc) parts.push(desc)
  if (doc.reason_for_requesting?.trim()) {
    parts.push(`Justificativa: ${doc.reason_for_requesting.trim()}`)
  }
  parts.push(`[Importado do ERPNext — ${doc.name}]`)
  return parts.join('\n\n') || null
}

export async function mapJobRequisitionToVagaData(doc: JobRequisitionDoc) {
  const { cargo, cargoId } = await resolveCargo(doc.designation)
  const unidadeId = await resolveUnidadeId(doc.company)
  const unitName = unidadeId
    ? (await prisma.unit.findUnique({ where: { id: unidadeId }, select: { name: true } }))?.name
    : null

  const salario =
    doc.expected_compensation != null && !Number.isNaN(Number(doc.expected_compensation))
      ? Number(doc.expected_compensation)
      : null

  const titulo = unitName
    ? `${cargo} — ${unitName}`
    : doc.company
      ? `${cargo} — ${companyKey(doc.company).toUpperCase()}`
      : `${doc.name} · ${cargo}`

  return {
    titulo,
    cargo,
    cargoId,
    unidadeId,
    setor: doc.department || null,
    quantidade: doc.no_of_positions && doc.no_of_positions > 0 ? doc.no_of_positions : 1,
    salarioMin: salario,
    salarioMax: salario,
    tipoRequisicao: mapMotivo(doc.custom_motivo_da_requisicao),
    periodoTrabalho: mapTurno(doc.custom_turno),
    gestorRequisitante: doc.requested_by_name || null,
    setorRequisitante: doc.requested_by_dept || null,
    nomeColaboradorSaiu: nomesSubstituidos(doc),
    dataAbertura: parseDateOnly(doc.posting_date) ?? new Date(),
    dataPrevistaFechamento: parseDateOnly(doc.expected_by),
    observacoes: buildObservacoes(doc),
    requisicaoNextId: doc.name,
    erpnextStatus: doc.status || null,
    erpnextSyncedAt: new Date(),
  }
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export type SyncResult = {
  configured: boolean
  enabled: boolean
  fetched: number
  /** RPs aprovadas no ERPNext consideradas no sync (sem Vaga no People) */
  fetchedApproved: number
  created: number
  /** Vagas criadas já como ABERTA (RP aprovada no ERPNext) */
  createdOpen: number
  updated: number
  skipped: number
  errors: { name: string; error: string }[]
  createdIds: string[]
}

/** Coloca a vaga no fim da coluna ABERTA do kanban/lista de recrutamento. */
export async function openVagaInRecruitmentList(
  vagaId: string,
  opts?: {
    erpnextStatus?: string | null
    historicoUserId?: string | null
    historicoDescricao?: string
    fromStatus?: string | null
  },
) {
  const maxPos = await prisma.vaga.aggregate({
    where: { status: 'ABERTA' },
    _max: { position: true },
  })

  const updated = await prisma.vaga.update({
    where: { id: vagaId },
    data: {
      status: 'ABERTA',
      position: (maxPos._max.position ?? -1) + 1,
      ...(opts?.erpnextStatus
        ? { erpnextStatus: opts.erpnextStatus, erpnextSyncedAt: new Date() }
        : {}),
    },
  })

  await prisma.vagaHistorico.create({
    data: {
      vagaId,
      userId: opts?.historicoUserId ?? null,
      fromStatus: (opts?.fromStatus as any) ?? null,
      toStatus: 'ABERTA' as any,
      descricao:
        opts?.historicoDescricao ??
        'Vaga aberta na lista de recrutamento (status ABERTA)',
    },
  })

  return updated
}

type UpsertMode = 'pending' | 'approved'

async function upsertJobRequisitionAsVaga(
  doc: JobRequisitionDoc,
  mode: UpsertMode,
  result: SyncResult,
) {
  const mapped = await mapJobRequisitionToVagaData(doc)
  const existing = await prisma.vaga.findFirst({
    where: { requisicaoNextId: doc.name },
  })

  const targetStatus = mode === 'approved' ? 'ABERTA' : 'PENDENTE_APROVACAO'

  if (existing) {
    // Não rebaixa status se já saiu de pendente no People
    if (existing.status !== 'PENDENTE_APROVACAO') {
      // Se estava rejeitada e ERP reabriu/aprovou — não força
      await prisma.vaga.update({
        where: { id: existing.id },
        data: {
          erpnextStatus: mapped.erpnextStatus,
          erpnextSyncedAt: mapped.erpnextSyncedAt,
        },
      })
      result.skipped++
      return
    }

    // Pendente no People: atualiza campos; se mode approved, abre na lista
    if (mode === 'approved') {
      await prisma.vaga.update({
        where: { id: existing.id },
        data: {
          titulo: mapped.titulo,
          cargo: mapped.cargo,
          cargoId: mapped.cargoId,
          unidadeId: mapped.unidadeId,
          setor: mapped.setor,
          quantidade: mapped.quantidade,
          salarioMin: mapped.salarioMin,
          salarioMax: mapped.salarioMax,
          tipoRequisicao: mapped.tipoRequisicao,
          periodoTrabalho: mapped.periodoTrabalho,
          gestorRequisitante: mapped.gestorRequisitante,
          setorRequisitante: mapped.setorRequisitante,
          nomeColaboradorSaiu: mapped.nomeColaboradorSaiu,
          dataAbertura: mapped.dataAbertura,
          dataPrevistaFechamento: mapped.dataPrevistaFechamento,
          observacoes: mapped.observacoes,
          erpnextStatus: mapped.erpnextStatus,
          erpnextSyncedAt: mapped.erpnextSyncedAt,
        },
      })
      await openVagaInRecruitmentList(existing.id, {
        erpnextStatus: mapped.erpnextStatus,
        fromStatus: 'PENDENTE_APROVACAO',
        historicoDescricao: `RP ${doc.name} aprovada no ERPNext — vaga aberta na lista`,
      })
      result.updated++
      result.createdOpen++
      return
    }

    await prisma.vaga.update({
      where: { id: existing.id },
      data: {
        titulo: mapped.titulo,
        cargo: mapped.cargo,
        cargoId: mapped.cargoId,
        unidadeId: mapped.unidadeId,
        setor: mapped.setor,
        quantidade: mapped.quantidade,
        salarioMin: mapped.salarioMin,
        salarioMax: mapped.salarioMax,
        tipoRequisicao: mapped.tipoRequisicao,
        periodoTrabalho: mapped.periodoTrabalho,
        gestorRequisitante: mapped.gestorRequisitante,
        setorRequisitante: mapped.setorRequisitante,
        nomeColaboradorSaiu: mapped.nomeColaboradorSaiu,
        dataAbertura: mapped.dataAbertura,
        dataPrevistaFechamento: mapped.dataPrevistaFechamento,
        observacoes: mapped.observacoes,
        erpnextStatus: mapped.erpnextStatus,
        erpnextSyncedAt: mapped.erpnextSyncedAt,
      },
    })
    result.updated++
    return
  }

  // Nova vaga
  const maxPos = await prisma.vaga.aggregate({
    where: { status: targetStatus as any },
    _max: { position: true },
  })

  const vaga = await prisma.vaga.create({
    data: {
      titulo: mapped.titulo,
      cargo: mapped.cargo,
      cargoId: mapped.cargoId,
      unidadeId: mapped.unidadeId,
      setor: mapped.setor,
      quantidade: mapped.quantidade,
      tipoVaga: 'EFETIVO',
      salarioMin: mapped.salarioMin,
      salarioMax: mapped.salarioMax,
      tipoRequisicao: mapped.tipoRequisicao,
      periodoTrabalho: mapped.periodoTrabalho,
      gestorRequisitante: mapped.gestorRequisitante,
      setorRequisitante: mapped.setorRequisitante,
      nomeColaboradorSaiu: mapped.nomeColaboradorSaiu,
      dataAbertura: mapped.dataAbertura,
      dataPrevistaFechamento: mapped.dataPrevistaFechamento,
      observacoes: mapped.observacoes,
      requisicaoNextId: mapped.requisicaoNextId,
      erpnextStatus: mapped.erpnextStatus,
      erpnextSyncedAt: mapped.erpnextSyncedAt,
      status: targetStatus as any,
      position: (maxPos._max.position ?? -1) + 1,
    },
  })

  await prisma.vagaHistorico.create({
    data: {
      vagaId: vaga.id,
      toStatus: targetStatus as any,
      descricao:
        mode === 'approved'
          ? `Importada do ERPNext já aprovada (${doc.name}) — aberta na lista de vagas`
          : `Importada do ERPNext (${doc.name})`,
    },
  })

  result.created++
  result.createdIds.push(vaga.id)
  if (mode === 'approved') result.createdOpen++

  await notifyAdmins({
    type: 'VAGA',
    title:
      mode === 'approved'
        ? `Nova vaga aberta (ERPNext): ${mapped.cargo}`
        : `Nova RP do ERPNext: ${mapped.cargo}`,
    body: `${doc.name}${mapped.gestorRequisitante ? ` — ${mapped.gestorRequisitante}` : ''}`,
    href: mode === 'approved' ? `/vagas/${vaga.id}` : `/vagas/pendentes`,
  })
}

export async function syncPendingJobRequisitions(): Promise<SyncResult> {
  const empty: SyncResult = {
    configured: erpnextConfigured(),
    enabled: erpnextJrSyncEnabled(),
    fetched: 0,
    fetchedApproved: 0,
    created: 0,
    createdOpen: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    createdIds: [],
  }

  if (!empty.configured || !empty.enabled) return empty

  // 1) Pendentes de aprovação no ERPNext → PENDENTE_APROVACAO no People
  let pending: JobRequisitionListItem[]
  try {
    pending = await listPendingJobRequisitions(100)
  } catch (e) {
    const err = e as ErpnextApiError
    return { ...empty, errors: [{ name: '*', error: err.message || String(e) }] }
  }
  empty.fetched = pending.length

  for (const item of pending) {
    try {
      const doc = await getJobRequisition(item.name)
      await upsertJobRequisitionAsVaga(doc, 'pending', empty)
    } catch (e) {
      const err = e as Error
      empty.errors.push({ name: item.name, error: err.message || String(e) })
    }
  }

  // 2) Aprovadas recentemente no ERPNext sem Vaga no People → cria já ABERTA na lista
  let approved: JobRequisitionListItem[] = []
  try {
    approved = await listRecentlyApprovedJobRequisitions(40, 30)
  } catch (e) {
    const err = e as ErpnextApiError
    empty.errors.push({ name: 'approved-list', error: err.message || String(e) })
  }
  empty.fetchedApproved = approved.length

  for (const item of approved) {
    try {
      const exists = await prisma.vaga.findFirst({
        where: { requisicaoNextId: item.name },
        select: { id: true },
      })
      // Só importa se ainda não existe no People (evita reabrir histórico)
      if (exists) {
        empty.skipped++
        continue
      }
      const doc = await getJobRequisition(item.name)
      await upsertJobRequisitionAsVaga(doc, 'approved', empty)
    } catch (e) {
      const err = e as Error
      empty.errors.push({ name: item.name, error: err.message || String(e) })
    }
  }

  return empty
}

// ─── Write-back ──────────────────────────────────────────────────────────────

export type WriteBackResult =
  | { ok: true; erpnextStatus?: string; workflowState?: string; resolvedName?: string }
  | { ok: false; error: string; status?: number }

export async function writeBackApproval(
  requisicaoNextId: string,
  action: 'Approve' | 'Reject',
  rejectReason?: string,
): Promise<WriteBackResult> {
  if (!erpnextConfigured()) {
    return { ok: false, error: 'ERPNext não configurado', status: 503 }
  }

  const name = normalizeRequisicaoNextId(requisicaoNextId) || requisicaoNextId.trim()

  try {
    let doc: JobRequisitionDoc
    try {
      doc = await getJobRequisition(name)
    } catch (e) {
      const err = e as ErpnextApiError
      // Mensagem mais clara quando o ID está errado / RP sumiu
      if (err.status === 404 || /DoesNotExist/i.test(err.message)) {
        return {
          ok: false,
          error: `RP "${name}" não encontrada no ERPNext. Confira o campo "ERPNext (ID RP)" (ex.: RP-2026-00194).`,
          status: 404,
        }
      }
      throw e
    }

    if (doc.workflow_state !== 'Pending' && doc.status !== 'Pending') {
      // Já processada no ERP — se o estado bate com a ação, aceita; senão erro
      if (action === 'Approve' && (doc.workflow_state === 'Approved' || doc.status === 'Open & Approved')) {
        return {
          ok: true,
          erpnextStatus: doc.status,
          workflowState: doc.workflow_state,
          resolvedName: doc.name,
        }
      }
      if (action === 'Reject' && (doc.workflow_state === 'Rejected' || doc.status === 'Rejected')) {
        return {
          ok: true,
          erpnextStatus: doc.status,
          workflowState: doc.workflow_state,
          resolvedName: doc.name,
        }
      }
      return {
        ok: false,
        error: `RP ${doc.name} não está pendente no ERPNext (status=${doc.status}, workflow=${doc.workflow_state})`,
        status: 409,
      }
    }

    const updated = await applyJobRequisitionWorkflow(doc, action)

    if (action === 'Reject' && rejectReason?.trim()) {
      try {
        await addJobRequisitionComment(doc.name, `Motivo da rejeição (People360): ${rejectReason.trim()}`)
      } catch (commentErr) {
        console.error('[erpnext] falha ao gravar Comment de rejeição:', commentErr)
        // workflow já aplicado — não falha o fluxo
      }
    }

    return {
      ok: true,
      erpnextStatus: updated.status,
      workflowState: updated.workflow_state,
      resolvedName: updated.name || doc.name,
    }
  } catch (e) {
    const err = e as ErpnextApiError
    return {
      ok: false,
      error: err.message || String(e),
      status: err.status || 502,
    }
  }
}
