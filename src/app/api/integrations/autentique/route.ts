import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAutentiqueWebhook } from '@/lib/autentique'
import { syncExternalSignature } from '@/lib/admission/externalSignature'

export const dynamic = 'force-dynamic'

/** Ids de documento que podem vir no evento (document.* traz o próprio documento; signature.* traz o vínculo). */
function documentIds(object: Record<string, any> | undefined) {
  if (!object) return []
  return [object.id, object.document?.id, object.document_id, object.document].filter((value): value is string => typeof value === 'string')
}

/**
 * Webhook da Autentique (cadastre em Autentique → Configurações → Webhooks, eventos document.finished e
 * signature.accepted / signature.rejected). O corpo é conferido com AUTENTIQUE_WEBHOOK_SECRET.
 * O evento só dispara a consulta: o estado verdadeiro é sempre lido da API da Autentique.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (!verifyAutentiqueWebhook(raw, req.headers.get('x-autentique-signature'))) return NextResponse.json({ error: 'Assinatura do webhook inválida.' }, { status: 401 })
  let payload: { event?: { type?: string; data?: { object?: Record<string, any> } } }
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }
  const type = payload.event?.type ?? ''
  if (!/^(document|signature)\./.test(type)) return NextResponse.json({ ignored: true })
  const ids = documentIds(payload.event?.data?.object)
  const request = ids.length ? await prisma.externalSignatureRequest.findFirst({ where: { externalId: { in: ids } }, orderBy: { createdAt: 'desc' } }) : null
  if (!request) return NextResponse.json({ ignored: true })
  try {
    const status = await syncExternalSignature(request.id)
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    console.error('[autentique-webhook] Falha ao processar o evento', type, request.externalId, error)
    // 500 faz a Autentique tentar de novo (60 s, 120 s e 300 s).
    return NextResponse.json({ error: 'Falha ao processar.' }, { status: 500 })
  }
}
