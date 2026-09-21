import { NextRequest, NextResponse } from 'next/server'
import { dependenteSchema, updateDependente } from '@/lib/dossie/dependentes'
import { dossieRoute, readJson } from '@/lib/dossie/http'

/** Atualiza ou "exclui" (informando `exclusaoEm`) um dependente. Não há remoção física. */
export async function PUT(req: NextRequest, { params }: { params: { id: string; depId: string } }) {
  return dossieRoute(req, 'employee.dependents.edit', params.id, async ({ colaborador, actor, ip }) => {
    const updated = await updateDependente({ colaboradorId: colaborador.id, id: params.depId, input: dependenteSchema.parse(await readJson(req)), actor, ip })
    return NextResponse.json({ id: updated.id })
  })
}
