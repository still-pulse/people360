import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyAdmins, notifyUsers } from '@/lib/notify'
import { log, extractIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const TIPO_LABELS: Record<string, string> = {
  HORAS_EXTRAS: 'Horas extras',
  BANCO_HORAS:  'Usar banco de horas',
  FOLGA:        'Folga',
  AUSENCIA:     'Ausência',
}

const PRIORIDADE_PARA_TASK: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'> = {
  BAIXA: 'LOW',
  NORMAL: 'MEDIUM',
  ALTA: 'HIGH',
  URGENTE: 'URGENT',
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Diff em horas (0.5 step). Se saída ≤ entrada, assume virada de dia (plantão). */
function hoursBetween(entrada: string, saida: string): number {
  const [eh, em] = entrada.split(':').map(Number)
  const [sh, sm] = saida.split(':').map(Number)
  let mins = sh * 60 + sm - (eh * 60 + em)
  if (mins <= 0) mins += 24 * 60
  return Math.round((mins / 60) * 2) / 2
}

function getSaoPauloMonthYear(): { mes: number; ano: number } {
  const now = new Date()
  const sp = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  return { mes: sp.getUTCMonth() + 1, ano: sp.getUTCFullYear() }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status          = searchParams.get('status')          ?? ''
  const prioridade      = searchParams.get('prioridade')      ?? ''
  const unitId          = searchParams.get('unitId')          ?? ''
  const tipoSolicitacao = searchParams.get('tipoSolicitacao') ?? ''
  const aprovacaoStatus = searchParams.get('aprovacaoStatus') ?? ''
  const page            = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit           = 20

  const where: any = {}

  if (session.user.role === 'ANALYST') {
    where.OR = [
      { autorId:     session.user.id },
      { atribuidoId: session.user.id },
    ]
  }

  if (status)     where.status     = status
  if (prioridade) where.prioridade = prioridade
  if (unitId && session.user.role === 'ADMIN') where.unitId = unitId

  if (tipoSolicitacao === 'SOLICITACAO') {
    where.tipoSolicitacao = { not: null }
  } else if (tipoSolicitacao) {
    where.tipoSolicitacao = tipoSolicitacao
  }

  if (aprovacaoStatus) where.aprovacaoStatus = aprovacaoStatus

  const [chamados, total] = await Promise.all([
    prisma.chamado.findMany({
      where,
      include: {
        autor:      { select: { id: true, name: true, avatarUrl: true } },
        atribuido:  { select: { id: true, name: true } },
        unit:       { select: { id: true, name: true, color: true } },
        aprovadoPor: { select: { id: true, name: true } },
        _count:     { select: { mensagens: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.chamado.count({ where }),
  ])

  const naoLidasPorChamado = await prisma.chamadoMensagem.groupBy({
    by: ['chamadoId'],
    where: {
      chamadoId: { in: chamados.map((c) => c.id) },
      lida: false,
      autorId: { not: session.user.id },
    },
    _count: { id: true },
  })
  const naoLidasMap = Object.fromEntries(naoLidasPorChamado.map((r) => [r.chamadoId, r._count.id]))

  return NextResponse.json({
    chamados: chamados.map((c) => ({ ...c, naoLidas: naoLidasMap[c.id] ?? 0 })),
    total,
    pages: Math.ceil(total / limit),
    page,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const isSolicitacao = !!body.tipoSolicitacao

  if (!isSolicitacao && !body.titulo?.trim()) {
    return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 })
  }
  if (!body.descricao?.trim()) {
    return NextResponse.json({ error: 'Descrição / motivo é obrigatório.' }, { status: 400 })
  }
  if (isSolicitacao && !body.dataInicio) {
    return NextResponse.json({ error: 'Data de início é obrigatória.' }, { status: 400 })
  }
  if (!TIPO_LABELS[body.tipoSolicitacao] && isSolicitacao) {
    return NextResponse.json({ error: 'Tipo de solicitação inválido.' }, { status: 400 })
  }

  const isTipoHoras =
    body.tipoSolicitacao === 'HORAS_EXTRAS' || body.tipoSolicitacao === 'BANCO_HORAS'

  let horaEntrada: string | null = null
  let horaSaida: string | null = null
  let horasSolicitadas: number | null = body.horasSolicitadas
    ? parseFloat(body.horasSolicitadas)
    : null

  if (isTipoHoras) {
    const he = String(body.horaEntrada || '').trim()
    const hs = String(body.horaSaida || '').trim()
    if (!he || !hs) {
      return NextResponse.json(
        { error: 'Horário de entrada e de saída são obrigatórios para este tipo de solicitação.' },
        { status: 400 },
      )
    }
    if (!TIME_RE.test(he) || !TIME_RE.test(hs)) {
      return NextResponse.json(
        { error: 'Horários inválidos. Use o formato HH:mm (ex.: 08:00, 18:30).' },
        { status: 400 },
      )
    }
    if (he === hs) {
      return NextResponse.json(
        { error: 'Horário de entrada e saída não podem ser iguais.' },
        { status: 400 },
      )
    }
    horaEntrada = he
    horaSaida = hs
    // Se o usuário não informou horas, calcula pelo intervalo (plantão noturno = virada de dia)
    if (horasSolicitadas == null || Number.isNaN(horasSolicitadas) || horasSolicitadas <= 0) {
      horasSolicitadas = hoursBetween(he, hs)
    }
  }

  const unitId = session.user.role === 'ANALYST' ? session.user.unitId : (body.unitId || null)

  const tipoLabel = isSolicitacao ? TIPO_LABELS[body.tipoSolicitacao] : null

  let titulo = body.titulo?.trim()
  if (isSolicitacao && !titulo) {
    const inicio = formatDateBR(body.dataInicio)
    const fim    = body.dataFim ? formatDateBR(body.dataFim) : null
    const periodo = fim ? `${inicio} a ${fim}` : inicio
    const faixa =
      horaEntrada && horaSaida ? ` · ${horaEntrada}–${horaSaida}` : ''
    titulo = `${tipoLabel} — ${periodo}${faixa}`
  }

  const solicitacaoData = isSolicitacao ? {
    tipoSolicitacao: body.tipoSolicitacao,
    aprovacaoStatus: 'PENDENTE' as const,
    dataInicio:      new Date(body.dataInicio),
    dataFim:         body.dataFim ? new Date(body.dataFim) : null,
    horaEntrada,
    horaSaida,
    horasSolicitadas,
  } : {}

  const chamado = await prisma.chamado.create({
    data: {
      titulo,
      descricao:   body.descricao.trim(),
      categoria:   isSolicitacao ? (tipoLabel ?? 'Outros') : (body.categoria ?? 'Outros'),
      prioridade:  body.prioridade ?? 'NORMAL',
      autorId:     session.user.id,
      atribuidoId: session.user.role === 'ADMIN' ? (body.atribuidoId || null) : null,
      unitId,
      ...solicitacaoData,
    },
    include: {
      autor: { select: { id: true, name: true } },
      unit:  { select: { id: true, name: true } },
    },
  })

  await prisma.chamadoMensagem.create({
    data: { chamadoId: chamado.id, autorId: session.user.id, conteudo: body.descricao.trim(), lida: false },
  })

  if (session.user.role === 'ADMIN' && body.atribuidoId && body.criarTarefa) {
    const { mes, ano } = getSaoPauloMonthYear()
    const competencia = await prisma.competencia.upsert({
      where: { mes_ano: { mes, ano } },
      create: { mes, ano },
      update: {},
    })
    const maxPosition = await prisma.task.aggregate({
      where: { status: 'TODO', competenciaId: competencia.id },
      _max: { position: true },
    })
    const tarefa = await prisma.task.create({
      data: {
        title: chamado.titulo,
        description: chamado.descricao,
        status: 'TODO',
        priority: PRIORIDADE_PARA_TASK[chamado.prioridade] ?? 'MEDIUM',
        position: (maxPosition._max.position ?? -1) + 1,
        createdById: session.user.id,
        unitId: chamado.unitId,
        competenciaId: competencia.id,
        chamadoId: chamado.id,
        responsibles: { create: [{ userId: body.atribuidoId }] },
      },
    })

    await notifyUsers([body.atribuidoId], {
      type: 'TASK',
      title: 'Nova tarefa criada',
      body: tarefa.title,
      href: `/tarefas?taskId=${tarefa.id}`,
    }, session.user.id)

    await log({
      userId: session.user.id, userName: session.user.name, userRole: session.user.role,
      action: 'CREATE', entity: 'Tarefa', entityId: tarefa.id, entityName: tarefa.title,
      details: { origem: 'Chamado', chamadoId: chamado.id },
      ip: extractIp(req.headers),
    })
  }

  const notifPayload = {
    type:  'TASK' as const,
    title: isSolicitacao
      ? `Nova solicitação de ${tipoLabel}: ${chamado.autor.name}`
      : `Novo chamado: ${chamado.titulo}`,
    body: `De ${chamado.autor.name}${chamado.unit ? ` — ${chamado.unit.name}` : ''}`,
    href: `/chamados/${chamado.id}`,
  }

  if (session.user.role === 'ANALYST') {
    await notifyAdmins(notifPayload, session.user.id)
  } else if (body.atribuidoId) {
    await notifyUsers([body.atribuidoId], notifPayload, session.user.id)
  }

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'CREATE', entity: 'Chamado', entityId: chamado.id, entityName: chamado.titulo,
    details: {
      categoria: chamado.categoria,
      prioridade: chamado.prioridade,
      tipoSolicitacao: body.tipoSolicitacao || null,
    },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(chamado, { status: 201 })
}
