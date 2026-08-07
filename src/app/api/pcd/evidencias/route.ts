import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const categoria = searchParams.get('categoria')
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined
  const unitId = searchParams.get('unitId') || undefined

  if (!categoria) return NextResponse.json({ error: 'categoria obrigatória' }, { status: 400 })

  const where: Record<string, unknown> = { categoria }
  if (year) where.year = year
  if (month) where.month = month
  if (unitId) where.unitId = unitId

  const evidencias = await prisma.pcdEvidencia.findMany({
    where,
    include: {
      arquivos: { orderBy: { createdAt: 'asc' } },
      unit: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(evidencias)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'JURIDICO') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { categoria, year, month, unitId, descricao, nomePCD, arquivos } = body

  if (!categoria || !year || !month) {
    return NextResponse.json({ error: 'categoria, year e month são obrigatórios' }, { status: 400 })
  }

  const evidencia = await prisma.pcdEvidencia.create({
    data: {
      categoria,
      year: parseInt(year),
      month: parseInt(month),
      unitId: unitId || null,
      descricao: descricao || null,
      nomePCD: nomePCD || null,
      createdById: session.user.id,
      arquivos: arquivos?.length
        ? {
            create: arquivos.map((a: { url: string; nome: string; tamanho: number; tipo: string; tipoDoc?: string }) => ({
              url: a.url,
              nome: a.nome,
              tamanho: a.tamanho,
              tipo: a.tipo,
              tipoDoc: a.tipoDoc || null,
            })),
          }
        : undefined,
    },
    include: {
      arquivos: true,
      unit: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  })

  return NextResponse.json(evidencia, { status: 201 })
}
