import { prisma } from '@/lib/prisma'
import type { TesteConvite, TesteConviteStatus } from '@prisma/client'

export { calculateBigFive, validateBigFiveAnswers, BIG_FIVE_ITEMS, BIG_FIVE_LABELS, BIG_FIVE_COLORS, BIG_FIVE_INTERP } from './bigfive'
export type { BigFiveScores, BigFiveFactor, BigFiveFactorScore } from './bigfive'

export { calculateDisc, validateDiscAnswers, DISC_QUESTIONS, DISC_LABELS, DISC_COLORS, DISC_LAUDOS, DISC_TRAITS } from './disc'
export type { DiscScores } from './disc'

/**
 * Aplica expiração automática se o link ainda está PENDENTE/EM_ANDAMENTO e já passou expiresAt.
 */
export async function getValidTesteConvite(token: string) {
  const convite = await prisma.testeConvite.findUnique({
    where: { token },
    include: {
      resultado: true,
      createdBy: { select: { id: true, name: true } },
      controleCandidato: { select: { id: true, nome: true, funcao: true } },
    },
  })
  if (!convite) return null

  if (
    (convite.status === 'PENDENTE' || convite.status === 'EM_ANDAMENTO') &&
    convite.expiresAt.getTime() < Date.now()
  ) {
    return prisma.testeConvite.update({
      where: { id: convite.id },
      data: { status: 'EXPIRADO' },
      include: {
        resultado: true,
        createdBy: { select: { id: true, name: true } },
        controleCandidato: { select: { id: true, nome: true, funcao: true } },
      },
    })
  }

  return convite
}

export function isTesteUsable(status: TesteConviteStatus): boolean {
  return status === 'PENDENTE' || status === 'EM_ANDAMENTO'
}

export type TesteConvitePublic = Pick<
  TesteConvite,
  'tipo' | 'status' | 'nome' | 'cargo' | 'expiresAt' | 'concluidoAt'
>
