export const DOCUMENT_RESOLVED_STATUSES = ['APPROVED', 'NOT_APPLICABLE'] as const

export function canCancelDocumentRequest(status: string) {
  return status === 'REJECTED' || status === 'RESUBMISSION_REQUIRED'
}

/** Documento aprovado ou formalmente dispensado pelo RH não bloqueia o fluxo. */
export function isDocumentResolved(status: string) {
  return DOCUMENT_RESOLVED_STATUSES.includes(status as typeof DOCUMENT_RESOLVED_STATUSES[number])
}

/** Obrigatórios ainda sem aprovação: a mesma regra que leva a admissão a "Documentos aprovados"/"Contrato pendente". */
export function pendingRequiredDocuments<T extends { status: string; type: { required: boolean } }>(documents: T[]) {
  return documents.filter((document) => document.type.required && !isDocumentResolved(document.status))
}
