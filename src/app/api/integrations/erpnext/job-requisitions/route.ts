import { NextRequest, NextResponse } from 'next/server'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { erpnextConfigured, erpnextJrSyncEnabled, pingErpnext } from '@/lib/erpnextClient'
import { syncPendingJobRequisitions } from '@/lib/erpnextJobRequisition'
import { log, extractIp } from '@/lib/audit'

/**
 * GET — status da integração + opcional ?sync=1 (admin) ou ?secret=CRON_SECRET
 * POST — força sync (admin) ou ?secret / header x-cron-secret
 */
function isCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.ERPNEXT_CRON_SECRET
  if (!secret) return false
  const q = req.nextUrl.searchParams.get('secret')
  const h = req.headers.get('x-cron-secret')
  return q === secret || h === secret
}

function isAdminRole(role: string) {
  return ['ADMIN', 'SUPERINTENDENT', 'GERENTE'].includes(role)
}

export async function GET(req: NextRequest) {
  const cron = isCronAuth(req)
  const sessionResult = cron ? null : await getSessionOrUnauthorized()
  if (!cron) {
    if (sessionResult!.error) return sessionResult!.error
  }

  const wantSync = req.nextUrl.searchParams.get('sync') === '1'
  const wantPing = req.nextUrl.searchParams.get('ping') === '1'

  if (wantPing) {
    if (!cron && !isAdminRole(sessionResult!.session!.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const ping = await pingErpnext()
    return NextResponse.json({
      configured: erpnextConfigured(),
      enabled: erpnextJrSyncEnabled(),
      baseUrl: process.env.ERPNEXT_BASE_URL?.replace(/\/$/, '') || null,
      ping,
    })
  }

  if (wantSync) {
    if (!cron && !isAdminRole(sessionResult!.session!.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const result = await syncPendingJobRequisitions()
    return NextResponse.json(result)
  }

  // Status simples (qualquer autenticado)
  if (!cron && sessionResult!.error) return sessionResult!.error

  return NextResponse.json({
    configured: erpnextConfigured(),
    enabled: erpnextJrSyncEnabled(),
    baseUrl: process.env.ERPNEXT_BASE_URL?.replace(/\/$/, '') || null,
  })
}

export async function POST(req: NextRequest) {
  const cron = isCronAuth(req)
  let userId: string | undefined
  let userName: string | undefined
  let userRole: string | undefined

  if (!cron) {
    const { session, error } = await getSessionOrUnauthorized()
    if (error) return error
    if (!isAdminRole(session!.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    userId = session!.user.id
    userName = session!.user.name ?? undefined
    userRole = session!.user.role
  }

  const result = await syncPendingJobRequisitions()

  if (userId) {
    await log({
      userId,
      userName: userName ?? null,
      userRole: userRole ?? null,
      action: 'UPDATE',
      entity: 'Integracao',
      entityId: 'erpnext-jr',
      entityName: 'Sync Job Requisition',
      details: {
        fetched: result.fetched,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
      },
      ip: extractIp(req.headers),
    })
  }

  return NextResponse.json(result)
}
