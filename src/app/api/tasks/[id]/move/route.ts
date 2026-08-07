import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskStatus } from '@prisma/client'
import { getSessionOrUnauthorized, analystCanAccessUnit } from '@/lib/apiHelpers'
import { log, extractIp } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const task = await prisma.task.findUnique({ where: { id: params.id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session!.user.role === 'ANALYST' && !analystCanAccessUnit(session!, task.unitId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { newStatus, newPosition } = body
  const oldStatus = task.status

  await prisma.$transaction([
    prisma.task.update({
      where: { id: params.id },
      data: { status: newStatus as TaskStatus, position: newPosition ?? 0 },
    }),
    ...(oldStatus !== newStatus
      ? [prisma.taskHistory.create({
          data: { taskId: params.id, userId: session!.user.id, fromStatus: oldStatus, toStatus: newStatus as TaskStatus },
        })]
      : []),
  ])

  if (oldStatus !== newStatus) {
    await log({
      userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
      action: 'MOVE', entity: 'Tarefa', entityId: params.id, entityName: task.title,
      details: { de: oldStatus, para: newStatus },
      ip: extractIp(req.headers),
    })
  }

  return NextResponse.json({ success: true })
}
