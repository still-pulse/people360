import { NextRequest, NextResponse } from 'next/server'
import { dossieRoute, readJson } from '@/lib/dossie/http'
import { auditDossie } from '@/lib/dossie/history'
import { getPerfilView, importFromAdmission, perfilSchema, savePerfil } from '@/lib/dossie/perfil'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) =>
    NextResponse.json(await getPerfilView(colaborador.id)))
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.edit', params.id, async ({ colaborador, actor, ip }) => {
    const input = perfilSchema.parse(await readJson(req))
    const current = await getPerfilView(colaborador.id)
    const currentRecord = current as unknown as Record<string, unknown>
    const inputRecord = input as Record<string, unknown>
    const protectedFields = ['funcao', 'centroCusto', 'jornada', 'escala', 'horario', 'localTrabalho', 'salario'] as const
    const changed = protectedFields.filter((key) => {
      const before = currentRecord[key]
      const after = inputRecord[key]
      return before !== '' && before != null && after !== undefined && after !== null && String(before) !== String(after)
    })
    if (changed.length) {
      return NextResponse.json({ error: 'Alterações funcionais devem ser registradas por aditivo contratual.', fields: changed }, { status: 409 })
    }
    const { changes } = await savePerfil(colaborador.id, input, actor)
    // Auditoria sem dados pessoais: registra apenas quais grupos de campos foram enviados.
    await auditDossie({ actor, action: 'UPDATE', entity: 'Perfil', colaboradorId: colaborador.id, ip, details: { campos: Object.keys(input), alteracoesHistorico: changes } })
    return NextResponse.json(await getPerfilView(colaborador.id))
  })
}

/** Preenche o cadastro complementar com dados da admissão digital vinculada (sem sobrescrever o já informado). */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.edit', params.id, async ({ colaborador, actor, ip }) => {
    const result = await importFromAdmission(colaborador, actor)
    await auditDossie({ actor, action: 'UPDATE', entity: 'Perfil', colaboradorId: colaborador.id, ip, details: { acao: 'importar-admissao', vinculada: !!result.admissionId, campos: result.imported.length } })
    return NextResponse.json({ ...result, perfil: await getPerfilView(colaborador.id) })
  })
}
