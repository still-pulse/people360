import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const isAdmin = ['ADMIN', 'SUPERINTENDENT', 'GERENTE'].includes(session!.user.role)
  const isAnalista = session!.user.role === 'ANALYST'

  const where: any = { status: 'PENDENTE_APROVACAO' }

  // Analista vê só as próprias; admin vê todas
  if (isAnalista) {
    where.analistas = { some: { id: session!.user.id } }
  } else if (!isAdmin) {
    return NextResponse.json([])
  }

  const vagas = await (prisma as any).vaga.findMany({
    where,
    include: {
      unit: true,
      analistas: { select: { id: true, name: true } },
      aprovacaoComentarios: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { candidatos: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(vagas)
}
