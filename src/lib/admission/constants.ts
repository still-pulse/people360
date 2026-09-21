import type { AdmissionStatus } from '@prisma/client'

export const ADMISSION_STATUS_LABEL: Record<AdmissionStatus, string> = {
  DRAFT: 'Rascunho',
  LINK_SENT: 'Link enviado',
  IN_PROGRESS: 'Em andamento',
  AWAITING_DOCUMENTS: 'Aguardando documentos',
  DOCUMENTS_UNDER_REVIEW: 'Documentos em análise',
  CORRECTION_REQUESTED: 'Correção solicitada',
  DOCUMENTS_APPROVED: 'Documentos aprovados',
  FACE_VALIDATION_PENDING: 'Validação facial pendente',
  CONTRACT_PENDING: 'Contrato pendente',
  SIGNATURE_PENDING: 'Assinatura pendente',
  SIGNED: 'Assinado',
  READY_FOR_ERPNEXT: 'Pronto para ERPNext',
  SYNCING: 'Sincronizando',
  SYNCED: 'Sincronizado',
  ERPNEXT_ERROR: 'Erro no ERPNext',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
}

export const ADMISSION_STEPS = [
  { key: 'dados', label: 'Dados pessoais', progress: 18 },
  { key: 'dependentes', label: 'Dependentes', progress: 28 },
  { key: 'vale-transporte', label: 'Vale-Transporte', progress: 38 },
  { key: 'documentos', label: 'Documentos', progress: 55 },
  { key: 'foto', label: 'Foto para crachá', progress: 66 },
  { key: 'validacao-facial', label: 'Validação facial', progress: 74 },
  { key: 'revisao', label: 'Revisão', progress: 82 },
  { key: 'assinatura', label: 'Assinatura', progress: 94 },
  { key: 'conclusao', label: 'Conclusão', progress: 100 },
] as const

export const SENSITIVE_FIELD_KEYS = new Set([
  'cpf', 'rg', 'pis', 'bank', 'agency', 'account', 'accountDigit', 'accountType',
  'motherName', 'fatherName', 'disability', 'disabilityDetails',
])

export const PUBLIC_FIELD_SECTIONS = {
  personal: ['name', 'birthDate', 'phone', 'messagePhone', 'email', 'rg', 'rgIssuedAt', 'rgIssuer', 'cpf', 'pis', 'birthCity', 'ethnicity', 'disability', 'disabilityDetails', 'fatherName', 'motherName', 'education', 'maritalStatus'],
  address: ['zipCode', 'street', 'number', 'complement', 'district', 'city', 'state'],
  bank: ['bank', 'agency', 'account', 'accountDigit', 'accountType'],
} as const

export const DEFAULT_DOCUMENT_TYPES = [
  { key: 'rg_frente', name: 'RG ou CNH (frente)', position: 1 },
  { key: 'rg_verso', name: 'RG ou CNH (verso)', position: 2 },
  { key: 'cpf', name: 'CPF', position: 3 },
  { key: 'comprovante_residencia', name: 'Comprovante de residência', position: 4 },
  { key: 'carteira_trabalho', name: 'Carteira de Trabalho Digital', position: 5 },
  { key: 'pis', name: 'Comprovante de PIS/PASEP', position: 6 },
  { key: 'titulo_eleitor', name: 'Título de eleitor', position: 7 },
  { key: 'certidao', name: 'Certidão civil', position: 8 },
] as const

export const ADMISSION_THEME = {
  ink: '#1D2B2E', muted: '#5D6E71', subtle: '#7C8E91', faint: '#9DAEB0',
  primary: '#0F9B8E', primaryDark: '#0A6F66', background: '#F6F8F8',
  surface: '#FFFFFF', border: '#E2E8E7', borderSoft: '#EEF3F2',
  success: '#1E8E5A', warning: '#C77B0A', danger: '#C0392B', info: '#2563A8',
} as const
