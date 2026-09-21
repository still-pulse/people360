import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { avaliacaoSchema, saveAvaliacao } from '@/lib/dossie/avaliacoes'
import { dossieRoute, readJson } from '@/lib/dossie/http'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) => {
    const rows = await prisma.colaboradorAvaliacao.findMany({
      where: { colaboradorId: colaborador.id }, orderBy: [{ dataAvaliacao: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, tipo: true, periodoDias: true, periodoInicio: true, periodoFim: true, avaliadorNome: true, decisao: true, status: true, dataAvaliacao: true, criadoPorNome: true },
    })
    return NextResponse.json({ items: rows })
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return dossieRoute(req, 'employee.evaluations.create', params.id, async ({ colaborador, actor, ip }) => {
    const saved = await saveAvaliacao({ colaboradorId: colaborador.id, input: avaliacaoSchema.parse(await readJson(req)), actor, ip })
    return NextResponse.json({ id: saved.id, status: saved.status }, { status: 201 })
  })
}
