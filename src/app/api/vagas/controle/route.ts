import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, enforceUnitFilter } from '@/lib/apiHelpers'

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const year   = searchParams.get('year')  ? parseInt(searchParams.get('year')!)  : null
  const month  = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

  const where: any = {}

  // Vaga usa 'unidadeId', não 'unitId'
  enforceUnitFilter(where, session!, searchParams.get('unitId'), 'unidadeId')

  if (session!.user.role === 'ANALYST' && (session!.user.unitIds ?? []).length === 0 && !session!.user.unitId) {
    return NextResponse.json([])
  }

  const CLOSED_STATUSES = ['CONTRATADA', 'FECHADA', 'CANCELADA']

  if (year && month) {
    const start = new Date(year, month - 1, 1)
    const end   = new Date(year, month, 1)
    // Inclui também vagas de períodos anteriores que ainda não foram fechadas (atrasadas)
    where.OR = [
      { dataAbertura: { gte: start, lt: end } },
      { dataAbertura: { lt: start }, status: { notIn: CLOSED_STATUSES } },
    ]
  } else if (year) {
    const start = new Date(year, 0, 1)
    const end   = new Date(year + 1, 0, 1)
    where.OR = [
      { dataAbertura: { gte: start, lt: end } },
      { dataAbertura: { lt: start }, status: { notIn: CLOSED_STATUSES } },
    ]
  }

  const vagas = await prisma.vaga.findMany({
    where,
    include: {
      unit:     true,
      analistas: { select: { id: true, name: true } },
      candidatos: {
        where: { status: { in: ['APROVADO', 'AGUARDANDO_ADMISSAO', 'ADMITIDO'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  return NextResponse.json(vagas)
}
