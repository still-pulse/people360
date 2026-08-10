import { NextRequest, NextResponse } from 'next/server'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { syncEmployeesFromErpnext } from '@/lib/erpnextEmployees'
import { erpnextConfigured } from '@/lib/erpnextClient'
import { log, extractIp } from '@/lib/audit'

/**
 * POST — força sync de Employees do ERPNext (admin)
 * GET  — status + ?secret=CRON_SECRET para cron
 */
function isCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.ERPNEXT_CRON_SECRET
  if (!secret) return false
  return (
    req.nextUrl.searchParams.get('secret') === secret ||
    req.headers.get('x-cron-secret') === secret
  )
}

export async function GET(req: NextRequest) {
  if (isCronAuth(req) && req.nextUrl.searchParams.get('sync') === '1') {
    const result = await syncEmployeesFromErpnext()
    return NextResponse.json(result)
  }

  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    configured: erpnextConfigured(),
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
    if (session!.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    userId = session!.user.id
    userName = session!.user.name ?? undefined
    userRole = session!.user.role
  }

  const body = await req.json().catch(() => ({}))
  const statusFilter =
    body?.status === 'Active' || body?.status === 'Left' ? body.status : null

  const result = await syncEmployeesFromErpnext({ statusFilter })

  if (userId) {
    await log({
      userId,
      userName: userName ?? null,
      userRole: userRole ?? null,
      action: 'UPDATE',
      entity: 'Integracao',
      entityId: 'erpnext-employees',
      entityName: 'Sync Colaboradores ERPNext',
      details: {
        totalRemote: result.totalRemote,
        upserted: result.upserted,
        pages: result.pages,
        errors: result.errors.length,
        statusFilter,
      },
      ip: extractIp(req.headers),
    })
  }

  return NextResponse.json(result)
}
