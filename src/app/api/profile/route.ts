import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      jobTitle: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      unit: { select: { id: true, name: true, color: true } },
    },
  })

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, phone, jobTitle, bio } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
  if (name.trim().length < 2) return NextResponse.json({ error: 'Nome muito curto.' }, { status: 400 })

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: name.trim(),
      phone: phone?.trim() || null,
      jobTitle: jobTitle?.trim() || null,
      bio: bio?.trim() || null,
    },
    select: { id: true, name: true, phone: true, jobTitle: true, bio: true, avatarUrl: true },
  })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'UPDATE', entity: 'Perfil', entityId: session.user.id, entityName: name.trim(),
    details: { campos: Object.keys({ name, phone, jobTitle, bio }).filter(k => ({ name, phone, jobTitle, bio } as any)[k] !== undefined) },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(updated)
}
