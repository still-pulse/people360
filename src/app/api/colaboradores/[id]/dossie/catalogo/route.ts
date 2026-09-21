import { NextRequest, NextResponse } from 'next/server'
import { dossieRoute } from '@/lib/dossie/http'
import { catalogFor, CATEGORIAS_ANEXO } from '@/lib/dossie/documentos'
import { getModelos, suggestPeriod } from '@/lib/dossie/avaliacoes'
import { AMENDMENT_FIELDS, buildSnapshot } from '@/lib/dossie/snapshot'
import { PARENTESCOS } from '@/lib/dossie/dependentes'

/** Tipos de documento, valores atuais para o aditivo e modelos de avaliação (tudo derivado do backend). */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) => {
    const [catalogo, modelos, snapshot] = await Promise.all([catalogFor(colaborador.id), getModelos(), buildSnapshot(colaborador.id)])
    if (!catalogo || !snapshot) return NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 })
    const atual: Record<string, string> = {}
    for (const [tipo, meta] of Object.entries(AMENDMENT_FIELDS)) {
      const value = meta.field ? snapshot[meta.field] : null
      atual[tipo] = value == null ? '' : String(value)
    }
    return NextResponse.json({
      ...catalogo,
      aditivo: { tipos: Object.entries(AMENDMENT_FIELDS).map(([value, meta]) => ({ value, label: meta.label, livre: !meta.field })), atual },
      avaliacao: { ...modelos, sugestoes: { 45: suggestPeriod(snapshot.admissao, 45), 90: suggestPeriod(snapshot.admissao, 90) } },
      categoriasAnexo: CATEGORIAS_ANEXO,
      parentescos: PARENTESCOS,
    })
  })
}
