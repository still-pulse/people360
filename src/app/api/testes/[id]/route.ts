import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'
import { log } from '@/lib/audit'
import { appUrl } from '@/lib/email'

const ALLOWED = ['ADMIN', 'ANALYST']

// GET /api/testes/:id — detalhe (scores só ADMIN)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (!ALLOWED.includes(session!.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const convite = await prisma.testeConvite.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true } },
      controleCandidato: { select: { id: true, nome: true, funcao: true, status: true } },
      resultado: true,
    },
  })
  if (!convite) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const linkUrl = appUrl(`/teste/${convite.token}`)

  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({
      ...convite,
      token: convite.status === 'CONCLUIDO' ? undefined : convite.token,
      linkUrl: convite.status === 'CONCLUIDO' ? undefined : linkUrl,
      resultado: convite.resultado
        ? {
            id: convite.resultado.id,
            completedAt: convite.resultado.completedAt,
            perfilPredominante: null,
            scores: null,
            answers: null,
          }
        : null,
    })
  }

  return NextResponse.json({ ...convite, linkUrl })
}

// PATCH /api/testes/:id — revogar
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro
  if (!ALLOWED.includes(session!.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const convite = await prisma.testeConvite.findUnique({ where: { id: params.id } })
  if (!convite) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  if (body.action === 'revoke') {
    if (convite.status === 'CONCLUIDO') {
      return NextResponse.json({ error: 'Não é possível revogar um teste já concluído' }, { status: 400 })
    }
    const updated = await prisma.testeConvite.update({
      where: { id: params.id },
      data: { status: 'REVOGADO' },
    })
    await log({
      userId: session!.user.id,
      userName: session!.user.name,
      userRole: session!.user.role,
      action: 'REVOKE_LINK',
      entity: 'TesteConvite',
      entityId: convite.id,
      entityName: convite.nome,
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}

// DELETE /api/testes/:id — excluir convite (e resultado em cascade). Só ADMIN.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const convite = await prisma.testeConvite.findUnique({ where: { id: params.id } })
  if (!convite) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.testeConvite.delete({ where: { id: params.id } })
  await log({
    userId: session!.user.id,
    userName: session!.user.name,
    userRole: session!.user.role,
    action: 'DELETE',
    entity: 'TesteConvite',
    entityId: convite.id,
    entityName: convite.nome,
  })
  return NextResponse.json({ ok: true })
}
