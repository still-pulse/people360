import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'
import { parseSalarios, positionInclude } from '@/lib/positionSalaries'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === 'true'
  const withAliases = searchParams.get('aliases') === 'true'

  const positions = await prisma.position.findMany({
    where: all ? {} : { active: true },
    orderBy: { name: 'asc' },
    include: withAliases ? positionInclude : undefined,
  })
  return NextResponse.json(positions)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })

  const existing = await prisma.position.findFirst({
    where: { name: { equals: body.name.trim(), mode: 'insensitive' } },
  })
  if (existing) return NextResponse.json({ error: 'Já existe um cargo com este nome.' }, { status: 400 })
  const { salarios, error: salarioError } = parseSalarios(body.salarios)
  if (salarioError) return NextResponse.json({ error: salarioError }, { status: 400 })
  if (salarios && session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Apenas administradores definem salários.' }, { status: 403 })

  const position = await prisma.position.create({
    data: {
      name: body.name.trim(),
      codigoInterno: body.codigoInterno || null,
      categoria: body.categoria || null,
      departamento: body.departamento?.trim() || null,
      ...(salarios?.length ? { salarios: { create: salarios } } : {}),
    },
    include: positionInclude,
  })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'CREATE', entity: 'Cargo', entityId: position.id, entityName: position.name,
    ip: extractIp(req.headers),
  })

  return NextResponse.json(position, { status: 201 })
}
