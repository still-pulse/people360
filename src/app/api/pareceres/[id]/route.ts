import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'
import { log, extractIp } from '@/lib/audit'

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(value.length === 10 ? `${value}T12:00:00` : value)
}

function clampTrait(n: unknown, fallback = 50): number {
  const v = typeof n === 'number' ? n : parseInt(String(n ?? ''), 10)
  if (Number.isNaN(v)) return fallback
  return Math.min(100, Math.max(0, Math.round(v)))
}

function clampComp(n: unknown, fallback = 3): number {
  const v = typeof n === 'number' ? n : parseInt(String(n ?? ''), 10)
  if (Number.isNaN(v)) return fallback
  return Math.min(5, Math.max(1, Math.round(v)))
}

function normalizeCompetencias(raw: unknown): Record<string, number> {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const keys = [
    'curiosidade', 'lideranca', 'trabalhoEquipe', 'visaoSistemica', 'comunicacao',
    'relacaoInterpessoal', 'negociacao', 'desenvolver', 'focoResultado', 'flexibilidade',
    'criatividade', 'empreendedorismo', 'focoCliente', 'compliance',
  ]
  const out: Record<string, number> = {}
  for (const k of keys) out[k] = clampComp(src[k], 3)
  return out
}

async function getParecer(id: string) {
  return prisma.parecer.findUnique({
    where: { id },
    include: {
      unit: { select: { id: true, name: true, color: true } },
      elaborador: { select: { id: true, name: true } },
      controleCandidato: {
        select: { id: true, nome: true, funcao: true, telefone: true, municipio: true, status: true },
      },
    },
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await getSessionOrUnauthorized()
  if (error) return error

  const parecer = await getParecer(params.id)
  if (!parecer) return NextResponse.json({ error: 'Parecer não encontrado' }, { status: 404 })
  return NextResponse.json(parecer)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const forbidden = forbidIfReadOnly(session!.user.role)
  if (forbidden) return forbidden

  const existing = await prisma.parecer.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Parecer não encontrado' }, { status: 404 })

  const body = await req.json()

  if (!body.controleCandidatoId?.trim()) {
    return NextResponse.json({ error: 'Selecione um candidato do Controle de Candidatos' }, { status: 400 })
  }
  if (!body.dataAvaliacao) {
    return NextResponse.json({ error: 'Data da avaliação é obrigatória' }, { status: 400 })
  }

  const controle = await prisma.controleCandidato.findUnique({
    where: { id: body.controleCandidatoId },
    select: { id: true, nome: true, funcao: true },
  })
  if (!controle) {
    return NextResponse.json({ error: 'Candidato não encontrado no Controle de Candidatos' }, { status: 400 })
  }

  const parecer = await prisma.parecer.update({
    where: { id: params.id },
    data: {
      codigo: body.codigo || existing.codigo,
      revisao: body.revisao || existing.revisao,
      razaoSocial: body.razaoSocial?.trim() || existing.razaoSocial,
      cnpj: body.cnpj?.trim() || existing.cnpj,
      unitId: body.unitId !== undefined ? (body.unitId || null) : existing.unitId,
      controleCandidatoId: controle.id,
      candidatoNome: controle.nome,
      cargo: controle.funcao,
      dataAvaliacao: parseDate(body.dataAvaliacao)!,
      idade: body.idade != null && body.idade !== '' ? parseInt(String(body.idade), 10) : null,
      tipoVinculo: body.tipoVinculo || existing.tipoVinculo,
      apresentacao: Array.isArray(body.apresentacao) ? body.apresentacao : existing.apresentacao,
      verbalizacao: Array.isArray(body.verbalizacao) ? body.verbalizacao : existing.verbalizacao,
      tecnicas: Array.isArray(body.tecnicas) ? body.tecnicas : existing.tecnicas,
      tecnicasOutros: body.tecnicasOutros !== undefined ? (body.tecnicasOutros?.trim() || null) : existing.tecnicasOutros,
      traitEI: body.traitEI !== undefined ? clampTrait(body.traitEI) : existing.traitEI,
      traitNS: body.traitNS !== undefined ? clampTrait(body.traitNS) : existing.traitNS,
      traitTF: body.traitTF !== undefined ? clampTrait(body.traitTF) : existing.traitTF,
      traitJP: body.traitJP !== undefined ? clampTrait(body.traitJP) : existing.traitJP,
      traitAT: body.traitAT !== undefined ? clampTrait(body.traitAT) : existing.traitAT,
      competencias: body.competencias !== undefined
        ? normalizeCompetencias(body.competencias)
        : (existing.competencias as object),
      analiseTexto: body.analiseTexto !== undefined ? (body.analiseTexto?.trim() || null) : existing.analiseTexto,
      resultado: body.resultado !== undefined ? (body.resultado || null) : existing.resultado,
      dataAssinatura: body.dataAssinatura !== undefined
        ? parseDate(body.dataAssinatura)
        : existing.dataAssinatura,
    },
    include: {
      unit: { select: { id: true, name: true, color: true } },
      elaborador: { select: { id: true, name: true } },
      controleCandidato: {
        select: { id: true, nome: true, funcao: true, telefone: true, municipio: true, status: true },
      },
    },
  })

  await log({
    userId: session!.user.id,
    userName: session!.user.name,
    userRole: session!.user.role,
    action: 'UPDATE',
    entity: 'Parecer',
    entityId: parecer.id,
    entityName: parecer.candidatoNome,
    details: { cargo: parecer.cargo, resultado: parecer.resultado },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(parecer)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const forbidden = forbidIfReadOnly(session!.user.role)
  if (forbidden) return forbidden

  const existing = await prisma.parecer.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Parecer não encontrado' }, { status: 404 })

  // Apenas ADMIN ou elaborador pode excluir
  if (session!.user.role !== 'ADMIN' && existing.elaboradorId !== session!.user.id) {
    return NextResponse.json({ error: 'Sem permissão para excluir este parecer' }, { status: 403 })
  }

  await prisma.parecer.delete({ where: { id: params.id } })

  await log({
    userId: session!.user.id,
    userName: session!.user.name,
    userRole: session!.user.role,
    action: 'DELETE',
    entity: 'Parecer',
    entityId: params.id,
    entityName: existing.candidatoNome,
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ ok: true })
}
