export const DOCUMENT_RESOLVED_STATUSES = ['APPROVED', 'NOT_APPLICABLE'] as const

/** Documento aprovado ou formalmente dispensado pelo RH não bloqueia o fluxo. */
export function isDocumentResolved(status: string) {
  return DOCUMENT_RESOLVED_STATUSES.includes(status as typeof DOCUMENT_RESOLVED_STATUSES[number])
}
