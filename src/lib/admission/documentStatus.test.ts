import { describe, expect, it } from 'vitest'
import { isDocumentResolved } from './documentStatus'

describe('situação dos documentos admissionais', () => {
  it.each(['APPROVED', 'NOT_APPLICABLE'])('considera %s como resolvido', (status) => {
    expect(isDocumentResolved(status)).toBe(true)
  })

  it.each(['PENDING', 'UPLOADED', 'UNDER_REVIEW', 'REJECTED', 'RESUBMISSION_REQUIRED'])('mantém %s como pendente', (status) => {
    expect(isDocumentResolved(status)).toBe(false)
  })
})
