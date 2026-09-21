import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceUnitFilter, getSessionOrUnauthorized } from '@/lib/apiHelpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const params = req.nextUrl.searchParams
  const days = Math.min(365, Math.max(1, Number(params.get('days') || 30)))
  const since = new Date(Date.now() - days * 86400000)
  const where: Record<string, unknown> = { createdAt: { gte: since } }
  enforceUnitFilter(where, session!, params.get('unitId'), 'unitId')

  const [total, grouped, units, attention, recent] = await Promise.all([
    prisma.admission.count({ where }),
    prisma.admission.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.admission.groupBy({ by: ['unitId'], where, _count: { _all: true } }),
    prisma.admission.findMany({
      where: { ...where, status: { in: ['CORRECTION_REQUESTED', 'ERPNEXT_ERROR', 'SIGNATURE_PENDING', 'EXPIRED'] } },
      select: { id: true, candidateName: true, jobTitle: true, status: true, lastActivityAt: true, unit: { select: { name: true } } },
      orderBy: [{ priority: 'desc' }, { lastActivityAt: 'asc' }], take: 6,
    }),
    prisma.admissionAuditLog.findMany({
      where: { admission: where }, select: { id: true, action: true, actorName: true, actorType: true, createdAt: true, admission: { select: { candidateName: true } } },
      orderBy: { createdAt: 'desc' }, take: 8,
    }),
  ])
  const unitRows = await prisma.unit.findMany({ where: { id: { in: units.map((u) => u.unitId) } }, select: { id: true, name: true, color: true } })
  const count = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]))
  return NextResponse.json({
    total,
    indicators: {
      total, inProgress: (count.IN_PROGRESS || 0) + (count.AWAITING_DOCUMENTS || 0), awaitingCandidate: count.LINK_SENT || 0,
      pendingDocuments: count.AWAITING_DOCUMENTS || 0, documentsReview: count.DOCUMENTS_UNDER_REVIEW || 0,
      awaitingSignature: count.SIGNATURE_PENDING || 0, completed: count.COMPLETED || 0, erpErrors: count.ERPNEXT_ERROR || 0,
    },
    stages: grouped.map((row) => ({ status: row.status, count: row._count._all })),
    units: units.map((row) => ({ ...unitRows.find((u) => u.id === row.unitId), count: row._count._all })).filter((u) => u.id),
    attention, recent,
  })
}
