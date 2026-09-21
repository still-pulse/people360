import { randomUUID } from 'crypto'

export interface FaceProvider { verify(admissionId: string): Promise<{ reference: string; approved: boolean }> }
export interface SignatureProvider { sign(envelopeId: string): Promise<{ transactionId: string; signedAt: Date }> }
export interface ERPNextAdmissionProvider { sync(admissionId: string, mode?: string): Promise<{ employeeId: string; employeeCode: string }> }
export interface AdmissionNotificationProvider { send(input: { channel: 'email' | 'whatsapp'; destination: string; template: string }): Promise<{ messageId: string }> }

export const mockFaceProvider: FaceProvider = {
  async verify() { return { reference: `face_mock_${randomUUID()}`, approved: process.env.MOCK_FACE_RESULT !== 'reject' } },
}

export const mockSignatureProvider: SignatureProvider = {
  async sign() { return { transactionId: `sign_mock_${randomUUID()}`, signedAt: new Date() } },
}

export const mockERPNextAdmissionProvider: ERPNextAdmissionProvider = {
  async sync(admissionId, mode) {
    if (mode === 'timeout') throw new Error('ERPNext mock: timeout')
    if (mode === 'temporary_error') throw new Error('ERPNext mock: erro temporário')
    if (mode === 'duplicate') throw new Error('ERPNext mock: colaborador duplicado')
    return { employeeId: `MOCK-${admissionId.slice(-8).toUpperCase()}`, employeeCode: `BHCL-${Date.now().toString().slice(-6)}` }
  },
}

export const mockAdmissionNotificationProvider: AdmissionNotificationProvider = {
  async send() { return { messageId: `notify_mock_${randomUUID()}` } },
}
