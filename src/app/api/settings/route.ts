import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await prisma.systemSettings.findMany({ where: { key: { not: 'evolutionApiKeyEncrypted' } } })
  const settings: Record<string, string> = {}
  for (const r of rows) settings[r.key] = r.value
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as Record<string, string>

  await Promise.all(
    Object.entries(body).map(([key, value]) =>
      prisma.systemSettings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  )

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'UPDATE', entity: 'Configuração', entityName: 'Sistema',
    details: { campos: Object.keys(body) },
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ success: true })
}
