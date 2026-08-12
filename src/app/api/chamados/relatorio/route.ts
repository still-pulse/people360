import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate') ?? ''
  const endDate   = searchParams.get('endDate')   ?? ''
  const autorId   = searchParams.get('autorId')   ?? ''
  const unitId    = searchParams.get('unitId')    ?? ''

  const where: any = {
    tipoSolicitacao: { not: null },
    autor: { role: 'ANALYST' },
  }

  if (startDate || endDate) {
    where.dataInicio = {}
    if (startDate) where.dataInicio.gte = new Date(startDate)
    if (endDate)   where.dataInicio.lte = new Date(`${endDate}T23:59:59`)
  }
  if (autorId) where.autorId = autorId
  if (unitId)  where.unitId  = unitId

  const solicitacoes = await prisma.chamado.findMany({
    where,
    select: {
      id: true,
      tipoSolicitacao: true,
      aprovacaoStatus: true,
      dataInicio: true,
      dataFim: true,
      horasSolicitadas: true,
      createdAt: true,
      autor: { select: { id: true, name: true } },
      unit:  { select: { id: true, name: true, color: true } },
    },
    orderBy: { dataInicio: 'desc' },
  })

  return NextResponse.json({ solicitacoes })
}
