import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { log, extractIp } from '@/lib/audit'

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(value.length === 10 ? `${value}T12:00:00` : value)
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error } = await getSessionOrUnauthorized()
  if (error) return error

  const candidato = await prisma.controleCandidato.findUnique({
    where: { id: params.id },
    include: { analistas: { select: { id: true, name: true } } },
  })

  if (!candidato) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(candidato)
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const body = await req.json()

  const existing = await prisma.controleCandidato.findUnique({
    where: { id: params.id },
    include: { analistas: { select: { id: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const analistaIds: string[] = session!.user.role === 'ANALYST'
    ? [session!.user.id]
    : Array.isArray(body.analistaIds) ? body.analistaIds : existing.analistas.map((a: { id: string }) => a.id)

  const candidato = await prisma.controleCandidato.update({
    where: { id: params.id },
    data: {
      nome: body.nome?.trim() ?? existing.nome,
      telefone: body.telefone !== undefined ? body.telefone || null : existing.telefone,
      funcao: body.funcao?.trim() ?? existing.funcao,
      dataProcesso: body.dataProcesso ? parseDate(body.dataProcesso)! : existing.dataProcesso,
      analistas: { set: analistaIds.map((id: string) => ({ id })) },
      municipio: body.municipio !== undefined ? body.municipio || null : existing.municipio,
      status: body.status ?? existing.status,
      observacoes: body.observacoes !== undefined ? body.observacoes || null : existing.observacoes,
    },
    include: { analistas: { select: { id: true, name: true } } },
  })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'UPDATE', entity: 'ControleCandidato', entityId: candidato.id, entityName: candidato.nome,
    details: { status: candidato.status },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(candidato)
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const existing = await prisma.controleCandidato.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.controleCandidato.delete({ where: { id: params.id } })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'DELETE', entity: 'ControleCandidato', entityId: existing.id, entityName: existing.nome,
    details: null, ip: extractIp(req.headers),
  })

  return NextResponse.json({ ok: true })
}
