import { prisma } from '@/lib/prisma'
import { erpnextConfigured, sendEmployeeDocumentFile } from '@/lib/erpnextClient'
import { compressPdf } from '@/lib/pdfCompress'
import { buildDossierPdf, SELECAO_IDS } from './dossier'
import { addHistorico } from './history'

export type DossieErpnextResult = { sent: boolean; name?: string; pages?: number; sizeBytes?: number; originalBytes?: number; error?: string; skipped?: string }

/**
 * Gera o dossiê completo (todas as seções + todos os documentos, com versões anteriores) e envia ao
 * Documento Colaborador do ERPNext como "Dossiê do Colaborador". Cada envio vira a versão vigente e o
 * rh_brasil marca a anterior como "Substituído". Nunca lança: o resultado volta para quem chamou.
 */
export async function sendDossierToErpnext(colaboradorId: string, motivo: string, actor?: { id?: string | null; name?: string | null } | null): Promise<DossieErpnextResult> {
  if (!erpnextConfigured()) return { sent: false, skipped: 'ERPNext não configurado.' }
  const colaborador = await prisma.colaborador.findUnique({ where: { id: colaboradorId }, select: { erpnextId: true, employeeName: true } })
  if (!colaborador?.erpnextId) return { sent: false, skipped: 'Colaborador sem vínculo com o ERPNext.' }
  try {
    const dossie = await buildDossierPdf({ colaboradorId, selecao: SELECAO_IDS, actorName: actor?.name || 'People360' })
    const geradoEm = new Date()
    const pdf = await compressPdf(dossie.buffer)
    const response = await sendEmployeeDocumentFile({
      employee: colaborador.erpnextId, tipo_documento: 'Dossiê do Colaborador', processo: 'Dossiê',
      id_externo: `people360:dossie:${colaboradorId}:${geradoEm.getTime()}`, nome_arquivo: dossie.fileName,
      protocolo: motivo.slice(0, 140), aprovado_por: actor?.name || 'People360',
      data_envio: geradoEm.toISOString().slice(0, 19).replace('T', ' '),
    }, pdf.buffer)
    await addHistorico({
      colaboradorId, tipo: 'DOCUMENTO', dataEvento: geradoEm, titulo: 'Dossiê enviado ao ERPNext',
      novo: `${dossie.pages} página(s) — ${motivo}`, actor: actor?.id && actor.name ? { id: actor.id, name: actor.name } : null,
    }).catch(() => {})
    return { sent: true, name: response.name, pages: dossie.pages, sizeBytes: pdf.compressedBytes, originalBytes: pdf.originalBytes }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida'
    console.error('[erpnext-dossie] Falha ao enviar o dossiê:', colaborador.erpnextId, message)
    return { sent: false, error: message }
  }
}
