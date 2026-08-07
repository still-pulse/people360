import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'
import { notifyUsers } from '@/lib/notify'
import { log, extractIp } from '@/lib/audit'

// GET — retorna thread de comentários da aprovação
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const comentarios = await prisma.vagaAprovacaoComentario.findMany({
    where: { vagaId: params.id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(comentarios)
}

// POST — ação do admin (APROVAR | REJEITAR | SOLICITAR_INFO) ou resposta da analista (RESPOSTA)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro

  const body = await req.json()
  const { acao, mensagem } = body as { acao: string; mensagem: string }

  const vaga = await prisma.vaga.findUnique({
    where: { id: params.id },
    include: { analistas: { select: { id: true, name: true } }, unit: { select: { name: true } } },
  })
  if (!vaga) return NextResponse.json({ error: 'Vaga não encontrada' }, { status: 404 })

  const isAdmin = ['ADMIN', 'SUPERINTENDENT', 'GERENTE'].includes(session!.user.role)
  const isAnalista = session!.user.role === 'ANALYST'

  // Ações do admin
  if (acao === 'APROVAR') {
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.vaga.update({ where: { id: params.id }, data: { status: 'ABERTA' } })
    await prisma.vagaHistorico.create({
      data: { vagaId: params.id, userId: session!.user.id, fromStatus: 'PENDENTE_APROVACAO' as any, toStatus: 'ABERTA' as any, descricao: 'Vaga aprovada' },
    })
    await prisma.vagaAprovacaoComentario.create({
      data: { vagaId: params.id, userId: session!.user.id, tipo: 'APROVACAO', mensagem: mensagem || 'Vaga aprovada.' },
    })
    const analistaIds49 = vaga.analistas.map((a) => a.id)
    if (analistaIds49.length) {
      await notifyUsers(analistaIds49, {
        type: 'VAGA',
        title: `Vaga aprovada: ${vaga.cargo}`,
        body: mensagem || 'Sua vaga foi aprovada e está disponível.',
        href: `/vagas/${params.id}`,
      }, session!.user.id)
    }
    await log({ userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role, action: 'UPDATE', entity: 'Vaga', entityId: params.id, entityName: vaga.titulo, details: { acao: 'APROVACAO' }, ip: extractIp(req.headers) })
    return NextResponse.json({ ok: true, newStatus: 'ABERTA' })
  }

  if (acao === 'REJEITAR') {
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!mensagem?.trim()) return NextResponse.json({ error: 'Mensagem obrigatória para rejeição' }, { status: 400 })

    await prisma.vaga.update({ where: { id: params.id }, data: { status: 'REJEITADA' as any } })
    await prisma.vagaHistorico.create({
      data: { vagaId: params.id, userId: session!.user.id, fromStatus: 'PENDENTE_APROVACAO' as any, toStatus: 'REJEITADA' as any, descricao: 'Vaga rejeitada' },
    })
    await prisma.vagaAprovacaoComentario.create({
      data: { vagaId: params.id, userId: session!.user.id, tipo: 'REJEICAO', mensagem },
    })
    const analistaIds72 = vaga.analistas.map((a) => a.id)
    if (analistaIds72.length) {
      await notifyUsers(analistaIds72, {
        type: 'VAGA',
        title: `Vaga rejeitada: ${vaga.cargo}`,
        body: mensagem,
        href: `/vagas/${params.id}`,
      }, session!.user.id)
    }
    await log({ userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role, action: 'UPDATE', entity: 'Vaga', entityId: params.id, entityName: vaga.titulo, details: { acao: 'REJEICAO', motivo: mensagem }, ip: extractIp(req.headers) })
    return NextResponse.json({ ok: true, newStatus: 'REJEITADA' })
  }

  if (acao === 'SOLICITAR_INFO') {
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!mensagem?.trim()) return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })

    await prisma.vagaAprovacaoComentario.create({
      data: { vagaId: params.id, userId: session!.user.id, tipo: 'SOLICITACAO_INFO', mensagem },
    })
    const analistaIds91 = vaga.analistas.map((a) => a.id)
    if (analistaIds91.length) {
      await notifyUsers(analistaIds91, {
        type: 'VAGA',
        title: `Informações solicitadas: ${vaga.cargo}`,
        body: mensagem,
        href: `/vagas/${params.id}`,
      }, session!.user.id)
    }
    return NextResponse.json({ ok: true })
  }

  if (acao === 'RESPOSTA') {
    if (!isAnalista && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!mensagem?.trim()) return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })

    await prisma.vagaAprovacaoComentario.create({
      data: { vagaId: params.id, userId: session!.user.id, tipo: 'RESPOSTA', mensagem },
    })
    // Notifica admins sobre a resposta
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    const adminIds = admins.map((a) => a.id).filter((id) => id !== session!.user.id)
    if (adminIds.length) {
      await notifyUsers(adminIds, {
        type: 'VAGA',
        title: `Resposta recebida: ${vaga.cargo}`,
        body: `${session!.user.name}: ${mensagem}`,
        href: `/vagas/pendentes`,
      }, session!.user.id)
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
