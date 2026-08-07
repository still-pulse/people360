import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

const documentoLinkInclude = {
  candidato: true,
  vaga: { select: { id: true, cargo: true, unidadeId: true } },
  itens: {
    include: { tipo: true, arquivos: { orderBy: { createdAt: 'desc' as const } } },
    orderBy: { tipo: { ordem: 'asc' as const } },
  },
} satisfies Prisma.DocumentoLinkInclude

export type DocumentoLinkWithItens = Prisma.DocumentoLinkGetPayload<{ include: typeof documentoLinkInclude }>

/**
 * Busca um link público por token, aplicando a expiração automaticamente.
 * Retorna `null` se o token não existir — nunca vaza se é "inexistente" vs "inválido".
 */
export async function getValidDocumentoLink(token: string): Promise<DocumentoLinkWithItens | null> {
  const link = await prisma.documentoLink.findUnique({
    where: { token },
    include: documentoLinkInclude,
  })
  if (!link) return null

  if (link.status === 'ATIVO' && link.expiresAt.getTime() < Date.now()) {
    const expirado = await prisma.documentoLink.update({
      where: { id: link.id },
      data: { status: 'EXPIRADO' },
      include: documentoLinkInclude,
    })
    return expirado
  }

  return link
}
