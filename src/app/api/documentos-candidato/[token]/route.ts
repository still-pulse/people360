import { NextRequest, NextResponse } from 'next/server'
import { extractIp } from '@/lib/audit'
import { checkPublicDocLinkRateLimit } from '@/lib/rateLimit'
import { getValidDocumentoLink } from '@/lib/documentoLink'

export const dynamic = 'force-dynamic'

// Rota pública (sem sessão) — o candidato consulta o status do próprio checklist pelo token do link.
export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const ip = extractIp(req.headers) ?? 'unknown'
  const rl = checkPublicDocLinkRateLimit(`${params.token}:${ip}`)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const link = await getValidDocumentoLink(params.token)
  if (!link) return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })

  return NextResponse.json({
    status: link.status,
    expiresAt: link.expiresAt,
    candidato: { nome: link.candidato.nome },
    cargo: link.vaga.cargo,
    itens: link.itens.map((item) => ({
      id: item.id,
      status: item.status,
      motivoRejeicao: item.motivoRejeicao,
      tipo: { id: item.tipo.id, nome: item.tipo.nome },
      arquivos: item.arquivos.map((a) => ({ id: a.id, nomeOriginal: a.nomeOriginal, createdAt: a.createdAt })),
    })),
  })
}
