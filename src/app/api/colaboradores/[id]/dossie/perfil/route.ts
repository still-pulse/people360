import { NextRequest, NextResponse } from 'next/server'
import { dossieRoute, readJson } from '@/lib/dossie/http'
import { auditDossie } from '@/lib/dossie/history'
import { getPerfilView, importFromAdmission, perfilSchema, savePerfil } from '@/lib/dossie/perfil'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) =>
    NextResponse.json(await getPerfilView(colaborador.id)))
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return dossieRoute(req, 'employee.documents.edit', params.id, async ({ colaborador, actor, ip }) => {
    const input = perfilSchema.parse(await readJson(req))
    const { changes } = await savePerfil(colaborador.id, input, actor)
    // Auditoria sem dados pessoais: registra apenas quais grupos de campos foram enviados.
    await auditDossie({ actor, action: 'UPDATE', entity: 'Perfil', colaboradorId: colaborador.id, ip, details: { campos: Object.keys(input), alteracoesHistorico: changes } })
    return NextResponse.json(await getPerfilView(colaborador.id))
  })
}

/** Preenche o cadastro complementar com dados da admissão digital vinculada (sem sobrescrever o já informado). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return dossieRoute(req, 'employee.documents.edit', params.id, async ({ colaborador, actor, ip }) => {
    const result = await importFromAdmission(colaborador, actor)
    await auditDossie({ actor, action: 'UPDATE', entity: 'Perfil', colaboradorId: colaborador.id, ip, details: { acao: 'importar-admissao', vinculada: !!result.admissionId, campos: result.imported.length } })
    return NextResponse.json({ ...result, perfil: await getPerfilView(colaborador.id) })
  })
}
