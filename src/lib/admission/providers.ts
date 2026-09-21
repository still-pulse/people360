import { randomUUID } from 'crypto'

export type FaceVerificationDecision = 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW'

export type FaceImage = {
  buffer: Buffer
  mimeType: string
  filename: string
}

export type FaceVerificationInput = {
  admissionId: string
  selfie: FaceImage
  reference: FaceImage
}

export type FaceVerificationResult = {
  reference: string
  decision: FaceVerificationDecision
  similarity?: number
  reason?: string
  metadata: Record<string, string | number | boolean | null>
}

export interface FaceProvider {
  readonly name: string
  verify(input: FaceVerificationInput): Promise<FaceVerificationResult>
}
export interface SignatureProvider { sign(envelopeId: string): Promise<{ transactionId: string; signedAt: Date }> }
export interface ERPNextAdmissionProvider { sync(admissionId: string, mode?: string): Promise<{ employeeId: string; employeeCode: string }> }
export interface AdmissionNotificationProvider { send(input: { channel: 'email' | 'whatsapp'; destination: string; template: string }): Promise<{ messageId: string }> }

export const mockFaceProvider: FaceProvider = {
  name: 'mock',
  async verify() {
    const mode = (process.env.MOCK_FACE_RESULT || 'approve').toLowerCase()
    if (mode === 'error') throw new Error('Face mock: erro simulado')
    const decision: FaceVerificationDecision = mode === 'approve' ? 'APPROVED' : mode === 'reject' ? 'REJECTED' : 'MANUAL_REVIEW'
    return {
      reference: `face_mock_${randomUUID()}`,
      decision,
      similarity: mode === 'approve' ? 0.99 : mode === 'reject' ? 0.2 : 0.6,
      reason: decision === 'MANUAL_REVIEW' ? 'MOCK_MANUAL_REVIEW' : undefined,
      metadata: { mock: true, mode },
    }
  },
}

export const mockSignatureProvider: SignatureProvider = {
  async sign() { return { transactionId: `sign_mock_${randomUUID()}`, signedAt: new Date() } },
}

/** Assinatura eletrônica local: cria uma transação única para o PDF de evidências. */
export const localSignatureProvider: SignatureProvider = {
  async sign(envelopeId) {
    return { transactionId: `p360_${envelopeId}_${randomUUID()}`, signedAt: new Date() }
  },
}

export function getSignatureProvider(): { name: string; provider: SignatureProvider } {
  const name = (process.env.SIGNATURE_PROVIDER || 'people360-local').trim().toLowerCase()
  if (name === 'people360-local') return { name, provider: localSignatureProvider }
  if (name === 'mock' && process.env.NODE_ENV !== 'production') return { name, provider: mockSignatureProvider }
  throw new Error(`Provedor de assinatura não suportado: ${name || '(vazio)'}`)
}

export const mockERPNextAdmissionProvider: ERPNextAdmissionProvider = {
  async sync(admissionId, mode) {
    if (mode === 'timeout') throw new Error('ERPNext mock: timeout')
    if (mode === 'temporary_error') throw new Error('ERPNext mock: erro temporário')
    if (mode === 'duplicate') throw new Error('ERPNext mock: colaborador duplicado')
    return { employeeId: `MOCK-${admissionId.slice(-8).toUpperCase()}`, employeeCode: `BHCL-${Date.now().toString().slice(-6)}` }
  },
}

export function getERPNextAdmissionProvider(): ERPNextAdmissionProvider {
  const name = (process.env.ADMISSION_ERPNEXT_PROVIDER || 'disabled').trim().toLowerCase()
  if (name === 'mock' && process.env.NODE_ENV !== 'production') return mockERPNextAdmissionProvider
  throw new Error(name === 'erpnext'
    ? 'A integração de criação de Employee no ERPNext ainda não está configurada para este ambiente.'
    : 'Integração ERPNext da admissão desativada.')
}

export const mockAdmissionNotificationProvider: AdmissionNotificationProvider = {
  async send() { return { messageId: `notify_mock_${randomUUID()}` } },
}
