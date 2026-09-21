import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { avaliacaoSchema, cancelAvaliacao, saveAvaliacao } from '@/lib/dossie/avaliacoes'
import { DossieError } from '@/lib/dossie/documentos'
import { dossieRoute, readJson } from '@/lib/dossie/http'

export async function GET(req: NextRequest, { params }: { params: { id: string; avId: string } }) {
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) => {
    const row = await prisma.colaboradorAvaliacao.findFirst({
      where: { id: params.avId, colaboradorId: colaborador.id },
      select: { id: true, tipo: true, periodoDias: true, periodoInicio: true, periodoFim: true, avaliadorNome: true, respostas: true, modelo: true, parecer: true, decisao: true, observacoes: true, dataAvaliacao: true, status: true, criadoPorNome: true },
    })
    if (!row) return NextResponse.json({ error: 'Avaliação não encontrada.' }, { status: 404 })
    return NextResponse.json(row)
  })
}

/** Salva rascunho ou finaliza (`finalizar: true`). Avaliações finalizadas ficam imutáveis. */
export async function PUT(req: NextRequest, { params }: { params: { id: string; avId: string } }) {
  return dossieRoute(req, 'employee.evaluations.create', params.id, async ({ colaborador, actor, ip }) => {
    const saved = await saveAvaliacao({ colaboradorId: colaborador.id, id: params.avId, input: avaliacaoSchema.parse(await readJson(req)), actor, ip })
    return NextResponse.json({ id: saved.id, status: saved.status })
  })
}

/** Cancelamento com motivo (sem exclusão física). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; avId: string } }) {
  return dossieRoute(req, 'employee.documents.cancel', params.id, async ({ colaborador, actor, ip }) => {
    const body = await readJson(req)
    if (body.action !== 'cancelar') throw new DossieError('Ação inválida.', 400)
    const updated = await cancelAvaliacao({ colaboradorId: colaborador.id, id: params.avId, motivo: String(body.motivo || ''), actor, ip })
    return NextResponse.json({ id: updated.id, status: updated.status })
  })
}
