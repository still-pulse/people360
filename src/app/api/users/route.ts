import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unitId = searchParams.get('unitId')

  const where: any = { active: true }

  if (session.user.role === 'ANALYST') {
    const analystUnits: string[] = (session.user as any).unitIds?.length
      ? (session.user as any).unitIds
      : (session.user.unitId ? [session.user.unitId] : [])
    if (analystUnits.length === 0) return NextResponse.json([])

    // Se solicitou uma unidade específica dentro das suas, filtra por ela; senão retorna todas
    const effectiveUnit = unitId && analystUnits.includes(unitId) ? unitId : null
    if (effectiveUnit) {
      where.OR = [
        { unitId: effectiveUnit },
        { managedUnits: { some: { unitId: effectiveUnit } } },
      ]
    } else {
      where.OR = [
        { unitId: { in: analystUnits } },
        { managedUnits: { some: { unitId: { in: analystUnits } } } },
      ]
    }
  } else if (unitId) {
    where.OR = [
      { unitId },
      { managedUnits: { some: { unitId } } },
    ]
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, role: true,
      active: true, unitId: true, createdAt: true,
      unit: { select: { id: true, name: true, color: true } },
      managedUnits: { select: { unitId: true, unit: { select: { id: true, name: true, color: true } } } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bcrypt = await import('bcryptjs')
  const body = await req.json()

  const existing = await prisma.user.findUnique({ where: { email: body.email } })
  if (existing) return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 400 })

  const hashedPassword = await bcrypt.hash(body.password, 12)
  const unitIds: string[] = Array.isArray(body.unitIds) ? body.unitIds : (body.unitId ? [body.unitId] : [])
  const primaryUnitId = unitIds[0] || null

  const user = await prisma.user.create({
    data: {
      name: body.name, email: body.email, password: hashedPassword,
      role: body.role ?? 'ANALYST', unitId: primaryUnitId, mustChangePassword: true,
      managedUnits: unitIds.length ? { create: unitIds.map(id => ({ unitId: id })) } : undefined,
    },
    select: {
      id: true, name: true, email: true, role: true, active: true, unitId: true, createdAt: true,
      managedUnits: { select: { unitId: true, unit: { select: { id: true, name: true, color: true } } } },
    },
  })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'CREATE', entity: 'Usuário', entityId: user.id, entityName: user.name,
    details: { email: user.email, perfil: user.role },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(user, { status: 201 })
}
