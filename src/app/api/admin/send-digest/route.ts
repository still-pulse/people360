import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendDailyDigest, sendNewVagasDigest } from '@/lib/cron'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  if (type === 'novas-vagas') {
    const result = await sendNewVagasDigest()
    return NextResponse.json({
      ok: true,
      ...result,
      message: result.vagas === 0
        ? 'Nenhuma vaga aberta hoje.'
        : `Digest enviado: ${result.vagas} vaga(s) para ${result.sent} destinatário(s).`,
    })
  }

  await sendDailyDigest()
  return NextResponse.json({ ok: true, message: 'Digest de pendências enviado.' })
}
