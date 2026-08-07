import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'
import { checkPublicDocLinkRateLimit } from '@/lib/rateLimit'
import { getValidDocumentoLink } from '@/lib/documentoLink'
import { saveDocumentoArquivo, DOCUMENTO_MAX_SIZE, DOCUMENTO_ALLOWED_TYPES } from '@/lib/documentoStorage'

export const dynamic = 'force-dynamic'

// Rota pública (sem sessão) — o candidato envia um documento para um item do checklist.
export async function POST(req: NextRequest, { params }: { params: { token: string; itemId: string } }) {
  const ip = extractIp(req.headers) ?? 'unknown'
  const rl = checkPublicDocLinkRateLimit(`${params.token}:${ip}`)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const link = await getValidDocumentoLink(params.token)
  if (!link) return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })
  if (link.status !== 'ATIVO') {
    return NextResponse.json({ error: 'Este link não está mais ativo. Fale com o RH para gerar um novo.' }, { status: 403 })
  }

  const item = link.itens.find((i) => i.id === params.itemId)
  if (!item) return NextResponse.json({ error: 'Item não encontrado neste link.' }, { status: 404 })
  if (item.status === 'APROVADO') {
    return NextResponse.json({ error: 'Este documento já foi aprovado.' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
  if (file.size > DOCUMENTO_MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Limite: 15 MB.' }, { status: 400 })
  }
  if (!DOCUMENTO_ALLOWED_TYPES[file.type]) {
    return NextResponse.json({ error: 'Formato inválido. Envie PDF, JPG, PNG ou WEBP.' }, { status: 400 })
  }

  const saved = await saveDocumentoArquivo(link.id, item.id, file)

  await prisma.documentoArquivo.create({
    data: {
      itemId: item.id,
      nomeOriginal: file.name,
      nomeArmazenado: saved.nomeArmazenado,
      tamanho: saved.tamanho,
      tipo: saved.tipo,
    },
  })

  await prisma.documentoLinkItem.update({
    where: { id: item.id },
    data: { status: 'ENVIADO', motivoRejeicao: null, revisadoPorId: null, revisadoAt: null },
  })

  await log({
    userId: null, userName: link.candidato.nome, userRole: 'CANDIDATO',
    action: 'UPLOAD', entity: 'CandidatoDocumento', entityId: link.candidatoId, entityName: link.candidato.nome,
    details: { linkId: link.id, itemId: item.id, tipo: item.tipo.nome, nomeOriginal: file.name },
    ip,
  })

  return NextResponse.json({ success: true })
}
