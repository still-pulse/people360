import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'

const ALLOWED = ['ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE']

/** Facetas para filtros da lista (companies, cargos, contagens). */
export async function GET() {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (!ALLOWED.includes(session!.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [total, active, left, byStatus, lastSync] = await Promise.all([
    prisma.colaborador.count(),
    prisma.colaborador.count({ where: { status: 'Active' } }),
    prisma.colaborador.count({ where: { status: 'Left' } }),
    prisma.colaborador.groupBy({
      by: ['status'],
      _count: { _all: true },
      orderBy: { _count: { status: 'desc' } },
    }),
    prisma.colaborador.aggregate({ _max: { syncedAt: true } }),
  ])

  const companies = await prisma.colaborador.findMany({
    where: { company: { not: null } },
    select: { company: true },
    distinct: ['company'],
    orderBy: { company: 'asc' },
    take: 50,
  })

  return NextResponse.json({
    total,
    active,
    left,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    lastSyncAt: lastSync._max.syncedAt,
    companies: companies.map((c) => c.company).filter(Boolean),
  })
}
