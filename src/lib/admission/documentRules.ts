export const COUNCIL_DOCUMENT_KEYS = new Set(['coren_carteirinha'])
export const MILITARY_DOCUMENT_KEYS = new Set(['certificado_militar'])
export const DEPENDENT_DOCUMENT_KEYS = new Set([
  'rg_cpf_filhos',
  'certidao_nascimento_filhos',
  'carteira_vacinacao_dependentes',
  'comprovante_matricula_filhos',
])

const normalized = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** O documento cadastrado é especificamente do COREN, portanto só se aplica à enfermagem. */
export function isNursingPosition(jobTitle: string | null | undefined) {
  return normalized(jobTitle).includes('enferm')
}

export function isMaleGender(gender: unknown) {
  return ['male', 'masculino', 'm'].includes(normalized(gender))
}

export function isDocumentApplicableToPosition(key: string, jobTitle: string | null | undefined) {
  return !COUNCIL_DOCUMENT_KEYS.has(key) || isNursingPosition(jobTitle)
}
