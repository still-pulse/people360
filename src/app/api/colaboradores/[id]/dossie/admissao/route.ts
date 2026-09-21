import { NextRequest, NextResponse } from 'next/server'
import { admissionImportStatus, importAdmissionIntoDossie } from '@/lib/dossie/admissaoImport'
import { dossieRoute } from '@/lib/dossie/http'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) =>
    NextResponse.json(await admissionImportStatus(colaborador)))
}

/** Importa para o dossiê os dados, documentos validados e contratos assinados da admissão digital vinculada. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.edit', params.id, async ({ colaborador, actor, ip }) =>
    NextResponse.json(await importAdmissionIntoDossie(colaborador, actor, ip)))
}
