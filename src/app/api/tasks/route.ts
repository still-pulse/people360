import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, enforceUnitFilter } from '@/lib/apiHelpers'
import { notifyUsers, notifyUnit } from '@/lib/notify'
import { log, extractIp } from '@/lib/audit'

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
    take: 10,
  },
}

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const priority      = searchParams.get('priority')
  const competenciaId = searchParams.get('competenciaId')
  const where: any    = {}

  if (session!.user.role === 'ANALYST') {
    const unitIds: string[] = (session!.user as any).unitIds?.length
      ? (session!.user as any).unitIds
      : (session!.user.unitId ? [session!.user.unitId] : [])
    if (unitIds.length === 0) return NextResponse.json([])

    const requestedUnit  = searchParams.get('unitId')
    const effectiveUnits = requestedUnit && unitIds.includes(requestedUnit) ? [requestedUnit] : unitIds

    where.AND = [
      { unitId: effectiveUnits.length === 1 ? effectiveUnits[0] : { in: effectiveUnits } },
      {
        OR: [
          { responsibles: { some: { userId: session!.user.id } } },
          { responsibles: { none: {} } },
        ],
      },
    ]
    if (competenciaId) where.AND.push({ competenciaId })
  } else {
    if (priority) where.priority = priority
    enforceUnitFilter(where, session!, searchParams.get('unitId'))
    if (competenciaId) where.competenciaId = competenciaId
  }

  const tasks = await prisma.task.findMany({
    where,
    include: taskInclude,
    orderBy: [{ status: 'asc' }, { position: 'asc' }],
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const body = await req.json()

  const analystUnits: string[] = (session!.user as any).unitIds?.length
    ? (session!.user as any).unitIds
    : (session!.user.unitId ? [session!.user.unitId] : [])
  const unitId = session!.user.role === 'ANALYST'
    ? (analystUnits.includes(body.unitId) ? body.unitId : (analystUnits[0] ?? null))
    : body.unitId || null

  const responsibleIds: string[] = Array.isArray(body.responsibleIds) ? body.responsibleIds : []

  if (responsibleIds.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos um responsável.' }, { status: 400 })
  }

  const status        = body.status ?? 'BACKLOG'
  const competenciaId = body.competenciaId || null

  const maxPosition = await prisma.task.aggregate({
    where: { status, competenciaId },
    _max: { position: true },
  })

  const task = await prisma.task.create({
    data: {
      title:        body.title,
      description:  body.description,
      status,
      priority:     body.priority ?? 'MEDIUM',
      position:     (maxPosition._max.position ?? -1) + 1,
      createdById:  session!.user.id,
      unitId,
      dueDate:      body.dueDate ? new Date(body.dueDate) : null,
      competenciaId,
      responsibles: {
        create: responsibleIds.map((uid) => ({ userId: uid })),
      },
    },
    include: taskInclude,
  })

  if (status === 'DONE') {
    await prisma.taskHistory.create({
      data: { taskId: task.id, userId: session!.user.id, fromStatus: 'BACKLOG', toStatus: 'DONE' },
    })
  }

  const payload = {
    type:  'TASK' as const,
    title: 'Nova tarefa criada',
    body:  task.title,
    href:  `/tarefas?taskId=${task.id}`,
  }
  if (responsibleIds.length > 0) {
    await notifyUsers(responsibleIds, payload, session!.user.id)
  } else {
    await notifyUnit(task.unitId, payload, session!.user.id)
  }

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'CREATE', entity: 'Tarefa', entityId: task.id, entityName: task.title,
    details: {
      status:      task.status,
      priority:    task.priority,
      responsaveis: task.responsibles.map((r) => r.user.name),
    },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(task, { status: 201 })
}
