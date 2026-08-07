import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyUsers } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chamado = await prisma.chamado.findUnique({
    where: { id: params.id },
    include: { autor: { select: { id: true, name: true } } },
  })
  if (!chamado) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Analista só pode responder nos chamados onde é autor ou atribuído
  if (session.user.role === 'ANALYST') {
    const isAutor     = chamado.autorId     === session.user.id
    const isAtribuido = chamado.atribuidoId === session.user.id
    if (!isAutor && !isAtribuido) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Chamado fechado não aceita mais mensagens
  if (chamado.status === 'FECHADO') {
    return NextResponse.json({ error: 'Este chamado está fechado.' }, { status: 400 })
  }

  const body = await req.json()
  const { conteudo, anexos } = body

  if (!conteudo?.trim() && (!anexos || anexos.length === 0)) {
    return NextResponse.json({ error: 'Mensagem ou anexo obrigatório.' }, { status: 400 })
  }

  const msg = await prisma.chamadoMensagem.create({
    data: {
      chamadoId: params.id,
      autorId: session.user.id,
      conteudo: conteudo?.trim() ?? '',
      ...(anexos?.length ? {
        anexos: {
          create: anexos.map((a: { url: string; nome: string; tamanho: number; tipo: string }) => ({
            url: a.url, nome: a.nome, tamanho: a.tamanho, tipo: a.tipo,
          })),
        },
      } : {}),
    },
    include: {
      autor: { select: { id: true, name: true, avatarUrl: true, role: true } },
      anexos: true,
    },
  })

  // Se estava ABERTO, passa para EM_ANDAMENTO automaticamente
  if (chamado.status === 'ABERTO' && session.user.role === 'ADMIN') {
    await prisma.chamado.update({ where: { id: params.id }, data: { status: 'EM_ANDAMENTO' } })
  }

  // Notifica o outro lado
  const notifPayload = {
    type: 'TASK' as const,
    title: `Nova resposta: ${chamado.titulo}`,
    body: conteudo.trim().slice(0, 80),
    href: `/chamados/${params.id}`,
  }

  if (session.user.role === 'ADMIN') {
    // Notifica o autor do chamado
    await notifyUsers([chamado.autorId], notifPayload, session.user.id)
  } else {
    // Analista respondendo — notifica o atribuído ou todos os admins
    const targets = chamado.atribuidoId ? [chamado.atribuidoId] : []
    if (targets.length > 0) {
      await notifyUsers(targets, notifPayload, session.user.id)
    } else {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } })
      await notifyUsers(admins.map((a) => a.id), notifPayload, session.user.id)
    }
  }

  return NextResponse.json(msg, { status: 201 })
}
