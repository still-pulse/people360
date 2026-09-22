import { NextRequest, NextResponse } from 'next/server'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { getEvolutionConfig, getEvolutionConnection, getEvolutionQrCode, saveEvolutionConfig } from '@/lib/evolution'
import { extractIp, log } from '@/lib/audit'

async function admin() {
  const auth = await getSessionOrUnauthorized()
  if (auth.error) return auth
  if ((auth.session!.user.actualRole ?? auth.session!.user.role) !== 'ADMIN') return { ...auth, error: NextResponse.json({ error: 'Sem permissão.' }, { status: 403 }) }
  return auth
}

export async function GET(req: NextRequest) {
  const auth = await admin(); if (auth.error) return auth.error
  const config = await getEvolutionConfig()
  const connection = await getEvolutionConnection()
  if (req.nextUrl.searchParams.get('qr') === '1') {
    try { return NextResponse.json({ ...connection, ...(await getEvolutionQrCode()) }) }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao gerar QR Code.' }, { status: 502 }) }
  }
  return NextResponse.json({ baseUrl: config?.baseUrl || '', instance: config?.instance || '', hasApiKey: Boolean(config?.apiKey), ...connection })
}

export async function PUT(req: NextRequest) {
  const auth = await admin(); if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  try {
    await saveEvolutionConfig({ baseUrl: String(body.baseUrl || ''), instance: String(body.instance || ''), apiKey: body.apiKey ? String(body.apiKey) : undefined, enabled: body.enabled !== false })
    await log({ userId: auth.session!.user.id, userName: auth.session!.user.name, userRole: auth.session!.user.role, action: 'UPDATE', entity: 'Configuração', entityName: 'Evolution API', details: { baseUrl: body.baseUrl, instance: body.instance, enabled: body.enabled !== false }, ip: extractIp(req.headers) })
    return NextResponse.json({ success: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Configuração inválida.' }, { status: 400 }) }
}
