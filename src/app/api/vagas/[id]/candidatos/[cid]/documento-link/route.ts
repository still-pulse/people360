import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'
import { log } from '@/lib/audit'

const DEFAULT_EXPIRA_EM_DIAS = 15

async function checkAccess(vagaId: string, session: any) {
  const vaga = await prisma.vaga.findUnique({ where: { id: vagaId } })
  if (!vaga) return { vaga: null, forbidden: NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  // Documentos de candidato contêm dados pessoais sensíveis — nunca visível para Jurídico.
  if (session.user.role === 'JURIDICO') {
    return { vaga: null, forbidden: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  if (session.user.role === 'ANALYST') {
    const units: string[] = session.user.unitIds?.length ? session.user.unitIds : (session.user.unitId ? [session.user.unitId] : [])
    if (!units.includes(vaga.unidadeId ?? '')) {
      return { vaga: null, forbidden: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
  }
  return { vaga, forbidden: null }
}

// Retorna o link mais recente do candidato (o único relevante para a tela de gestão)
export async function GET(req: NextRequest, props: { params: Promise<{ id: string; cid: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const { forbidden } = await checkAccess(params.id, session!)
  if (forbidden) return forbidden

  const link = await prisma.documentoLink.findFirst({
    where: { candidatoId: params.cid, vagaId: params.id },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { id: true, name: true } },
      itens: {
        include: {
          tipo: true,
          revisadoPor: { select: { id: true, name: true } },
          arquivos: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { tipo: { ordem: 'asc' } },
      },
    },
  })

  return NextResponse.json(link)
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string; cid: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro
  const { forbidden } = await checkAccess(params.id, session!)
  if (forbidden) return forbidden

  const candidato = await prisma.candidato.findUnique({ where: { id: params.cid } })
  if (!candidato || candidato.vagaId !== params.id) {
    return NextResponse.json({ error: 'Candidato não encontrado' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const expiraEmDias = Number(body.expiraEmDias) > 0 ? Number(body.expiraEmDias) : DEFAULT_EXPIRA_EM_DIAS
  const exigeConselho = !!body.exigeConselho
  const temDependentes = !!body.temDependentes
  const militarAplicavel = !!body.militarAplicavel

  // Garante um único link utilizável por vez — revoga qualquer link ainda ativo
  const linksAtivos = await prisma.documentoLink.findMany({
    where: { candidatoId: params.cid, status: 'ATIVO' },
  })
  for (const antigo of linksAtivos) {
    await prisma.documentoLink.update({ where: { id: antigo.id }, data: { status: 'REVOGADO' } })
    await log({
      userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
      action: 'REVOKE_LINK', entity: 'CandidatoDocumento', entityId: candidato.id, entityName: candidato.nome,
      details: { motivo: 'Substituído por novo link', linkId: antigo.id },
    })
  }

  const tipos = await prisma.documentoTipo.findMany({ where: { ativo: true }, orderBy: { ordem: 'asc' } })
  const tiposAplicaveis = tipos.filter((t) => {
    if (!t.condicional) return true
    if (t.condicionalTipo === 'CONSELHO') return exigeConselho
    if (t.condicionalTipo === 'MILITAR') return militarAplicavel
    if (t.condicionalTipo === 'DEPENDENTE') return temDependentes
    return true
  })

  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + expiraEmDias * 24 * 60 * 60 * 1000)

  const link = await prisma.documentoLink.create({
    data: {
      token,
      candidatoId: params.cid,
      vagaId: params.id,
      createdById: session!.user.id,
      expiresAt,
      exigeConselho,
      temDependentes,
      militarAplicavel,
      itens: {
        create: tiposAplicaveis.map((t) => ({ tipoId: t.id })),
      },
    },
    include: { itens: { include: { tipo: true } } },
  })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'GENERATE_LINK', entity: 'CandidatoDocumento', entityId: candidato.id, entityName: candidato.nome,
    details: { linkId: link.id, expiraEmDias, exigeConselho, temDependentes, militarAplicavel, totalItens: tiposAplicaveis.length },
  })

  return NextResponse.json(link, { status: 201 })
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string; cid: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro
  const { forbidden } = await checkAccess(params.id, session!)
  if (forbidden) return forbidden

  const candidato = await prisma.candidato.findUnique({ where: { id: params.cid } })
  if (!candidato) return NextResponse.json({ error: 'Candidato não encontrado' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const acao = body.acao as 'RENOVAR' | 'REVOGAR'

  const link = await prisma.documentoLink.findFirst({
    where: { candidatoId: params.cid, vagaId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  if (!link) return NextResponse.json({ error: 'Nenhum link encontrado' }, { status: 404 })

  if (acao === 'RENOVAR') {
    const expiraEmDias = Number(body.expiraEmDias) > 0 ? Number(body.expiraEmDias) : DEFAULT_EXPIRA_EM_DIAS
    const updated = await prisma.documentoLink.update({
      where: { id: link.id },
      data: { status: 'ATIVO', expiresAt: new Date(Date.now() + expiraEmDias * 24 * 60 * 60 * 1000) },
    })
    await log({
      userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
      action: 'RENEW_LINK', entity: 'CandidatoDocumento', entityId: candidato.id, entityName: candidato.nome,
      details: { linkId: link.id, expiraEmDias },
    })
    return NextResponse.json(updated)
  }

  if (acao === 'REVOGAR') {
    const updated = await prisma.documentoLink.update({ where: { id: link.id }, data: { status: 'REVOGADO' } })
    await log({
      userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
      action: 'REVOKE_LINK', entity: 'CandidatoDocumento', entityId: candidato.id, entityName: candidato.nome,
      details: { linkId: link.id },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
