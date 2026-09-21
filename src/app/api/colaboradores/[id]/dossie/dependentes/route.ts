import { NextRequest, NextResponse } from 'next/server'
import { createDependente, dependenteSchema, listDependentes } from '@/lib/dossie/dependentes'
import { dossieRoute, readJson } from '@/lib/dossie/http'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) =>
    NextResponse.json({ items: await listDependentes(colaborador.id) }))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return dossieRoute(req, 'employee.dependents.edit', params.id, async ({ colaborador, actor, ip }) => {
    const created = await createDependente({ colaboradorId: colaborador.id, input: dependenteSchema.parse(await readJson(req)), actor, ip })
    return NextResponse.json({ id: created.id }, { status: 201 })
  })
}
