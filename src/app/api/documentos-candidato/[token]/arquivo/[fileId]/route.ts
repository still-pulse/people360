import { NextRequest, NextResponse } from 'next/server'
import { extractIp } from '@/lib/audit'
import { checkPublicDocLinkRateLimit } from '@/lib/rateLimit'
import { getValidDocumentoLink } from '@/lib/documentoLink'
import { readDocumentoArquivo } from '@/lib/documentoStorage'

export const dynamic = 'force-dynamic'

const MIME_INLINE = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

// Rota pública (sem sessão) — o candidato revê o próprio arquivo já enviado.
export async function GET(req: NextRequest, { params }: { params: { token: string; fileId: string } }) {
  const ip = extractIp(req.headers) ?? 'unknown'
  const rl = checkPublicDocLinkRateLimit(`${params.token}:${ip}`)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const link = await getValidDocumentoLink(params.token)
  if (!link) return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })

  const arquivo = link.itens.flatMap((i) => i.arquivos).find((a) => a.id === params.fileId)
  if (!arquivo) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })

  const buffer = await readDocumentoArquivo(arquivo.nomeArmazenado)
  if (!buffer) return NextResponse.json({ error: 'Arquivo não encontrado no armazenamento.' }, { status: 404 })

  const isInline = MIME_INLINE.has(arquivo.tipo)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': arquivo.tipo,
      'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${arquivo.nomeOriginal.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
