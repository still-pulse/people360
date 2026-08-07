import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskStatus } from '@prisma/client'
import { getSessionOrUnauthorized, analystCanAccessUnit } from '@/lib/apiHelpers'
import { log, extractIp } from '@/lib/audit'

async function checkTaskAccess(taskId: string, session: any) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) return { task: null, forbidden: true }
  if (session.user.role === 'ANALYST' && !analystCanAccessUnit(session, task.unitId)) {
    return { task, forbidden: true }
  }
  return { task, forbidden: false }
}

const taskInclude = {
  responsibles: { include: { user: { select: { id: true, name: true } } } },
  createdBy:    { select: { id: true, name: true } },
  unit: true,
  comments: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  history: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { task, forbidden } = await checkTaskAccess(params.id, session!)
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const unitId = session!.user.role === 'ANALYST' && session!.user.unitId
    ? session!.user.unitId
    : body.unitId || null

  const responsibleIds: string[] = Array.isArray(body.responsibleIds) ? body.responsibleIds : []

  if (responsibleIds.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos um responsável.' }, { status: 400 })
  }

  const newStatus = body.status as TaskStatus | undefined
  const statusChanged = !!newStatus && newStatus !== task.status

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: {
      title:       body.title,
      description: body.description,
      priority:    body.priority,
      status:      newStatus ?? task.status,
      unitId,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      responsibles: {
        deleteMany: {},
        create: responsibleIds.map((uid) => ({ userId: uid })),
      },
    },
    include: taskInclude,
  })

  if (statusChanged) {
    await prisma.taskHistory.create({
      data: { taskId: params.id, userId: session!.user.id, fromStatus: task.status, toStatus: newStatus! },
    })
  }

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'UPDATE', entity: 'Tarefa', entityId: params.id, entityName: task.title,
    details: { responsaveis: responsibleIds, ...(statusChanged ? { status: { de: task.status, para: newStatus } } : {}) },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { task, forbidden } = await checkTaskAccess(params.id, session!)
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (session!.user.role !== 'ADMIN' && task.createdById !== session!.user.id) {
    return NextResponse.json({ error: 'Apenas o criador da tarefa pode excluí-la' }, { status: 403 })
  }

  await prisma.task.delete({ where: { id: params.id } })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'DELETE', entity: 'Tarefa', entityId: params.id, entityName: task.title,
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ success: true })
}
