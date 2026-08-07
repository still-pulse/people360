import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, enforceUnitFilter } from '@/lib/apiHelpers'

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const where: any = { unit: { exibirIndicadores: true } }
  if (searchParams.get('year')) where.year = parseInt(searchParams.get('year')!)
  if (searchParams.get('month')) where.month = parseInt(searchParams.get('month')!)
  enforceUnitFilter(where, session!, searchParams.get('unitId'))

  const data = await prisma.absenteeismIndicator.findMany({
    where,
    include: { unit: true },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const body = await req.json()
  if (session!.user.role === 'ANALYST' && session!.user.unitId && body.unitId !== session!.user.unitId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await prisma.absenteeismIndicator.upsert({
    where: { unitId_year_month: { unitId: body.unitId, year: body.year, month: body.month } },
    update: { totalCertificates: body.totalCertificates, totalDaysLost: body.totalDaysLost, totalEmployees: body.totalEmployees, workingDaysInMonth: body.workingDaysInMonth ?? 22 },
    create: { unitId: body.unitId, year: body.year, month: body.month, totalCertificates: body.totalCertificates, totalDaysLost: body.totalDaysLost, totalEmployees: body.totalEmployees, workingDaysInMonth: body.workingDaysInMonth ?? 22 },
    include: { unit: true },
  })
  return NextResponse.json(data, { status: 201 })
}
