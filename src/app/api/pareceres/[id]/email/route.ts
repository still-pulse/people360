import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { sendEmail, emailTemplate, appUrl } from '@/lib/email'
import { log, extractIp } from '@/lib/audit'
import { PARECER_RESULTADO_LABELS } from '@/types'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const body = await req.json()
  const to = String(body.to || '').trim()
  if (!EMAIL_REGEX.test(to)) {
    return NextResponse.json({ error: 'Informe um e-mail válido' }, { status: 400 })
  }

  const parecer = await prisma.parecer.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      candidatoNome: true,
      cargo: true,
      resultado: true,
      elaborador: { select: { name: true } },
    },
  })
  if (!parecer) return NextResponse.json({ error: 'Parecer não encontrado' }, { status: 404 })

  const resultadoLabel = parecer.resultado
    ? PARECER_RESULTADO_LABELS[parecer.resultado as keyof typeof PARECER_RESULTADO_LABELS]
    : 'Em análise'

  const html = emailTemplate({
    title: `Parecer de Recrutamento — ${parecer.candidatoNome}`,
    body: `Cargo: ${parecer.cargo}\nResultado: ${resultadoLabel}${parecer.elaborador ? `\nElaborado por: ${parecer.elaborador.name}` : ''}\n\nEste documento é confidencial. Acesse o sistema para visualizar o parecer completo.`,
    ctaLabel: 'Ver parecer completo',
    ctaUrl: appUrl(`/pareceres/${parecer.id}`),
  })

  const result = await sendEmail({
    to,
    subject: `Parecer de Recrutamento — ${parecer.candidatoNome}`,
    html,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Falha ao enviar e-mail' }, { status: 502 })
  }

  await log({
    userId: session!.user.id,
    userName: session!.user.name,
    userRole: session!.user.role,
    action: 'SEND',
    entity: 'Parecer',
    entityId: parecer.id,
    entityName: parecer.candidatoNome,
    details: { to },
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ ok: true })
}
