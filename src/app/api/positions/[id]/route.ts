import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const position = await prisma.position.findUnique({
    where: { id: params.id },
    include: { aliases: { orderBy: { alias: 'asc' } }, _count: { select: { vagas: true } } },
  })
  if (!position) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(position)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const before = await prisma.position.findUnique({ where: { id: params.id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  if (body.name) {
    const duplicate = await prisma.position.findFirst({
      where: { name: { equals: body.name.trim(), mode: 'insensitive' }, id: { not: params.id } },
    })
    if (duplicate) return NextResponse.json({ error: 'Já existe um cargo com este nome.' }, { status: 400 })
  }

  const position = await prisma.position.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.codigoInterno !== undefined ? { codigoInterno: body.codigoInterno || null } : {}),
      ...(body.categoria !== undefined ? { categoria: body.categoria || null } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
    include: { aliases: { orderBy: { alias: 'asc' } }, _count: { select: { vagas: true } } },
  })

  // Se o nome mudou, sincroniza o campo cargo das vagas vinculadas
  if (body.name && body.name.trim() !== before.name) {
    await prisma.vaga.updateMany({
      where: { cargoId: params.id },
      data: { cargo: body.name.trim() },
    })
  }

  const action = body.active === false && before.active ? 'DISABLE'
    : body.active === true && !before.active ? 'ENABLE'
    : 'UPDATE'

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action, entity: 'Cargo', entityId: params.id, entityName: before.name,
    details: action === 'UPDATE' ? { antes: before.name, depois: body.name } : null,
    ip: extractIp(req.headers),
  })

  return NextResponse.json(position)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const position = await prisma.position.findUnique({
    where: { id: params.id },
    include: { _count: { select: { vagas: true } } },
  })
  if (!position) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (position._count.vagas > 0) {
    return NextResponse.json(
      { error: `Este cargo está vinculado a ${position._count.vagas} vaga(s) e não pode ser excluído.` },
      { status: 409 }
    )
  }

  await prisma.position.delete({ where: { id: params.id } })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'DELETE', entity: 'Cargo', entityId: params.id, entityName: position.name,
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ ok: true })
}
