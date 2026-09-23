import type { AdmissionDocument, Prisma } from '@prisma/client'

/** Archives the previous file and replaces it atomically; concurrent uploads cannot lose a version. */
export async function replaceAdmissionDocumentFile(
  tx: Prisma.TransactionClient,
  previous: AdmissionDocument,
  saved: { storagePath: string; originalName: string; mimeType: string; sizeBytes: number },
) {
  const changed = await tx.admissionDocument.updateMany({
    where: { id: previous.id, version: previous.version, storagePath: previous.storagePath },
    data: { ...saved, status: 'UPLOADED', uploadedAt: new Date(), version: previous.storagePath ? { increment: 1 } : undefined, rejectionReason: null, reviewedAt: null, reviewedById: null },
  })
  if (changed.count !== 1) throw new Error('DOCUMENT_CHANGED')
  if (previous.storagePath) {
    await tx.admissionDocumentRevision.create({ data: {
      documentId: previous.id, version: previous.version, storagePath: previous.storagePath,
      originalName: previous.originalName, mimeType: previous.mimeType, sizeBytes: previous.sizeBytes,
      status: previous.status, uploadedAt: previous.uploadedAt,
    } })
  }
}
