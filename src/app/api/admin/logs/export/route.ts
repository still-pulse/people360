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
  const entity   = searchParams.get('entity') ?? ''
  const action   = searchParams.get('action') ?? ''
  const userId   = searchParams.get('userId') ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo') ?? ''

  const where: any = {}
  if (entity)  where.entity = entity
  if (action)  where.action = action
  if (userId)  where.userId = userId
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo)   where.createdAt.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999))
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })

  const header = 'Data/Hora,Usuário,Perfil,Ação,Entidade,Item,Detalhes,IP\n'
  const rows = logs.map((l) => {
    const dt = new Date(l.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const details = l.details ? JSON.stringify(l.details).replace(/"/g, '""') : ''
    return [dt, l.userName ?? '', l.userRole ?? '', l.action, l.entity, l.entityName ?? '', `"${details}"`, l.ip ?? ''].join(',')
  }).join('\n')

  const csv = '﻿' + header + rows // BOM para Excel

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
