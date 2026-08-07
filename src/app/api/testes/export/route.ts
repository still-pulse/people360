import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import type { TipoTeste } from '@prisma/client'

/** Exporta dados de resultados em JSON (cliente monta Excel). Apenas ADMIN. */
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') as TipoTeste | null
  const where: Record<string, unknown> = { status: 'CONCLUIDO' }
  if (tipo === 'BIG_FIVE' || tipo === 'DISC') where.tipo = tipo

  const list = await prisma.testeConvite.findMany({
    where,
    include: {
      resultado: true,
      createdBy: { select: { name: true } },
      controleCandidato: { select: { nome: true, funcao: true, status: true } },
    },
    orderBy: { concluidoAt: 'desc' },
  })

  const rows = list.map((c) => {
    const base = {
      id: c.id,
      tipo: c.tipo,
      nome: c.nome,
      email: c.email,
      cargo: c.cargo,
      telefone: c.telefone,
      criadoPor: c.createdBy.name,
      concluidoAt: c.concluidoAt,
      perfil: c.resultado?.perfilPredominante ?? '',
      scores: c.resultado?.scores ?? null,
    }

    if (c.tipo === 'BIG_FIVE' && c.resultado?.scores) {
      const s = c.resultado.scores as {
        factors?: Record<string, { pct?: number; raw?: number; max?: number; level?: string }>
      }
      const f = s.factors ?? {}
      return {
        ...base,
        E_pct: f.E?.pct,
        A_pct: f.A?.pct,
        C_pct: f.C?.pct,
        N_pct: f.N?.pct,
        O_pct: f.O?.pct,
        E_level: f.E?.level,
        A_level: f.A?.level,
        C_level: f.C?.level,
        N_level: f.N?.level,
        O_level: f.O?.level,
      }
    }

    if (c.tipo === 'DISC' && c.resultado?.scores) {
      const s = c.resultado.scores as {
        scores?: Record<string, number>
        pcts?: Record<string, number>
        perfil?: string
      }
      return {
        ...base,
        D: s.scores?.D,
        I: s.scores?.I,
        S: s.scores?.S,
        C: s.scores?.C,
        D_pct: s.pcts?.D != null ? Math.round(s.pcts.D * 1000) / 10 : null,
        I_pct: s.pcts?.I != null ? Math.round(s.pcts.I * 1000) / 10 : null,
        S_pct: s.pcts?.S != null ? Math.round(s.pcts.S * 1000) / 10 : null,
        C_pct: s.pcts?.C != null ? Math.round(s.pcts.C * 1000) / 10 : null,
      }
    }

    return base
  })

  return NextResponse.json(rows)
}
