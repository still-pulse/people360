import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { log, extractIp } from '@/lib/audit'

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(value.length === 10 ? `${value}T12:00:00` : value)
}

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const analistaId = searchParams.get('analistaId')
  const municipio = searchParams.get('municipio')
  const funcao = searchParams.get('funcao')
  const search = searchParams.get('search')
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

  const where: any = {}
  if (status) where.status = status
  if (analistaId) where.analistas = { some: { id: analistaId } }
  if (municipio) where.municipio = { contains: municipio, mode: 'insensitive' }
  if (funcao) where.funcao = { contains: funcao, mode: 'insensitive' }
  if (search) {
    where.OR = [
      { nome: { contains: search, mode: 'insensitive' } },
      { funcao: { contains: search, mode: 'insensitive' } },
      { municipio: { contains: search, mode: 'insensitive' } },
    ]
  }

  // Analistas só veem candidatos das suas unidades
  if (session!.user.role === 'ANALYST') {
    const analystUnitIds: string[] = (session!.user as any).unitIds?.length
      ? (session!.user as any).unitIds
      : (session!.user.unitId ? [session!.user.unitId] : [])

    if (analystUnitIds.length > 0) {
      const [byUserUnit, byLegacyUnit] = await Promise.all([
        prisma.userUnit.findMany({ where: { unitId: { in: analystUnitIds } }, select: { userId: true } }),
        prisma.user.findMany({ where: { unitId: { in: analystUnitIds } }, select: { id: true } }),
      ])
      const allowedIds = Array.from(new Set([
        ...byUserUnit.map((u) => u.userId),
        ...byLegacyUnit.map((u) => u.id),
      ]))
      where.analistas = { some: { id: { in: allowedIds } } }
    } else {
      where.analistas = { some: { id: session!.user.id } }
    }
  }
  if (year && month) {
    where.dataProcesso = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    }
  } else if (year) {
    where.dataProcesso = {
      gte: new Date(year, 0, 1),
      lt: new Date(year + 1, 0, 1),
    }
  }

  const candidatos = await prisma.controleCandidato.findMany({
    where,
    include: {
      analistas: { select: { id: true, name: true } },
    },
    orderBy: [{ dataProcesso: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(candidatos)
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const body = await req.json()

  if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!body.funcao?.trim()) return NextResponse.json({ error: 'Função é obrigatória' }, { status: 400 })
  if (!body.dataProcesso) return NextResponse.json({ error: 'Data do processo é obrigatória' }, { status: 400 })

  const analistaIds: string[] = session!.user.role === 'ANALYST'
    ? [session!.user.id]
    : Array.isArray(body.analistaIds) ? body.analistaIds : []

  const candidato = await prisma.controleCandidato.create({
    data: {
      nome: body.nome.trim(),
      telefone: body.telefone || null,
      funcao: body.funcao.trim(),
      dataProcesso: parseDate(body.dataProcesso)!,
      analistas: analistaIds.length ? { connect: analistaIds.map((id: string) => ({ id })) } : undefined,
      municipio: body.municipio || null,
      status: body.status ?? 'BANCO_TALENTOS',
      observacoes: body.observacoes || null,
    },
    include: {
      analistas: { select: { id: true, name: true } },
    },
  })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'CREATE', entity: 'ControleCandidato', entityId: candidato.id, entityName: candidato.nome,
    details: { funcao: candidato.funcao, municipio: candidato.municipio, status: candidato.status },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(candidato, { status: 201 })
}
