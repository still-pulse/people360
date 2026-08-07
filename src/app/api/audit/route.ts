import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, analystCanAccessUnit } from '@/lib/apiHelpers'

// Histórico de auditoria de um registro específico (ex: Vaga, Tarefa, Usuário)
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const entity   = searchParams.get('entity')
  const entityId = searchParams.get('entityId')
  if (!entity || !entityId) {
    return NextResponse.json({ error: 'entity e entityId são obrigatórios' }, { status: 400 })
  }

  if (entity === 'Usuário' && session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (entity === 'Vaga' && session!.user.role === 'ANALYST') {
    const vaga = await prisma.vaga.findUnique({ where: { id: entityId }, select: { unidadeId: true } })
    if (!vaga || !analystCanAccessUnit(session!, vaga.unidadeId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  if (entity === 'Tarefa' && session!.user.role === 'ANALYST') {
    const task = await prisma.task.findUnique({ where: { id: entityId }, select: { unitId: true } })
    if (!task || !analystCanAccessUnit(session!, task.unitId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const logs = await prisma.auditLog.findMany({
    where: { entity, entityId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(logs)
}
