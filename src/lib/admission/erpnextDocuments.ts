import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { erpnextConfigured, ErpnextApiError, sendEmployeeDocument } from '@/lib/erpnextClient'
import { readPrivateAdmissionFile } from './storage'
import { logAdmissionEvent } from './audit'

export type ErpnextDocumentsResult = { sent: number; alreadySent: number; failed: { name: string; error: string }[]; skipped?: string }

const EXTENSION_BY_MIME: Record<string, string> = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' }

function fileName(protocol: string, label: string, originalName: string | null | undefined, mimeType: string | null | undefined) {
  const extension = path.extname(originalName || '') || EXTENSION_BY_MIME[mimeType || ''] || ''
  return `${protocol} - ${label}`.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) + extension.toLowerCase()
}

/**
 * Envia ao ERPNext (DocType "Documento Colaborador" do rh_brasil) os documentos aprovados
 * e a foto do crachá aprovada. Nunca lança: falhas voltam no resultado e ficam no histórico,
 * para não travar a admissão nem a atualização cadastral. Reenviar é seguro (idempotente por id_externo).
 */
export async function pushAdmissionDocumentsToErpnext(admissionId: string, employeeId: string, actor?: { id?: string | null; name?: string | null }): Promise<ErpnextDocumentsResult> {
  const result: ErpnextDocumentsResult = { sent: 0, alreadySent: 0, failed: [] }
  if (!erpnextConfigured() || !employeeId || employeeId.startsWith('MOCK-')) return { ...result, skipped: 'ERPNext não configurado.' }
  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: {
    protocol: true, processType: true,
    documents: { where: { status: 'APPROVED', storagePath: { not: null } }, select: { id: true, version: true, storagePath: true, originalName: true, mimeType: true, uploadedAt: true, type: { select: { name: true } }, reviewedBy: { select: { name: true } } } },
    badgePhotos: { where: { confirmedAt: { not: null }, approvedAt: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, originalPath: true, processedPath: true, mimeType: true, confirmedAt: true } },
  } })
  if (!admission) return { ...result, skipped: 'Admissão não encontrada.' }
  const processo = admission.processType === 'REGISTRATION_UPDATE' ? 'Atualização Cadastral' as const : 'Admissão Digital' as const
  const items = [
    ...admission.documents.map((document) => ({ id: `people360:doc:${document.id}:v${document.version}`, label: document.type.name, storagePath: document.storagePath!, originalName: document.originalName, mimeType: document.mimeType, version: document.version, reviewer: document.reviewedBy?.name, date: document.uploadedAt })),
    ...admission.badgePhotos.map((photo) => ({ id: `people360:badge:${photo.id}`, label: 'Foto do crachá', storagePath: photo.processedPath || photo.originalPath, originalName: null, mimeType: photo.mimeType, version: 1, reviewer: undefined, date: photo.confirmedAt })),
  ]
  for (const item of items) {
    try {
      const content = await readPrivateAdmissionFile(item.storagePath)
      if (!content) throw new Error('Arquivo não encontrado no armazenamento do People360.')
      const response = await sendEmployeeDocument({
        employee: employeeId, tipo_documento: item.label, id_externo: item.id,
        nome_arquivo: fileName(admission.protocol, item.label, item.originalName, item.mimeType),
        conteudo_base64: content.toString('base64'), processo, protocolo: admission.protocol,
        aprovado_por: item.reviewer, versao: item.version, data_envio: item.date?.toISOString().slice(0, 19).replace('T', ' '),
      })
      if (response.duplicado) result.alreadySent++; else result.sent++
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida'
      result.failed.push({ name: item.label, error: message })
      // Endpoint ausente (rh_brasil ainda não atualizado) ou sem permissão: não adianta tentar os demais.
      if (error instanceof ErpnextApiError && [401, 403, 404].includes(error.status)) {
        result.skipped = `Envio interrompido: ${message}`
        break
      }
    }
  }
  if (result.failed.length) console.error('[erpnext-documents] Falha ao enviar documentos:', admission.protocol, result.failed)
  await logAdmissionEvent({ admissionId, actorId: actor?.id, actorName: actor?.name, actorType: actor ? 'USER' : 'SYSTEM', action: result.failed.length ? 'ERPNEXT_DOCUMENTS_PARTIAL' : 'ERPNEXT_DOCUMENTS_SENT', metadata: { employeeId, sent: result.sent, alreadySent: result.alreadySent, failed: result.failed, skipped: result.skipped } }).catch(() => {})
  return result
}

/** Colaborador no ERPNext vinculado ao processo: o da atualização cadastral ou o criado pela admissão. */
export async function erpnextEmployeeForAdmission(admissionId: string): Promise<string | null> {
  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: {
    processType: true, collaborator: { select: { erpnextId: true } },
    erpnextSyncs: { where: { status: 'SUCCESS', employeeId: { not: null } }, orderBy: { lastSyncedAt: 'desc' }, take: 1, select: { employeeId: true } },
  } })
  if (!admission) return null
  return admission.processType === 'REGISTRATION_UPDATE' ? admission.collaborator?.erpnextId ?? null : admission.erpnextSyncs[0]?.employeeId ?? null
}
