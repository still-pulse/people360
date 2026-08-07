import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const vaga = await prisma.vaga.findUnique({ where: { id: params.id } })
  if (!vaga) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session!.user.role === 'ANALYST') {
    const units: string[] = (session!.user as any).unitIds?.length ? (session!.user as any).unitIds : (session!.user.unitId ? [session!.user.unitId] : [])
    if (!units.includes(vaga.unidadeId ?? '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const candidatos = await prisma.candidato.findMany({
    where: { vagaId: params.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(candidatos)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const body = await req.json()
  const candidato = await prisma.candidato.create({
    data: {
      vagaId: params.id,
      nome: body.nome,
      telefone: body.telefone || null,
      email: body.email || null,
      dataAprovacao: body.dataAprovacao ? new Date(body.dataAprovacao) : null,
      status: body.status ?? 'EM_PROCESSO',
      observacoes: body.observacoes || null,
      cvFileName: body.cvFileName || null,
      cvOriginalName: body.cvOriginalName || null,
    },
  })

  await prisma.vagaHistorico.create({
    data: { vagaId: params.id, userId: session!.user.id, descricao: `Candidato adicionado: ${body.nome}` },
  })

  return NextResponse.json(candidato, { status: 201 })
}
