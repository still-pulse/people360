import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'
import { log } from '@/lib/audit'
import { sendEmail, emailTemplate, appUrl } from '@/lib/email'
import type { TipoTeste } from '@prisma/client'

const DEFAULT_EXPIRA_DIAS = 15
const ALLOWED_CREATE = ['ADMIN', 'ANALYST']
const ALLOWED_LIST = ['ADMIN', 'ANALYST']

const conviteInclude = {
  createdBy: { select: { id: true, name: true } },
  controleCandidato: { select: { id: true, nome: true, funcao: true, status: true } },
  resultado: {
    select: {
      id: true,
      scores: true,
      perfilPredominante: true,
      completedAt: true,
    },
  },
} as const

// GET /api/testes — lista convites (ADMIN vê scores; ANALYST vê só status/meta)
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (!ALLOWED_LIST.includes(session!.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') as TipoTeste | null
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.trim()

  const where: Record<string, unknown> = {}
  if (tipo === 'BIG_FIVE' || tipo === 'DISC') where.tipo = tipo
  if (status) where.status = status
  if (search) {
    where.OR = [
      { nome: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { cargo: { contains: search, mode: 'insensitive' } },
    ]
  }

  const list = await prisma.testeConvite.findMany({
    where,
    include: conviteInclude,
    orderBy: { createdAt: 'desc' },
  })

  // ANALYST: não envia scores/answers detalhados
  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json(
      list.map((c) => ({
        ...c,
        resultado: c.resultado
          ? {
              id: c.resultado.id,
              perfilPredominante: null,
              completedAt: c.resultado.completedAt,
              scores: null,
            }
          : null,
      }))
    )
  }

  return NextResponse.json(list)
}

// POST /api/testes — cria convite (+ opcional envio de e-mail)
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro
  if (!ALLOWED_CREATE.includes(session!.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const tipo: TipoTeste | undefined = body.tipo
  if (tipo !== 'BIG_FIVE' && tipo !== 'DISC') {
    return NextResponse.json({ error: 'Tipo de teste inválido (BIG_FIVE ou DISC)' }, { status: 400 })
  }

  let nome = String(body.nome ?? '').trim()
  let email = body.email ? String(body.email).trim() : null
  let cargo = body.cargo ? String(body.cargo).trim() : null
  let telefone = body.telefone ? String(body.telefone).trim() : null
  let controleCandidatoId: string | null = body.controleCandidatoId || null

  if (controleCandidatoId) {
    const cand = await prisma.controleCandidato.findUnique({ where: { id: controleCandidatoId } })
    if (!cand) return NextResponse.json({ error: 'Candidato não encontrado' }, { status: 404 })
    if (!nome) nome = cand.nome
    if (!cargo) cargo = cand.funcao
    if (!telefone && cand.telefone) telefone = cand.telefone
  }

  if (!nome) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  const expiraEmDias = Number(body.expiraEmDias) > 0 ? Number(body.expiraEmDias) : DEFAULT_EXPIRA_DIAS
  const enviarEmail = !!body.enviarEmail
  if (enviarEmail && !email) {
    return NextResponse.json({ error: 'E-mail é obrigatório para envio automático' }, { status: 400 })
  }

  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + expiraEmDias * 24 * 60 * 60 * 1000)

  const convite = await prisma.testeConvite.create({
    data: {
      token,
      tipo,
      nome,
      email,
      cargo,
      telefone,
      controleCandidatoId,
      createdById: session!.user.id,
      expiresAt,
      observacoes: body.observacoes ? String(body.observacoes).trim() : null,
    },
    include: conviteInclude,
  })

  const linkUrl = appUrl(`/teste/${token}`)
  const tipoLabel = tipo === 'BIG_FIVE' ? 'Big Five (OCEAN)' : 'DISC'
  let emailResult: { ok: boolean; error?: string } | null = null

  if (enviarEmail && email) {
    emailResult = await sendEmail({
      to: email,
      subject: `Convite para avaliação ${tipoLabel} — BHCL`,
      html: emailTemplate({
        title: `Avaliação ${tipoLabel}`,
        body: `Olá, ${nome}!\n\nVocê foi convidado(a) a realizar a avaliação ${tipoLabel} da Beneficência Hospitalar de Cesário Lange (BHCL).\n\nO link é pessoal e válido até ${expiresAt.toLocaleDateString('pt-BR')}. Reserve cerca de ${tipo === 'BIG_FIVE' ? '10' : '15'} minutos em um ambiente tranquilo.`,
        ctaLabel: 'Iniciar avaliação',
        ctaUrl: linkUrl,
        footer: 'Não compartilhe este link. Em caso de dúvidas, contate o RH.',
      }),
    })
    if (emailResult.ok) {
      await prisma.testeConvite.update({
        where: { id: convite.id },
        data: { enviadoAt: new Date() },
      })
    }
  }

  await log({
    userId: session!.user.id,
    userName: session!.user.name,
    userRole: session!.user.role,
    action: 'GENERATE_LINK',
    entity: 'TesteConvite',
    entityId: convite.id,
    entityName: nome,
    details: { tipo, expiraEmDias, enviarEmail, emailOk: emailResult?.ok ?? null },
  })

  return NextResponse.json(
    {
      ...convite,
      enviadoAt: emailResult?.ok ? new Date().toISOString() : convite.enviadoAt,
      linkUrl,
      emailEnviado: emailResult?.ok ?? false,
      emailError: emailResult && !emailResult.ok ? emailResult.error : null,
    },
    { status: 201 }
  )
}
