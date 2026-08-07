import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (session!.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate   = searchParams.get('endDate')

  if (!startDate || !endDate) return NextResponse.json({ error: 'startDate e endDate obrigatórios' }, { status: 400 })

  const start = new Date(startDate)
  const end   = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  const taskWithRelations = {
    responsibles: { include: { user: { select: { id: true, name: true, role: true } } } },
    unit:         { select: { id: true, name: true, color: true } },
  }

  // Tarefas com responsável Gerente são excluídas do relatório de desempenho
  const hasGerente = (task: any) =>
    (task.responsibles as { user: { role: string } }[]).some((r) => r.user.role === 'GERENTE')

  // Tarefas concluídas: busca pelo TaskHistory (quando foi movida para DONE no período)
  const histories = await prisma.taskHistory.findMany({
    where: {
      toStatus: 'DONE',
      createdAt: { gte: start, lte: end },
    },
    include: { task: { include: taskWithRelations } },
    orderBy: { createdAt: 'asc' },
  })

  // Deduplica por taskId (mantém a primeira conclusão no período)
  // Ignora tarefas que foram movidas para DONE no período, mas depois retornaram para outro status
  const seenTasks = new Set<string>()
  const completions: { task: any; completedAt: Date }[] = []
  for (const h of histories) {
    if (seenTasks.has(h.taskId)) continue
    if (h.task.status !== 'DONE') continue
    if (hasGerente(h.task)) continue
    seenTasks.add(h.taskId)
    completions.push({ task: h.task, completedAt: h.createdAt })
  }

  // Fallback: tarefas já criadas/editadas diretamente como "Concluído", sem registro de histórico
  const doneWithoutHistory = await prisma.task.findMany({
    where: {
      status: 'DONE',
      updatedAt: { gte: start, lte: end },
      id: { notIn: Array.from(seenTasks) },
      history: { none: { toStatus: 'DONE' } },
    },
    include: taskWithRelations,
  })
  for (const task of doneWithoutHistory) {
    if (hasGerente(task)) continue
    completions.push({ task, completedAt: task.updatedAt })
  }

  // Agrupa por responsável
  const tasksByUser = new Map<string, { user: { id: string; name: string }; tasks: any[] }>()

  for (const c of completions) {
    const responsibles = (c.task as any).responsibles as { userId: string; user: { id: string; name: string } }[]
    const targets = responsibles.length > 0
      ? responsibles.map((r) => ({ id: r.userId, name: r.user.name }))
      : [{ id: '__sem_responsavel__', name: 'Sem responsável' }]

    for (const resp of targets) {
      if (!tasksByUser.has(resp.id)) tasksByUser.set(resp.id, { user: { id: resp.id, name: resp.name }, tasks: [] })
      tasksByUser.get(resp.id)!.tasks.push({
        id:          c.task.id,
        title:       c.task.title,
        priority:    c.task.priority,
        dueDate:     c.task.dueDate,
        completedAt: c.completedAt,
        unit:        c.task.unit,
      })
    }
  }

  const tasks = Array.from(tasksByUser.values()).sort((a, b) =>
    b.tasks.length - a.tasks.length
  )

  // Chamados resolvidos/fechados no período
  const chamados = await prisma.chamado.findMany({
    where: {
      status: { in: ['RESOLVIDO', 'FECHADO'] },
      updatedAt: { gte: start, lte: end },
    },
    include: {
      autor:     { select: { id: true, name: true } },
      atribuido: { select: { id: true, name: true } },
      unit:      { select: { id: true, name: true, color: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Tarefas atrasadas em aberto (estado atual, independente do período)
  const now = new Date()
  const overdueTasks = await prisma.task.findMany({
    where: {
      status: { not: 'DONE' },
      dueDate: { lt: now },
    },
    include: { unit: { select: { id: true, name: true, color: true } } },
  })

  const overdueByUnitMap = new Map<string, { name: string; color: string; count: number }>()
  for (const t of overdueTasks) {
    const key   = t.unit?.id ?? '__sem_unidade__'
    const name  = t.unit?.name ?? 'Sem unidade'
    const color = t.unit?.color ?? '#94A3B8'
    if (!overdueByUnitMap.has(key)) overdueByUnitMap.set(key, { name, color, count: 0 })
    overdueByUnitMap.get(key)!.count++
  }
  const overdueByUnit = Array.from(overdueByUnitMap.values())
    .sort((a, b) => b.count - a.count)

  // Total de analistas ativos no sistema (independente do período)
  const activeAnalysts = await prisma.user.count({ where: { role: 'ANALYST', active: true } })

  return NextResponse.json({ tasks, chamados, overdueByUnit, activeAnalysts })
}
