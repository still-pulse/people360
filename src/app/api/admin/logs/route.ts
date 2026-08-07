import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit    = Math.min(50, parseInt(searchParams.get('limit') ?? '30'))
  const entity   = searchParams.get('entity') ?? ''
  const action   = searchParams.get('action') ?? ''
  const userId   = searchParams.get('userId') ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo') ?? ''
  const search   = searchParams.get('search') ?? ''

  const where: any = {}
  if (entity)  where.entity = entity
  if (action)  where.action = action
  if (userId)  where.userId = userId
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo)   where.createdAt.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999))
  }
  if (search) {
    where.OR = [
      { entityName: { contains: search, mode: 'insensitive' } },
      { userName:   { contains: search, mode: 'insensitive' } },
    ]
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) })
}
