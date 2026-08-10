import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, enforceUnitFilter, forbidIfReadOnly } from '@/lib/apiHelpers'
import { VagaStatus } from '@prisma/client'
import { notifyAdmins, notifyUsers } from '@/lib/notify'
import { log, extractIp } from '@/lib/audit'

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(value.length === 10 ? `${value}T12:00:00` : value)
}

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') as VagaStatus | null
  const analistaId = searchParams.get('analistaId')
  const municipio = searchParams.get('municipio')
  const cargo = searchParams.get('cargo')
  const search = searchParams.get('search')

  const where: any = {}
  if (status) where.status = status
  if (analistaId) where.analistas = { some: { id: analistaId } }
  if (municipio) where.municipio = { contains: municipio, mode: 'insensitive' }
  if (cargo) where.cargo = { contains: cargo, mode: 'insensitive' }
  if (search) {
    where.OR = [
      { cargo: { contains: search, mode: 'insensitive' } },
      { titulo: { contains: search, mode: 'insensitive' } },
    ]
  }

  // Vaga usa 'unidadeId', não 'unitId'
  enforceUnitFilter(where, session!, searchParams.get('unitId'), 'unidadeId')

  if (session!.user.role === 'ANALYST' && (session!.user.unitIds ?? []).length === 0) {
    return NextResponse.json([])
  }

  const vagas = await prisma.vaga.findMany({
    where,
    include: {
      unit: true,
      analistas: { select: { id: true, name: true } },
      cargo_rel: { select: { id: true, name: true } },
      controleCandidato: { select: { id: true, nome: true, telefone: true, funcao: true } },
      _count: { select: { candidatos: true } },
    },
    orderBy: [{ status: 'asc' }, { position: 'asc' }, { dataAbertura: 'desc' }],
  })

  return NextResponse.json(vagas)
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro

  const body = await req.json()

  const analystUnits = session!.user.unitIds ?? (session!.user.unitId ? [session!.user.unitId] : [])
  const unidadeId = session!.user.role === 'ANALYST' && analystUnits.length > 0
    ? (analystUnits.includes(body.unidadeId) ? body.unidadeId : analystUnits[0])
    : body.unidadeId || null

  const analistaIds: string[] = session!.user.role === 'ANALYST'
    ? [session!.user.id]
    : (Array.isArray(body.analistaIds) ? body.analistaIds : (body.analistaId ? [body.analistaId] : []))

  // Analistas criam vagas como pendentes; admins/gerentes usam o status enviado (default: ABERTA)
  const ALLOWED_STATUSES = ['ABERTA','DIVULGACAO','TRIAGEM','ENTREVISTAS','ENCAMINHADA_GESTOR','APROVADA_CONTRATACAO','ADMISSAO_EM_ANDAMENTO','CONTRATADA','CANCELADA']
  const initialStatus = session!.user.role === 'ANALYST'
    ? 'PENDENTE_APROVACAO'
    : (body.status && ALLOWED_STATUSES.includes(body.status) ? body.status : 'ABERTA')

  // Resolve cargo: preferencialmente via cargoId (FK), fallback texto livre
  let cargoNome: string = body.cargo || ''
  let cargoId: string | null = body.cargoId || null
  if (cargoId) {
    const pos = await prisma.position.findUnique({ where: { id: cargoId } })
    if (!pos) return NextResponse.json({ error: 'Cargo não encontrado.' }, { status: 400 })
    cargoNome = pos.name
  }
  if (!cargoNome) return NextResponse.json({ error: 'Cargo é obrigatório.' }, { status: 400 })

  const maxPos = await prisma.vaga.aggregate({
    where: { status: 'ABERTA' },
    _max: { position: true },
  })

  const unidadeName = unidadeId
    ? (await prisma.unit.findUnique({ where: { id: unidadeId }, select: { name: true } }))?.name
    : null
  const titulo = body.titulo || (unidadeName ? `${cargoNome} — ${unidadeName}` : cargoNome)

  const vaga = await prisma.vaga.create({
    data: {
      titulo,
      unidadeId,
      municipio: body.municipio || null,
      cargo: cargoNome,
      cargoId,
      setor: body.setor || null,
      quantidade: body.quantidade ?? 1,
      tipoVaga: body.tipoVaga ?? 'EFETIVO',
      periodoTrabalho: body.periodoTrabalho || null,
      cargaHoraria: body.cargaHoraria || null,
      horarioTrabalho: body.horarioTrabalho || null,
      escala: body.escala || null,
      plantaoColaboradorSaiu: body.plantaoColaboradorSaiu || null,
      salarioMin: body.salarioMin ? parseFloat(body.salarioMin) : null,
      salarioMax: body.salarioMax ? parseFloat(body.salarioMax) : null,
      tipoRequisicao: body.tipoRequisicao || null,
      tipoContrato: body.tipoContrato || null,
      tipoRecrutamento: body.tipoRecrutamento || null,
      nomeColaboradorSaiu: body.nomeColaboradorSaiu || null,
      nomeColaborador: body.nomeColaborador || null,
      disponibilidadeHorario: body.disponibilidadeHorario || null,
      vagaPcd: body.vagaPcd ?? false,
      gestorRequisitante: body.gestorRequisitante || null,
      setorRequisitante: body.setorRequisitante || null,
      numProcessoAdmissao: body.numProcessoAdmissao || null,
      numProtocoloOnvio: body.numProtocoloOnvio || null,
      requisicaoNextId: (() => {
        const raw = (body.requisicaoNextId || '').trim()
        if (!raw) return null
        if (/^RP-\d{4}-\d+$/i.test(raw)) return raw.replace(/^rp-/i, 'RP-')
        if (/^\d{4}-\d+$/.test(raw)) return `RP-${raw}`
        return raw
      })(),
      ...(analistaIds.length > 0 ? { analistas: { connect: analistaIds.map((id) => ({ id })) } } : {}),
      dataAbertura: parseDate(body.dataAbertura) ?? new Date(),
      dataPrevistaFechamento: parseDate(body.dataPrevistaFechamento),
      dataInicioIntegracao: parseDate(body.dataInicioIntegracao),
      observacoes: body.observacoes || null,
      position: (maxPos._max.position ?? -1) + 1,
      status: initialStatus as any,
    },
    include: {
      unit: true,
      analistas: { select: { id: true, name: true } },
      cargo_rel: { select: { id: true, name: true } },
      _count: { select: { candidatos: true } },
    },
  })

  await prisma.vagaHistorico.create({
    data: {
      vagaId: vaga.id, userId: session!.user.id,
      toStatus: initialStatus as any,
      descricao: initialStatus === 'PENDENTE_APROVACAO' ? 'Vaga enviada para aprovação' : 'Vaga aberta',
    },
  })

  const isPendente = initialStatus === 'PENDENTE_APROVACAO'
  const notifPayload = {
    type: 'VAGA' as const,
    title: isPendente ? 'Nova vaga pendente de aprovação' : 'Nova vaga em aberto',
    body: `${cargoNome}${vaga.unit ? ` — ${vaga.unit.name}` : ''}`,
    href: `/vagas/${vaga.id}`,
  }
  await notifyAdmins(notifPayload, session!.user.id)
  if (!isPendente && analistaIds.length > 0) await notifyUsers(analistaIds, notifPayload, session!.user.id)

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'CREATE', entity: 'Vaga', entityId: vaga.id, entityName: vaga.titulo,
    details: { cargo: vaga.cargo, unidade: vaga.unit?.name ?? null, quantidade: vaga.quantidade },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(vaga, { status: 201 })
}
