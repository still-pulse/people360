import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { forbidIfReadOnly } from '@/lib/apiHelpers'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const list = await prisma.vagaAcompanhamento.findMany({
    where: { vagaId: params.id },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { data: 'desc' },
  })

  return NextResponse.json(list)
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ro = forbidIfReadOnly(session.user.role)
  if (ro) return ro

  const { decisao, notas } = await req.json()

  if (!decisao) return NextResponse.json({ error: 'Decisão obrigatória.' }, { status: 400 })

  const item = await prisma.vagaAcompanhamento.create({
    data: {
      vagaId:  params.id,
      userId:  session.user.id,
      decisao,
      notas:   notas || null,
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })

  // Se concluída, fecha a vaga automaticamente
  if (decisao === 'CONCLUIDA') {
    await prisma.vaga.update({
      where: { id: params.id },
      data:  { status: 'CONTRATADA', dataFechamento: new Date() },
    })
  }

  return NextResponse.json(item, { status: 201 })
}
