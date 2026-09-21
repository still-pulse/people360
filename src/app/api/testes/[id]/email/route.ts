import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'
import { log } from '@/lib/audit'
import { sendEmail, emailTemplate, appUrl } from '@/lib/email'

// POST /api/testes/:id/email — reenvia convite por e-mail
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro
  if (!['ADMIN', 'ANALYST'].includes(session!.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const convite = await prisma.testeConvite.findUnique({ where: { id: params.id } })
  if (!convite) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (convite.status === 'CONCLUIDO' || convite.status === 'REVOGADO') {
    return NextResponse.json({ error: 'Convite não pode ser reenviado neste status' }, { status: 400 })
  }
  if (convite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Convite expirado' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const email = (body.email ? String(body.email).trim() : convite.email) || null
  if (!email) {
    return NextResponse.json({ error: 'E-mail não informado' }, { status: 400 })
  }

  const tipoLabel = convite.tipo === 'BIG_FIVE' ? 'Big Five (OCEAN)' : 'DISC'
  const linkUrl = appUrl(`/teste/${convite.token}`)

  const result = await sendEmail({
    to: email,
    subject: `Convite para avaliação ${tipoLabel} — BHCL`,
    html: emailTemplate({
      title: `Avaliação ${tipoLabel}`,
      body: `Olá, ${convite.nome}!\n\nVocê foi convidado(a) a realizar a avaliação ${tipoLabel} da BHCL.\n\nO link é pessoal e válido até ${convite.expiresAt.toLocaleDateString('pt-BR')}.`,
      ctaLabel: 'Iniciar avaliação',
      ctaUrl: linkUrl,
    }),
  })

  if (result.ok) {
    await prisma.testeConvite.update({
      where: { id: convite.id },
      data: { enviadoAt: new Date(), email },
    })
  }

  await log({
    userId: session!.user.id,
    userName: session!.user.name,
    userRole: session!.user.role,
    action: 'SEND',
    entity: 'TesteConvite',
    entityId: convite.id,
    entityName: convite.nome,
    details: { email, ok: result.ok },
  })

  return NextResponse.json({ ok: result.ok, error: result.error, linkUrl })
}
