import { NextRequest } from 'next/server'
import { renderAvaliacao } from '@/lib/dossie/avaliacoes'
import { docFileName } from '@/lib/dossie/documentos'
import { isoDay } from '@/lib/dossie/format'
import { auditDossie } from '@/lib/dossie/history'
import { dossieRoute, pdfResponse } from '@/lib/dossie/http'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string; avId: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.export', params.id, async ({ colaborador, actor, ip }) => {
    const { buffer, row, snapshot } = await renderAvaliacao(colaborador.id, params.avId)
    await auditDossie({ actor, action: 'VIEW_FILE', entity: 'Avaliacao', entityId: row.id, colaboradorId: colaborador.id, ip, details: { tipo: row.tipo } })
    const title = row.tipo === 'AUTOAVALIACAO' ? 'Autoavaliacao de Experiencia' : `Avaliacao de Experiencia ${row.periodoDias ?? ''}`.trim()
    return pdfResponse(buffer, docFileName(title, snapshot.nome, { date: isoDay(row.dataAvaliacao) }), req.nextUrl.searchParams.get('inline') === '1')
  })
}
