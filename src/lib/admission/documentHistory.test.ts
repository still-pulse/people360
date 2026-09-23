import { describe, expect, it, vi } from 'vitest'
import type { AdmissionDocument, Prisma } from '@prisma/client'
import { replaceAdmissionDocumentFile } from './documentHistory'

const saved = { storagePath: 'novo.pdf', originalName: 'RG.pdf', mimeType: 'application/pdf', sizeBytes: 50 }
const previous = { id: 'doc-1', version: 3, storagePath: 'antigo.pdf', originalName: 'antigo.pdf', mimeType: 'application/pdf', sizeBytes: 40, status: 'REJECTED', uploadedAt: new Date('2026-09-22') } as AdmissionDocument
function transaction(count = 1) {
  const updateMany = vi.fn().mockResolvedValue({ count })
  const create = vi.fn().mockResolvedValue({})
  return { tx: { admissionDocument: { updateMany }, admissionDocumentRevision: { create } } as unknown as Prisma.TransactionClient, updateMany, create }
}

describe('reenvio de documento', () => {
  it('mantém arquivo, versão e situação anteriores para consulta histórica', async () => {
    const { tx, create, updateMany } = transaction()
    await replaceAdmissionDocumentFile(tx, previous, saved)
    expect(create).toHaveBeenCalledWith({ data: { documentId: previous.id, version: 3, storagePath: 'antigo.pdf', originalName: 'antigo.pdf', mimeType: 'application/pdf', sizeBytes: 40, status: 'REJECTED', uploadedAt: previous.uploadedAt } })
    expect(updateMany.mock.calls[0][0].data.version).toEqual({ increment: 1 })
  })
  it('bloqueia reenvio concorrente baseado numa versão desatualizada', async () => {
    const { tx, create, updateMany } = transaction(0)
    await expect(replaceAdmissionDocumentFile(tx, previous, saved)).rejects.toThrow('DOCUMENT_CHANGED')
    expect(create).not.toHaveBeenCalled()
    expect(updateMany.mock.calls[0][0].where).toEqual({ id: 'doc-1', version: 3, storagePath: 'antigo.pdf' })
  })
  it('não cria versão histórica vazia no primeiro envio', async () => {
    const { tx, create } = transaction()
    await replaceAdmissionDocumentFile(tx, { ...previous, storagePath: null, version: 1 }, saved)
    expect(create).not.toHaveBeenCalled()
  })
})
