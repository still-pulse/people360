import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dossieRoute } from '@/lib/dossie/http'
import { loadTimeline, TIMELINE_GROUPS } from '@/lib/dossie/timeline'

/** Linha do tempo funcional paginada. `grupo`: todos | salario | cargo | jornada | unidade. */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) => {
    const q = req.nextUrl.searchParams
    const grupo = q.get('grupo') ?? 'todos'
    if (!(grupo in TIMELINE_GROUPS)) return NextResponse.json({ error: 'Grupo inválido.' }, { status: 400 })
    const take = Math.min(Math.max(Number(q.get('take')) || 30, 1), 100)
    const skip = Math.max(Number(q.get('skip')) || 0, 0)
    const result = await loadTimeline(colaborador.id, { grupo, take, skip, admissao: colaborador.dateOfJoining })
    // Títulos dos documentos relacionados (uma consulta, apenas dos ids da página).
    const ids = Array.from(new Set(result.items.map((i) => i.documentoId).filter((v): v is string => !!v)))
    const docs = ids.length ? await prisma.colaboradorDocumento.findMany({ where: { id: { in: ids } }, select: { id: true, titulo: true } }) : []
    const titles = new Map(docs.map((d) => [d.id, d.titulo]))
    return NextResponse.json({ total: result.total, items: result.items.map((i) => ({ ...i, documentoTitulo: i.documentoId ? titles.get(i.documentoId) ?? null : null })) })
  })
}
