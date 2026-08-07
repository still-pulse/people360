import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unitVisibleInIndicators } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== (process.env.CRON_SECRET || 'pcd-weekly-snapshot')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  const friday = new Date(Date.UTC(y, m, d, 12, 0, 0))
  const day = friday.getUTCDay()
  const diff = (day + 2) % 7
  friday.setUTCDate(friday.getUTCDate() - diff)

  const month = friday.getUTCMonth() + 1
  const year = friday.getUTCFullYear()

  const indicatorsRaw = await prisma.pCDIndicator.findMany({
    where: { year, month, unit: { exibirIndicadores: true } },
    include: { unit: true },
  })
  const indicators = indicatorsRaw.filter((i) =>
    unitVisibleInIndicators(i.unit, year, month)
  )

  if (indicators.length === 0) {
    return NextResponse.json({ message: 'Nenhum indicador PCD para snapshot', count: 0 })
  }

  const snapshots = await Promise.all(
    indicators.map((ind) =>
      prisma.pcdWeeklySnapshot.upsert({
        where: { unitId_weekDate: { unitId: ind.unitId, weekDate: friday } },
        update: {
          totalEmployees: ind.totalEmployees,
          metaPercentage: ind.metaPercentage,
          currentPcd: ind.currentPcd,
          year,
          month,
        },
        create: {
          unitId: ind.unitId,
          year,
          month,
          weekDate: friday,
          totalEmployees: ind.totalEmployees,
          metaPercentage: ind.metaPercentage,
          currentPcd: ind.currentPcd,
        },
      })
    )
  )

  return NextResponse.json({ message: 'Snapshots gerados', count: snapshots.length, weekDate: friday.toISOString() })
}
