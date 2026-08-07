import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === 'true'
  const indicadoresOnly = searchParams.get('indicadores') === 'true'
  const isAnalyst = session.user.role === 'ANALYST'
  const where: any = all && !isAnalyst ? {} : { active: true }
  if (indicadoresOnly) where.exibirIndicadores = true

  if (isAnalyst) {
    const unitIds: string[] = (session.user as any).unitIds?.length
      ? (session.user as any).unitIds
      : (session.user.unitId ? [session.user.unitId] : [])
    if (unitIds.length === 0) return NextResponse.json([])
    where.id = unitIds.length === 1 ? unitIds[0] : { in: unitIds }
  }

  const units = await prisma.unit.findMany({ where, orderBy: { name: 'asc' } })
  return NextResponse.json(units)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const existing = await prisma.unit.findFirst({ where: { name: body.name } })
  if (existing) return NextResponse.json({ error: 'Já existe uma unidade com este nome.' }, { status: 400 })

  const unit = await prisma.unit.create({
    data: {
      name: body.name,
      color: body.color ?? '#15AFA4',
      description: body.description,
      exibirIndicadores: body.exibirIndicadores ?? true,
      indicadoresAteYear: body.indicadoresAteYear ?? null,
      indicadoresAteMonth: body.indicadoresAteMonth ?? null,
    },
  })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'CREATE', entity: 'Unidade', entityId: unit.id, entityName: unit.name,
    ip: extractIp(req.headers),
  })

  return NextResponse.json(unit, { status: 201 })
}
