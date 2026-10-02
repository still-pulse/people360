import { NextRequest } from 'next/server'
import { buildAdmissionDossierPdf, buildDossierPdf } from '@/lib/dossie/dossier'
import { DossieError } from '@/lib/dossie/documentos'
import { auditDossie } from '@/lib/dossie/history'
import { allowRequest, dossieRoute, pdfResponse, readJson } from '@/lib/dossie/http'
import { compressPdf } from '@/lib/pdfCompress'
import { buildLegalDossierPdf } from '@/lib/dossie/legalDossier'

/** Gera o dossiê funcional ou admissional em PDF único. `preview: true` abre inline. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.export', params.id, async ({ colaborador, actor, ip }) => {
    const body = await readJson(req)
    const tipo = body.tipo === 'JURIDICO' ? 'JURIDICO' : body.tipo === 'ADMISIONAL' ? 'ADMISIONAL' : 'FUNCIONAL'
    const selecao = Array.isArray(body.selecao) ? body.selecao.filter((v): v is string => typeof v === 'string') : []
    if (tipo === 'FUNCIONAL' && !selecao.length) throw new DossieError('Selecione ao menos um item para compor o dossiê.', 422)
    if (!allowRequest(`dossie:${actor.id}`, 12, 60_000)) throw new DossieError('Muitas exportações em sequência. Aguarde um instante.', 429)
    const preview = body.preview === true
    const result = await (tipo === 'JURIDICO'
      ? buildLegalDossierPdf({ colaboradorId: colaborador.id, actorName: actor.name })
      : tipo === 'ADMISIONAL'
      ? buildAdmissionDossierPdf({ colaboradorId: colaborador.id, actorName: actor.name })
      : buildDossierPdf({ colaboradorId: colaborador.id, selecao, actorName: actor.name })
    ).catch((error: unknown) => {
      throw error instanceof Error && !(error instanceof DossieError) && /Selecione|encontrado/.test(error.message) ? new DossieError(error.message, 422) : error
    })
    await auditDossie({ actor, action: 'VIEW_FILE', entity: 'Dossie', colaboradorId: colaborador.id, ip, details: { tipo, modo: preview ? 'preview' : 'download', itens: tipo === 'FUNCIONAL' ? selecao.length : undefined, paginas: result.pages } })
    const buffer = preview ? result.buffer : (await compressPdf(result.buffer)).buffer
    return pdfResponse(buffer, result.fileName, preview)
  });
}
