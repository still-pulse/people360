import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'

function getSaoPauloMonthYear(): { mes: number; ano: number } {
  const now = new Date()
  const sp = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  return { mes: sp.getUTCMonth() + 1, ano: sp.getUTCFullYear() }
}

async function backfillExistingTasks() {
  const orphanTasks = await prisma.task.findMany({ where: { competenciaId: null } })
  if (orphanTasks.length === 0) return

  const grouped = new Map<string, { mes: number; ano: number; taskIds: string[] }>()
  for (const task of orphanTasks) {
    const d = new Date(task.createdAt)
    const mes = d.getMonth() + 1
    const ano = d.getFullYear()
    const key = `${ano}-${mes}`
    if (!grouped.has(key)) grouped.set(key, { mes, ano, taskIds: [] })
    grouped.get(key)!.taskIds.push(task.id)
  }

  for (const { mes, ano, taskIds } of Array.from(grouped.values())) {
    const comp = await prisma.competencia.upsert({
      where: { mes_ano: { mes, ano } },
      create: { mes, ano },
      update: {},
    })
    await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: { competenciaId: comp.id },
    })
  }
}

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  await backfillExistingTasks()

  const { mes, ano } = getSaoPauloMonthYear()

  const current = await prisma.competencia.upsert({
    where: { mes_ano: { mes, ano } },
    create: { mes, ano },
    update: {},
  })

  const competencias = await prisma.competencia.findMany({
    orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
  })

  return NextResponse.json({ competencias, current })
}
