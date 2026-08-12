import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyUsers } from '@/lib/notify'
import { log, extractIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const TIPO_LABELS: Record<string, string> = {
  HORAS_EXTRAS:     'Horas extras',
  BANCO_HORAS:      'Usar banco de horas',
  FOLGA:            'Folga',
  AUSENCIA:         'Ausência',
  AUSENCIA_PARCIAL: 'Ausência Parcial',
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const chamado = await prisma.chamado.findUnique({ where: { id: params.id } })
  if (!chamado) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!chamado.tipoSolicitacao) return NextResponse.json({ error: 'Não é uma solicitação' }, { status: 400 })
  if (chamado.aprovacaoStatus !== 'PENDENTE') return NextResponse.json({ error: 'Solicitação já processada' }, { status: 400 })

  const body = await req.json()
  const { decisao, justificativa } = body

  if (!['APROVADO', 'REJEITADO'].includes(decisao)) {
    return NextResponse.json({ error: 'Decisão inválida' }, { status: 400 })
  }

  const updated = await prisma.chamado.update({
    where: { id: params.id },
    data: {
      aprovacaoStatus:        decisao,
      aprovacaoJustificativa: justificativa?.trim() || null,
      aprovadoPorId:          session.user.id,
      aprovadoAt:             new Date(),
      status:                 'RESOLVIDO',
      resolvidoAt:            new Date(),
    },
    include: {
      autor:      { select: { id: true, name: true } },
      aprovadoPor: { select: { id: true, name: true } },
    },
  })

  const tipoLabel = TIPO_LABELS[chamado.tipoSolicitacao as string] ?? 'Solicitação'
  const aprovStr  = decisao === 'APROVADO' ? 'aprovada' : 'rejeitada'

  await notifyUsers([chamado.autorId], {
    type:  'TASK' as const,
    title: `${tipoLabel} ${aprovStr}`,
    body:  justificativa?.trim() || `Sua solicitação foi ${aprovStr} por ${session.user.name}.`,
    href:  `/chamados/${params.id}`,
  }, session.user.id)

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'UPDATE', entity: 'Chamado', entityId: params.id, entityName: chamado.titulo,
    details: { aprovacao: decisao, justificativa: justificativa?.trim() || null },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(updated)
}
