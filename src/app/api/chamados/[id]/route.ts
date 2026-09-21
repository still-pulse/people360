import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'
import { notifyUsers } from '@/lib/notify'

export const dynamic = 'force-dynamic'

async function checkAccess(chamadoId: string, session: any) {
  const chamado = await prisma.chamado.findUnique({ where: { id: chamadoId } })
  if (!chamado) return { chamado: null, forbidden: false }
  if (session.user.role === 'ANALYST') {
    const isAutor     = chamado.autorId     === session.user.id
    const isAtribuido = chamado.atribuidoId === session.user.id
    if (!isAutor && !isAtribuido) return { chamado, forbidden: true }
  }
  return { chamado, forbidden: false }
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { chamado, forbidden } = await checkAccess(params.id, session)
  if (!chamado) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const full = await prisma.chamado.findUnique({
    where: { id: params.id },
    include: {
      autor:       { select: { id: true, name: true, avatarUrl: true, role: true } },
      atribuido:   { select: { id: true, name: true, avatarUrl: true } },
      unit:        { select: { id: true, name: true, color: true } },
      aprovadoPor: { select: { id: true, name: true } },
      mensagens: {
        include: {
          autor:  { select: { id: true, name: true, avatarUrl: true, role: true } },
          anexos: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // Marca todas as mensagens do outro lado como lidas
  await prisma.chamadoMensagem.updateMany({
    where: { chamadoId: params.id, autorId: { not: session.user.id }, lida: false },
    data: { lida: true },
  })

  return NextResponse.json(full)
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { chamado, forbidden } = await checkAccess(params.id, session)
  if (!chamado) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Analista só pode fechar o próprio chamado
  if (session.user.role === 'ANALYST') {
    const allowed = body.status === 'FECHADO'
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data: any = {}
  if (body.status     !== undefined) data.status     = body.status
  if (body.prioridade !== undefined) data.prioridade = body.prioridade
  if (body.atribuidoId !== undefined) data.atribuidoId = body.atribuidoId || null

  if (body.status === 'RESOLVIDO' && chamado.status !== 'RESOLVIDO') {
    data.resolvidoAt = new Date()
  }

  const updated = await prisma.chamado.update({ where: { id: params.id }, data })

  if (body.status === 'PENDENTE' && chamado.status !== 'PENDENTE') {
    await notifyUsers([chamado.autorId], {
      type:  'TASK' as const,
      title: 'Chamado pendente de documento',
      body:  `Seu chamado "${chamado.titulo}" está pendente — envie o documento solicitado.`,
      href:  `/chamados/${params.id}`,
    }, session.user.id)
  }

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'UPDATE', entity: 'Chamado', entityId: params.id, entityName: chamado.titulo,
    details: { antes: { status: chamado.status }, depois: { status: body.status ?? chamado.status } },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const chamado = await prisma.chamado.findUnique({ where: { id: params.id } })
  if (!chamado) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.chamado.delete({ where: { id: params.id } })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'DELETE', entity: 'Chamado', entityId: params.id, entityName: chamado.titulo,
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ success: true })
}
