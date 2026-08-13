import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'
import { log, extractIp, diff } from '@/lib/audit'
import { devePromoverParaAdmissao } from '@/lib/vagaStatus'

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(value.length === 10 ? `${value}T12:00:00` : value)
}

async function checkAccess(vagaId: string, session: any) {
  const vaga = await prisma.vaga.findUnique({ where: { id: vagaId } })
  if (!vaga) return { vaga: null, forbidden: false }
  if (session.user.role === 'ANALYST') {
    const units: string[] = session.user.unitIds?.length ? session.user.unitIds : (session.user.unitId ? [session.user.unitId] : [])
    if (!units.includes(vaga.unidadeId ?? '')) return { vaga, forbidden: true }
  }
  return { vaga, forbidden: false }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { vaga, forbidden } = await checkAccess(params.id, session!)
  if (!vaga) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const full = await prisma.vaga.findUnique({
    where: { id: params.id },
    include: {
      unit: true,
      analistas: { select: { id: true, name: true } },
      controleCandidato: { select: { id: true, nome: true, telefone: true, funcao: true } },
      candidatos: { orderBy: { createdAt: 'asc' } },
      historico: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
    },
  })

  return NextResponse.json(full)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro

  const { vaga, forbidden } = await checkAccess(params.id, session!)
  if (!vaga) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  try {
    let newStatus = body.status || vaga.status
    const CLOSED = ['CONTRATADA', 'FECHADA', 'CANCELADA']

    // Quando vaga volta a um status não-fechado, limpa candidatos ativos
    if (!CLOSED.includes(newStatus) && CLOSED.includes(vaga.status)) {
      await prisma.candidato.updateMany({
        where: { vagaId: params.id, status: { in: ['APROVADO', 'AGUARDANDO_ADMISSAO', 'ADMITIDO'] } },
        data: { status: 'EM_PROCESSO' },
      })
    }

    // Resolve cargo via cargoId ou texto livre
    let cargoNome: string = body.cargo || vaga.cargo
    let cargoId: string | null = body.cargoId !== undefined ? (body.cargoId || null) : vaga.cargoId
    if (body.cargoId) {
      const pos = await prisma.position.findUnique({ where: { id: body.cargoId } })
      if (!pos) return NextResponse.json({ error: 'Cargo não encontrado.' }, { status: 400 })
      cargoNome = pos.name
    }

    const unidadeId = session!.user.role === 'ANALYST' ? vaga.unidadeId : (body.unidadeId || null)
    const unidadeName = unidadeId
      ? (await prisma.unit.findUnique({ where: { id: unidadeId }, select: { name: true } }))?.name
      : null
    const titulo = body.titulo || (unidadeName ? `${cargoNome} — ${unidadeName}` : cargoNome)

    let newControleCandidatoId: string | null =
      body.controleCandidatoId !== undefined ? (body.controleCandidatoId || null) : vaga.controleCandidatoId ?? null

    const finalAnalistaIds: string[] = session!.user.role === 'ANALYST'
      ? [session!.user.id]
      : (Array.isArray(body.analistaIds) ? body.analistaIds : (body.analistaId ? [body.analistaId] : []))

    let nomeColaborador = body.nomeColaborador !== undefined ? body.nomeColaborador : (vaga.nomeColaborador ?? null)

    const linkingNew = !!(newControleCandidatoId && newControleCandidatoId !== vaga.controleCandidatoId)
    const temCandidatoAprovado = !!(newControleCandidatoId || (typeof nomeColaborador === 'string' && nomeColaborador.trim()))

    // Candidato aprovado / vinculado → vaga sai de "Aberta" e vai para admissão
    if (temCandidatoAprovado && devePromoverParaAdmissao(newStatus)) {
      newStatus = 'ADMISSAO_EM_ANDAMENTO'
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (linkingNew && newControleCandidatoId) {
        const c = await tx.controleCandidato.findUnique({
          where: { id: newControleCandidatoId },
          select: { id: true, nome: true },
        })
        if (!c) {
          // Não bloqueia o save da vaga se o registro do controle sumiu
          newControleCandidatoId = null
        } else {
          nomeColaborador = c.nome
          // 1:1 — libera o candidato se já estiver em outra vaga
          await tx.vaga.updateMany({
            where: { controleCandidatoId: c.id, NOT: { id: params.id } },
            data: { controleCandidatoId: null },
          })
          await tx.controleCandidato.update({
            where: { id: c.id },
            data: {
              status: 'CONTRATADO',
              ...(finalAnalistaIds.length > 0 ? { analistas: { set: finalAnalistaIds.map((id) => ({ id })) } } : {}),
              funcao: cargoNome,
            },
          })
        }
      }

      return tx.vaga.update({
        where: { id: params.id },
        data: {
          titulo,
          status: newStatus,
          unidadeId,
          municipio: body.municipio || null,
          cargo: cargoNome,
          cargoId,
          controleCandidatoId: newControleCandidatoId,
          setor: body.setor || null,
          quantidade: body.quantidade ?? 1,
          tipoVaga: body.tipoVaga,
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
          nomeColaborador: nomeColaborador || null,
          disponibilidadeHorario: body.disponibilidadeHorario || null,
          vagaPcd: body.vagaPcd ?? false,
          gestorRequisitante: body.gestorRequisitante || null,
          setorRequisitante: body.setorRequisitante || null,
          numProcessoAdmissao: body.numProcessoAdmissao || null,
          numProtocoloOnvio: body.numProtocoloOnvio || null,
          requisicaoNextId: (() => {
            if (body.requisicaoNextId === undefined) return undefined as any
            const raw = (body.requisicaoNextId || '').trim()
            if (!raw) return null
            if (/^RP-\d{4}-\d+$/i.test(raw)) return raw.replace(/^rp-/i, 'RP-')
            if (/^\d{4}-\d+$/.test(raw)) return `RP-${raw}`
            return raw
          })(),
          analistas: { set: finalAnalistaIds.map((id) => ({ id })) },
          dataAbertura: parseDate(body.dataAbertura) ?? vaga.dataAbertura,
          dataPrevistaFechamento: parseDate(body.dataPrevistaFechamento),
          dataFechamento: parseDate(body.dataFechamento),
          dataInicioIntegracao: parseDate(body.dataInicioIntegracao),
          observacoes: body.observacoes || null,
        },
        include: {
          unit: true,
          analistas: { select: { id: true, name: true } },
          cargo_rel: { select: { id: true, name: true } },
          controleCandidato: { select: { id: true, nome: true, telefone: true, funcao: true } },
          _count: { select: { candidatos: true } },
        },
      })
    })

    const statusMudou = newStatus !== vaga.status
    await prisma.vagaHistorico.create({
      data: {
        vagaId: params.id,
        userId: session!.user.id,
        fromStatus: statusMudou ? (vaga.status as any) : null,
        toStatus: statusMudou ? (newStatus as any) : null,
        descricao: statusMudou
          ? `Status alterado: ${vaga.status} → ${newStatus}`
          : 'Dados da vaga atualizados',
      },
    })

    await log({
      userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
      action: 'UPDATE', entity: 'Vaga', entityId: params.id, entityName: vaga.titulo,
      details: diff(vaga as any, updated as any),
      ip: extractIp(req.headers),
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const target = String(e.meta?.target ?? '')
      if (target.includes('controleCandidatoId')) {
        return NextResponse.json(
          { error: 'Este candidato já está vinculado a outra vaga. Desvincule-o lá ou escolha outro.' },
          { status: 409 },
        )
      }
      if (target.includes('requisicaoNextId')) {
        return NextResponse.json(
          { error: 'Já existe uma vaga com este ID de requisição (RP).' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: 'Registro duplicado ao salvar a vaga.' }, { status: 409 })
    }
    console.error('[vagas PUT]', e)
    return NextResponse.json({ error: e?.message || 'Erro ao salvar a vaga.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  if (session!.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { vaga, forbidden } = await checkAccess(params.id, session!)
  if (!vaga) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.vaga.delete({ where: { id: params.id } })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'DELETE', entity: 'Vaga', entityId: params.id, entityName: vaga.titulo,
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ success: true })
}
