import { NextRequest, NextResponse } from 'next/server'
import { getAdmissionByPublicToken, getMutableAdmissionByPublicToken } from '@/lib/admission/service'
import { usesExternalSignature } from '@/lib/admission/providers'
import { isFaceVerificationEnabled } from '@/lib/admission/features'
import { latestExternalSignature, startExternalSignature, syncExternalSignature } from '@/lib/admission/externalSignature'
import { extractIp } from '@/lib/audit'

// Evita consultar a Autentique a cada atualização do portal (limite de 60 req/min da API).
const lastCheck = new Map<string, number>()
const CHECK_INTERVAL = 15_000

/** Situação da assinatura na Autentique (o portal consulta enquanto o candidato assina). */
export async function GET(_req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params
  const token = await getAdmissionByPublicToken(params.token)
  if (!token) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  let request = await latestExternalSignature(token.admissionId)
  if (request?.status === 'PENDING' && Date.now() - (lastCheck.get(request.id) ?? 0) > CHECK_INTERVAL) {
    lastCheck.set(request.id, Date.now())
    try { await syncExternalSignature(request.id) } catch (error) { console.error('[autentique] Falha ao consultar a assinatura:', error) }
    request = await latestExternalSignature(token.admissionId)
  }
  return NextResponse.json({ status: request?.status ?? 'NOT_STARTED', signLink: request?.status === 'PENDING' ? request.signLink : null, rejectedReason: request?.rejectedReason ?? null })
}

/** Gera o pacote de documentos, envia à Autentique e devolve o link de assinatura do candidato. */
export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params
  if (!usesExternalSignature()) return NextResponse.json({ error: 'A assinatura pela Autentique não está ativa.' }, { status: 409 })
  const token = await getMutableAdmissionByPublicToken(params.token)
  if (!token) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  if (!['CONTRACT_PENDING', 'SIGNATURE_PENDING'].includes(token.admission.status)) return NextResponse.json({ error: 'A admissão ainda não está pronta para assinatura.' }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  if (body?.accepted !== true) return NextResponse.json({ error: 'Confirme a leitura e concordância.' }, { status: 400 })
  if (token.admission.documents.some((document) => document.type.required && document.status !== 'APPROVED')) return NextResponse.json({ error: 'Ainda existem documentos obrigatórios pendentes.' }, { status: 409 })
  if (isFaceVerificationEnabled() && token.admission.faceVerifications[0]?.status !== 'APPROVED') return NextResponse.json({ error: 'A validação facial precisa estar aprovada.' }, { status: 409 })
  try {
    const request = await startExternalSignature(token.admissionId, req.nextUrl.origin, { ip: extractIp(req.headers), userAgent: req.headers.get('user-agent') })
    return NextResponse.json({ status: request.status, signLink: request.signLink })
  } catch (error) {
    console.error('[autentique] Falha ao enviar para assinatura:', token.admission.protocol, error)
    // 422 e não 502: o Cloudflare troca respostas 502 pela página dele e a mensagem se perde.
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar para assinatura.' }, { status: 422 })
  }
}
