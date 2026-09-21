import type { AdmissionStatus } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { detectMime } from './storage'
import {
  mockAdmissionNotificationProvider,
  mockERPNextAdmissionProvider,
  mockFaceProvider,
  mockSignatureProvider,
} from './providers'
import { generateAdmissionToken, hashToken } from './security'
import { assertTransition } from './stateMachine'

/**
 * Exercita o contrato do fluxo completo sem depender de serviços pagos.
 * A persistência HTTP/Prisma é validada separadamente no ambiente com PostgreSQL.
 */
describe('fluxo completo da admissão digital', () => {
  it('percorre RH, candidato, revisão, assinatura e ERPNext com providers locais', async () => {
    const issued = generateAdmissionToken()
    expect(hashToken(issued.token)).toBe(issued.hash)
    expect(issued.hash).not.toContain(issued.token)

    await expect(mockAdmissionNotificationProvider.send({
      channel: 'email',
      destination: 'candidato@example.test',
      template: 'admission-link',
    })).resolves.toMatchObject({ messageId: expect.stringMatching(/^notify_mock_/) })

    const pdf = Buffer.from('%PDF-1.7\nmock')
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    expect(detectMime(pdf)?.mime).toBe('application/pdf')
    expect(detectMime(jpeg)?.mime).toBe('image/jpeg')

    const face = await mockFaceProvider.verify('admission-e2e')
    expect(face.approved).toBe(true)
    expect(face.reference).toMatch(/^face_mock_/)

    const signature = await mockSignatureProvider.sign('envelope-e2e')
    expect(signature.transactionId).toMatch(/^sign_mock_/)

    const erp = await mockERPNextAdmissionProvider.sync('admission-e2e')
    expect(erp.employeeId).toMatch(/^MOCK-/)

    const flow: AdmissionStatus[] = [
      'DRAFT',
      'LINK_SENT',
      'IN_PROGRESS',
      'AWAITING_DOCUMENTS',
      'DOCUMENTS_UNDER_REVIEW',
      'DOCUMENTS_APPROVED',
      'FACE_VALIDATION_PENDING',
      'CONTRACT_PENDING',
      'SIGNATURE_PENDING',
      'SIGNED',
      'READY_FOR_ERPNEXT',
      'SYNCING',
      'SYNCED',
      'COMPLETED',
    ]

    for (let index = 1; index < flow.length; index += 1) {
      expect(() => assertTransition(flow[index - 1], flow[index])).not.toThrow()
    }
  })

  it('mantém retry de ERPNext controlado e bloqueia salto para conclusão', async () => {
    await expect(mockERPNextAdmissionProvider.sync('admission-e2e', 'temporary_error')).rejects.toThrow()
    expect(() => assertTransition('SYNCING', 'ERPNEXT_ERROR')).not.toThrow()
    expect(() => assertTransition('ERPNEXT_ERROR', 'SYNCING')).not.toThrow()
    expect(() => assertTransition('ERPNEXT_ERROR', 'COMPLETED')).toThrow()
  })
})
