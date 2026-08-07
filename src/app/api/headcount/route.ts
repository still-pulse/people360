import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, enforceUnitFilter } from '@/lib/apiHelpers'

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const where: any = {}
  if (searchParams.get('year')) where.year = parseInt(searchParams.get('year')!)
  if (searchParams.get('month')) where.month = parseInt(searchParams.get('month')!)
  enforceUnitFilter(where, session!, searchParams.get('unitId'))

  const data = await prisma.headcountEntry.findMany({
    where,
    include: { unit: true, position: true },
    orderBy: [{ year: 'asc' }, { month: 'asc' }, { position: { name: 'asc' } }],
  })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const body = await req.json()

  if (Array.isArray(body)) {
    const entries = session!.user.role === 'ANALYST' && session!.user.unitId
      ? body.filter((e) => e.unitId === session!.user.unitId)
      : body

    const results = await Promise.all(
      entries.map((entry) =>
        prisma.headcountEntry.upsert({
          where: { unitId_positionId_year_month: { unitId: entry.unitId, positionId: entry.positionId, year: entry.year, month: entry.month } },
          update: { count: entry.count },
          create: { unitId: entry.unitId, positionId: entry.positionId, year: entry.year, month: entry.month, count: entry.count },
          include: { unit: true, position: true },
        })
      )
    )
    return NextResponse.json(results, { status: 201 })
  }

  if (session!.user.role === 'ANALYST' && session!.user.unitId && body.unitId !== session!.user.unitId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await prisma.headcountEntry.upsert({
    where: { unitId_positionId_year_month: { unitId: body.unitId, positionId: body.positionId, year: body.year, month: body.month } },
    update: { count: body.count },
    create: { unitId: body.unitId, positionId: body.positionId, year: body.year, month: body.month, count: body.count },
    include: { unit: true, position: true },
  })
  return NextResponse.json(data, { status: 201 })
}
