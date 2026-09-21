import { describe, expect, it } from 'vitest'
import { mockERPNextAdmissionProvider, mockFaceProvider, mockSignatureProvider } from './providers'

describe('providers locais da admissão', () => {
  it('aprova validação facial no modo local', async () => {
    const result = await mockFaceProvider.verify({
      admissionId: 'admission-id',
      selfie: { buffer: Buffer.from('selfie'), mimeType: 'image/jpeg', filename: 'selfie.jpg' },
      reference: { buffer: Buffer.from('reference'), mimeType: 'image/jpeg', filename: 'reference.jpg' },
    })
    expect(result.reference).toMatch(/^face_mock_/)
    expect(result.decision).toBe('APPROVED')
  })

  it('assina com identificador de transação idempotente por envelope no serviço', async () => {
    const result = await mockSignatureProvider.sign('envelope-id')
    expect(result.transactionId).toMatch(/^sign_mock_/)
    expect(result.signedAt).toBeInstanceOf(Date)
  })

  it('simula sucesso e erros temporários do ERPNext', async () => {
    await expect(mockERPNextAdmissionProvider.sync('admission-id')).resolves.toMatchObject({ employeeId: expect.stringMatching(/^MOCK-/) })
    await expect(mockERPNextAdmissionProvider.sync('admission-id', 'temporary_error')).rejects.toThrow(/temporário/)
    await expect(mockERPNextAdmissionProvider.sync('admission-id', 'duplicate')).rejects.toThrow(/duplicado/)
  })
})
