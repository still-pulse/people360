import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'
import { VagaStatus } from '@prisma/client'
import { log, extractIp } from '@/lib/audit'

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro

  const vaga = await prisma.vaga.findUnique({ where: { id: params.id } })
  if (!vaga) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session!.user.role === 'ANALYST') {
    const units: string[] = (session!.user as any).unitIds?.length ? (session!.user as any).unitIds : (session!.user.unitId ? [session!.user.unitId] : [])
    if (!units.includes(vaga.unidadeId ?? '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { newStatus, newPosition } = await req.json()
  const oldStatus = vaga.status
  const isClosed = newStatus === 'FECHADA' || newStatus === 'CANCELADA'

  await prisma.$transaction([
    prisma.vaga.update({
      where: { id: params.id },
      data: {
        status: newStatus as VagaStatus,
        position: newPosition ?? 0,
        ...(isClosed ? { dataFechamento: new Date() } : {}),
      },
    }),
    prisma.vagaHistorico.create({
      data: {
        vagaId: params.id,
        userId: session!.user.id,
        fromStatus: oldStatus,
        toStatus: newStatus as VagaStatus,
        descricao: `Status alterado: ${oldStatus} → ${newStatus}`,
      },
    }),
  ])

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'MOVE', entity: 'Vaga', entityId: params.id, entityName: vaga.titulo,
    details: { de: oldStatus, para: newStatus },
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ success: true })
}
