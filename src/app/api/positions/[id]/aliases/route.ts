import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { alias } = await req.json()
  if (!alias?.trim()) return NextResponse.json({ error: 'Alias é obrigatório' }, { status: 400 })

  const position = await prisma.position.findUnique({ where: { id: params.id } })
  if (!position) return NextResponse.json({ error: 'Cargo não encontrado' }, { status: 404 })

  const existing = await prisma.cargoAlias.findFirst({ where: { alias: alias.trim() } })
  if (existing) return NextResponse.json({ error: 'Este alias já existe.' }, { status: 409 })

  const created = await prisma.cargoAlias.create({
    data: { positionId: params.id, alias: alias.trim() },
  })
  return NextResponse.json(created, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { aliasId } = await req.json()
  if (!aliasId) return NextResponse.json({ error: 'aliasId é obrigatório' }, { status: 400 })

  await prisma.cargoAlias.delete({ where: { id: aliasId, positionId: params.id } })
  return NextResponse.json({ ok: true })
}
