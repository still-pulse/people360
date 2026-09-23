import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hashSensitive } from '@/lib/admission/security'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'
import { readDocumentoFile } from './documentos'

export type HistoryDocument = {
  id: string
  title: string
  origin: string
  protocol: string | null
  status: string
  version: number
  previous: boolean
  date: string
  fileName: string
  mimeType: string
  sizeBytes: number | null
}
export type HistoryFile = HistoryDocument & { read: () => Promise<Buffer | null> }
type Employee = { id: string; erpnextId: string; cpf: string | null }

export function linkedAdmissionsWhere(employee: Employee): Prisma.AdmissionWhereInput {
  const links: Prisma.AdmissionWhereInput[] = [
    { collaboratorId: employee.id },
    { collaboratorId: null, erpnextSyncs: { some: { employeeId: employee.erpnextId } } },
  ]
  const cpf = (employee.cpf ?? '').replace(/\D/g, '')
  if (cpf.length === 11) links.push({
    collaboratorId: null,
    erpnextSyncs: { none: { employeeId: { not: null } } },
    status: { in: ['SIGNED', 'READY_FOR_ERPNEXT', 'SYNCING', 'SYNCED', 'ERPNEXT_ERROR', 'COMPLETED'] },
    fields: { some: { key: 'cpf', searchHash: hashSensitive(cpf) } },
  })
  return { OR: links }
}

/** No copying/import is needed: files follow the employee across linked admission processes. */
export async function employeeDocumentHistory(employee: Employee): Promise<HistoryFile[]> {
  const [admissions, dossier] = await Promise.all([
    prisma.admission.findMany({
      where: linkedAdmissionsWhere(employee),
      select: {
        protocol: true, processType: true,
        documents: { include: { type: { select: { name: true } }, revisions: true } },
        generatedDocuments: { include: { template: { select: { name: true } } } },
      },
    }),
    prisma.colaboradorDocumento.findMany({ where: { colaboradorId: employee.id, OR: [{ arquivoPath: { not: null } }, { origem: 'GERADO', status: { not: 'RASCUNHO' } }] } }),
  ])
  const files: HistoryFile[] = []
  for (const admission of admissions) {
    const origin = admission.processType === 'REGISTRATION_UPDATE' ? 'Atualização cadastral' : 'Admissão'
    for (const doc of admission.documents) {
      const title = `${doc.type.name}${doc.side ? ` (${doc.side})` : ''}`
      for (const file of [...doc.revisions, doc]) {
        if (!file.storagePath) continue
        const storagePath = file.storagePath
        const previous = file !== doc
        const mimeType = file.mimeType || 'application/pdf'
        const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'pdf'
        files.push({
          id: `${previous ? 'revision' : 'upload'}-${file.id}`, title, origin, protocol: admission.protocol,
          status: file.status, version: file.version, previous, date: (file.uploadedAt ?? doc.createdAt).toISOString(),
          fileName: file.originalName || `${title}.${extension}`, mimeType, sizeBytes: file.sizeBytes,
          read: () => readPrivateAdmissionFile(storagePath),
        })
      }
    }
    for (const doc of admission.generatedDocuments) {
      for (const signed of [false, true]) {
        const storagePath = signed ? doc.signedStoragePath : doc.storagePath
        if (!storagePath) continue
        files.push({
          id: `${signed ? 'signed' : 'generated'}-${doc.id}`,
          title: `${doc.template.name}${signed ? ' (assinado)' : ' (original)'}`, origin, protocol: admission.protocol,
          status: signed ? 'SIGNED' : doc.signedStoragePath ? 'ORIGINAL' : doc.status,
          version: doc.templateVersion, previous: false,
          date: ((signed ? doc.signedAt : doc.generatedAt) ?? doc.createdAt).toISOString(),
          fileName: `${doc.template.name}${signed ? '-assinado' : '-original'}.pdf`, mimeType: 'application/pdf', sizeBytes: null,
          read: () => readPrivateAdmissionFile(storagePath),
        })
      }
    }
  }
  for (const doc of dossier) files.push({
    id: `dossier-${doc.id}`, title: doc.titulo,
    origin: doc.admissaoOrigemId ? 'Dossiê (cópia importada)' : 'Dossiê', protocol: null,
    status: doc.status, version: doc.versao, previous: false, date: (doc.geradoEm ?? doc.createdAt).toISOString(),
    fileName: doc.arquivoNome || `${doc.titulo}.pdf`, mimeType: doc.arquivoMime || 'application/pdf', sizeBytes: doc.arquivoTamanho,
    read: () => readDocumentoFile(doc),
  })
  return files.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export function historyMetadata(files: HistoryFile[]): HistoryDocument[] {
  return files.map(({ read, ...metadata }) => metadata)
}
