import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const before = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, role: true, active: true, unitId: true },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const unitIds: string[] = Array.isArray(body.unitIds) ? body.unitIds : (body.unitId ? [body.unitId] : [])
  const primaryUnitId = unitIds[0] || null

  const updateData: any = {
    name: body.name, email: body.email, role: body.role,
    active: body.active, unitId: primaryUnitId,
  }

  if (body.password) {
    const bcrypt = await import('bcryptjs')
    updateData.password = await bcrypt.hash(body.password, 12)
  }

  // Substituir unidades gerenciadas
  await prisma.userUnit.deleteMany({ where: { userId: params.id } })
  if (unitIds.length) {
    await prisma.userUnit.createMany({
      data: unitIds.map(id => ({ userId: params.id, unitId: id })),
      skipDuplicates: true,
    })
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: {
      id: true, name: true, email: true, role: true, active: true, unitId: true,
      managedUnits: { select: { unitId: true, unit: { select: { id: true, name: true, color: true } } } },
    },
  })

  const action = body.active === false && before.active ? 'DISABLE'
    : body.active === true && !before.active ? 'ENABLE'
    : body.password ? 'PASSWORD_CHANGED'
    : 'UPDATE'

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action, entity: 'Usuário', entityId: params.id, entityName: before.name,
    details: action === 'UPDATE'
      ? { antes: { nome: before.name, email: before.email, perfil: before.role }, depois: { nome: user.name, email: user.email, perfil: user.role } }
      : null,
    ip: extractIp(req.headers),
  })

  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await prisma.user.findUnique({ where: { id: params.id }, select: { name: true } })
  await prisma.user.update({ where: { id: params.id }, data: { active: false } })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'DISABLE', entity: 'Usuário', entityId: params.id, entityName: user?.name ?? params.id,
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ success: true })
}
