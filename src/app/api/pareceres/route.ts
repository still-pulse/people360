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

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const resultado = searchParams.get('resultado')
  const unitId = searchParams.get('unitId')

  const where: any = {}
  if (resultado) where.resultado = resultado
  if (unitId) where.unitId = unitId
  if (search) {
    where.OR = [
      { candidatoNome: { contains: search, mode: 'insensitive' } },
      { cargo: { contains: search, mode: 'insensitive' } },
    ]
  }

  // Analistas só veem pareceres das suas unidades ou elaborados por eles
  if (session!.user.role === 'ANALYST') {
    const analystUnitIds: string[] = (session!.user as any).unitIds?.length
      ? (session!.user as any).unitIds
      : (session!.user.unitId ? [session!.user.unitId] : [])

    const accessOr: any[] = [{ elaboradorId: session!.user.id }]
    if (analystUnitIds.length) accessOr.push({ unitId: { in: analystUnitIds } })

    if (search) {
      where.AND = [
        {
          OR: [
            { candidatoNome: { contains: search, mode: 'insensitive' } },
            { cargo: { contains: search, mode: 'insensitive' } },
          ],
        },
        { OR: accessOr },
      ]
      delete where.OR
    } else {
      where.OR = accessOr
    }
  }

  const pareceres = await prisma.parecer.findMany({
    where,
    include: {
      unit: { select: { id: true, name: true, color: true } },
      elaborador: { select: { id: true, name: true } },
      controleCandidato: {
        select: { id: true, nome: true, funcao: true, telefone: true, municipio: true, status: true },
      },
    },
    orderBy: [{ dataAvaliacao: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(pareceres)
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const forbidden = forbidIfReadOnly(session!.user.role)
  if (forbidden) return forbidden

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

  const parecer = await prisma.parecer.create({
    data: {
      codigo: body.codigo || 'FP.RH.09.001-00',
      revisao: body.revisao || '00',
      razaoSocial: body.razaoSocial?.trim() || 'Beneficência Hospitalar de Cesário Lange - BHCL',
      cnpj: body.cnpj?.trim() || '50.351.626/0001-10',
      unitId: body.unitId || null,
      controleCandidatoId: controle.id,
      candidatoNome: controle.nome,
      cargo: controle.funcao,
      dataAvaliacao: parseDate(body.dataAvaliacao)!,
      idade: body.idade != null && body.idade !== '' ? parseInt(String(body.idade), 10) : null,
      tipoVinculo: body.tipoVinculo || 'CLT',
      apresentacao: Array.isArray(body.apresentacao) ? body.apresentacao : [],
      verbalizacao: Array.isArray(body.verbalizacao) ? body.verbalizacao : [],
      tecnicas: Array.isArray(body.tecnicas) ? body.tecnicas : [],
      tecnicasOutros: body.tecnicasOutros?.trim() || null,
      traitEI: clampTrait(body.traitEI),
      traitNS: clampTrait(body.traitNS),
      traitTF: clampTrait(body.traitTF),
      traitJP: clampTrait(body.traitJP),
      traitAT: clampTrait(body.traitAT),
      competencias: normalizeCompetencias(body.competencias),
      analiseTexto: body.analiseTexto?.trim() || null,
      resultado: body.resultado || null,
      dataAssinatura: parseDate(body.dataAssinatura),
      elaboradorId: session!.user.id,
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
    action: 'CREATE',
    entity: 'Parecer',
    entityId: parecer.id,
    entityName: parecer.candidatoNome,
    details: { cargo: parecer.cargo, resultado: parecer.resultado },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(parecer, { status: 201 })
}
