import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getValidTesteConvite,
  isTesteUsable,
  calculateBigFive,
  validateBigFiveAnswers,
  calculateDisc,
  validateDiscAnswers,
} from '@/lib/testes'
import { Prisma } from '@prisma/client'

// GET — dados públicos do convite (sem scores)
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const convite = await getValidTesteConvite(params.token)
  if (!convite) {
    return NextResponse.json({ error: 'Link inválido ou inexistente' }, { status: 404 })
  }

  return NextResponse.json({
    tipo: convite.tipo,
    status: convite.status,
    nome: convite.nome,
    cargo: convite.cargo,
    expiresAt: convite.expiresAt,
    concluidoAt: convite.concluidoAt,
    podeResponder: isTesteUsable(convite.status),
  })
}

// POST — submete respostas; calcula no servidor; NÃO devolve scores (só admin vê)
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const convite = await getValidTesteConvite(params.token)
  if (!convite) {
    return NextResponse.json({ error: 'Link inválido ou inexistente' }, { status: 404 })
  }
  if (convite.status === 'CONCLUIDO') {
    return NextResponse.json({ error: 'Este teste já foi concluído' }, { status: 409 })
  }
  if (convite.status === 'EXPIRADO' || convite.status === 'REVOGADO') {
    return NextResponse.json({ error: 'Este link não está mais disponível' }, { status: 410 })
  }

  const body = await req.json().catch(() => ({}))
  const answers = body.answers

  let scores: Record<string, unknown>
  let perfilPredominante: string | null = null

  try {
    if (convite.tipo === 'BIG_FIVE') {
      if (!validateBigFiveAnswers(answers)) {
        return NextResponse.json({ error: 'Respostas incompletas ou inválidas (50 itens, 1–5)' }, { status: 400 })
      }
      const result = calculateBigFive(answers)
      scores = {
        factors: result.scores,
        predominante: result.predominante,
      }
      perfilPredominante = result.predominante.label
    } else {
      if (!validateDiscAnswers(answers)) {
        return NextResponse.json(
          { error: 'Respostas incompletas ou inválidas (20 perguntas com ranking 1–4 sem repetição)' },
          { status: 400 }
        )
      }
      const result = calculateDisc(answers)
      scores = {
        scores: result.scores,
        pcts: result.pcts,
        perfil: result.perfil,
        perfilPrincipal: result.perfilPrincipal,
        perfilSecundario: result.perfilSecundario,
        ranking: result.ranking,
      }
      perfilPredominante = result.perfil
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao calcular resultado'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const now = new Date()

  try {
    await prisma.$transaction([
      prisma.testeResultado.create({
        data: {
          conviteId: convite.id,
          scores: scores as Prisma.InputJsonValue,
          answers: answers as Prisma.InputJsonValue,
          perfilPredominante,
          completedAt: now,
        },
      }),
      prisma.testeConvite.update({
        where: { id: convite.id },
        data: {
          status: 'CONCLUIDO',
          concluidoAt: now,
          iniciadoAt: convite.iniciadoAt ?? now,
        },
      }),
    ])
  } catch (e: unknown) {
    // Unique constraint se já concluiu em paralelo
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Este teste já foi concluído' }, { status: 409 })
    }
    throw e
  }

  return NextResponse.json({
    ok: true,
    message: 'Avaliação enviada com sucesso. Obrigado!',
    concluidoAt: now.toISOString(),
  })
}

// PATCH — marca como EM_ANDAMENTO (opcional, ao iniciar o teste)
export async function PATCH(_req: NextRequest, { params }: { params: { token: string } }) {
  const convite = await getValidTesteConvite(params.token)
  if (!convite) {
    return NextResponse.json({ error: 'Link inválido ou inexistente' }, { status: 404 })
  }
  if (!isTesteUsable(convite.status)) {
    return NextResponse.json({ error: 'Link não disponível' }, { status: 410 })
  }

  if (convite.status === 'PENDENTE') {
    await prisma.testeConvite.update({
      where: { id: convite.id },
      data: { status: 'EM_ANDAMENTO', iniciadoAt: new Date() },
    })
  }

  return NextResponse.json({ ok: true })
}
