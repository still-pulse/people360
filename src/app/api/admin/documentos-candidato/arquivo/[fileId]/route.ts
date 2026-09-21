import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { readDocumentoArquivo } from '@/lib/documentoStorage'
import { log, extractIp } from '@/lib/audit'

const MIME_INLINE = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

export async function GET(req: NextRequest, props: { params: Promise<{ fileId: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (session!.user.role === 'JURIDICO') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const arquivo = await prisma.documentoArquivo.findUnique({
    where: { id: params.fileId },
    include: { item: { include: { link: { include: { candidato: true, vaga: true } } } } },
  })
  if (!arquivo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session!.user.role === 'ANALYST') {
    const units: string[] = session!.user.unitIds?.length ? session!.user.unitIds : (session!.user.unitId ? [session!.user.unitId] : [])
    if (!units.includes(arquivo.item.link.vaga.unidadeId ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const buffer = await readDocumentoArquivo(arquivo.nomeArmazenado)
  if (!buffer) return NextResponse.json({ error: 'Arquivo não encontrado no armazenamento' }, { status: 404 })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'VIEW_FILE', entity: 'CandidatoDocumento', entityId: arquivo.item.link.candidatoId,
    entityName: arquivo.item.link.candidato.nome,
    details: { arquivoId: arquivo.id, nomeOriginal: arquivo.nomeOriginal },
    ip: extractIp(req.headers),
  })

  const isInline = MIME_INLINE.has(arquivo.tipo)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': arquivo.tipo,
      'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${arquivo.nomeOriginal.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
