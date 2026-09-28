import { NextRequest, NextResponse } from 'next/server'
import { DossieError } from '@/lib/dossie/documentos'
import { sendDossierToErpnext } from '@/lib/dossie/erpnextDossie'
import { auditDossie } from '@/lib/dossie/history'
import { allowRequest, dossieRoute } from '@/lib/dossie/http'

/** Gera o dossiê completo e envia ao Documento Colaborador do ERPNext (acesso da contabilidade). */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return dossieRoute(req, 'employee.documents.export', params.id, async ({ colaborador, actor, ip }) => {
    if (!allowRequest(`dossie-erpnext:${actor.id}`, 6, 60_000)) throw new DossieError('Muitos envios em sequência. Aguarde um instante.', 429)
    const result = await sendDossierToErpnext(colaborador.id, 'Envio manual pelo RH', actor)
    await auditDossie({ actor, action: 'UPLOAD', entity: 'Dossie', colaboradorId: colaborador.id, ip, details: { destino: 'ERPNext', ...result } })
    if (!result.sent) throw new DossieError(`Dossiê não enviado ao ERPNext: ${result.error || result.skipped}`, 422)
    return NextResponse.json(result)
  })
}
