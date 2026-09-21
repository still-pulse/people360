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

  const before = await prisma.unit.findUnique({ where: { id: params.id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const unit = await prisma.unit.update({
    where: { id: params.id },
    data: {
      name: body.name, color: body.color, description: body.description, active: body.active,
      ...(body.exibirIndicadores !== undefined ? { exibirIndicadores: body.exibirIndicadores } : {}),
      ...(body.indicadoresAteYear !== undefined ? { indicadoresAteYear: body.indicadoresAteYear } : {}),
      ...(body.indicadoresAteMonth !== undefined ? { indicadoresAteMonth: body.indicadoresAteMonth } : {}),
    },
  })

  const action = body.active === false && before.active ? 'DISABLE'
    : body.active === true && !before.active ? 'ENABLE'
    : 'UPDATE'

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action, entity: 'Unidade', entityId: params.id, entityName: before.name,
    details: action === 'UPDATE' ? { antes: { nome: before.name, cor: before.color }, depois: { nome: unit.name, cor: unit.color } } : null,
    ip: extractIp(req.headers),
  })

  return NextResponse.json(unit)
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const unit = await prisma.unit.findUnique({ where: { id: params.id }, select: { name: true } })
  await prisma.unit.update({ where: { id: params.id }, data: { active: false } })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'DISABLE', entity: 'Unidade', entityId: params.id, entityName: unit?.name ?? params.id,
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ success: true })
}
