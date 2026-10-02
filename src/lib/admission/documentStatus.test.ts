import { describe, expect, it } from 'vitest'
import { canCancelDocumentRequest, isDocumentResolved, pendingRequiredDocuments } from './documentStatus'

describe('situação dos documentos admissionais', () => {
  it('permite cancelar somente solicitações de correção ou reenvio', () => {
    expect(canCancelDocumentRequest('REJECTED')).toBe(true)
    expect(canCancelDocumentRequest('RESUBMISSION_REQUIRED')).toBe(true)
    for (const status of ['PENDING', 'UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'NOT_APPLICABLE']) {
      expect(canCancelDocumentRequest(status)).toBe(false)
    }
  })

  it('libera a pendência dispensada sem liberar outros documentos obrigatórios', () => {
    const documents = [
      { status: 'REJECTED', type: { required: true } },
      { status: 'UNDER_REVIEW', type: { required: true } },
      { status: 'APPROVED', type: { required: true } },
    ]
    expect(pendingRequiredDocuments(documents)).toHaveLength(2)
    documents[0].status = 'NOT_APPLICABLE'
    expect(pendingRequiredDocuments(documents)).toEqual([documents[1]])
    documents[1].status = 'APPROVED'
    expect(pendingRequiredDocuments(documents)).toHaveLength(0)
  })

  it.each(['APPROVED', 'NOT_APPLICABLE'])('considera %s como resolvido', (status) => {
    expect(isDocumentResolved(status)).toBe(true)
  })

  it.each(['PENDING', 'UPLOADED', 'UNDER_REVIEW', 'REJECTED', 'RESUBMISSION_REQUIRED'])('mantém %s como pendente', (status) => {
    expect(isDocumentResolved(status)).toBe(false)
  })
})
