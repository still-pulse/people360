import { NextRequest } from 'next/server'
import { buildDossierPdf } from '@/lib/dossie/dossier'
import { DossieError } from '@/lib/dossie/documentos'
import { auditDossie } from '@/lib/dossie/history'
import { allowRequest, dossieRoute, pdfResponse, readJson } from '@/lib/dossie/http'

/** Gera o dossiê completo (PDF único) com os itens selecionados. `preview: true` abre inline. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.export', params.id, async ({ colaborador, actor, ip }) => {
    const body = await readJson(req)
    const selecao = Array.isArray(body.selecao) ? body.selecao.filter((v): v is string => typeof v === 'string') : []
    if (!selecao.length) throw new DossieError('Selecione ao menos um item para compor o dossiê.', 422)
    if (!allowRequest(`dossie:${actor.id}`, 12, 60_000)) throw new DossieError('Muitas exportações em sequência. Aguarde um instante.', 429)
    const preview = body.preview === true
    const result = await buildDossierPdf({ colaboradorId: colaborador.id, selecao, actorName: actor.name }).catch((error: unknown) => {
      throw error instanceof Error && !(error instanceof DossieError) && /Selecione|encontrado/.test(error.message) ? new DossieError(error.message, 422) : error
    })
    await auditDossie({ actor, action: 'VIEW_FILE', entity: 'Dossie', colaboradorId: colaborador.id, ip, details: { modo: preview ? 'preview' : 'download', itens: selecao.length, paginas: result.pages } })
    return pdfResponse(result.buffer, result.fileName, preview)
  });
}
