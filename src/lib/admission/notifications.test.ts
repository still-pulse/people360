import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ status: 'IN_PROGRESS', email: vi.fn(), whatsapp: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { admission: { findUnique: vi.fn(async () => ({ status: mocks.status })) } },
}))
vi.mock('@/lib/email', () => ({
  appUrl: (path: string) => path,
  emailTemplate: ({ body }: { body: string }) => body,
  sendEmail: mocks.email,
}))
vi.mock('@/lib/evolution', () => ({ sendEvolutionText: mocks.whatsapp }))

import { notifyAdmissionCandidate } from './notifications'

const notification = {
  id: 'adm-1', candidateName: 'Maria Silva', candidateEmail: 'maria@example.com', candidatePhone: '11999999999',
  protocol: 'ADM-1', title: 'Aviso', message: 'Continue sua admissão.',
}

describe('notificações da admissão', () => {
  beforeEach(() => { mocks.status = 'IN_PROGRESS'; vi.clearAllMocks() })

  it('não envia e-mail nem WhatsApp para admissão cancelada', async () => {
    mocks.status = 'CANCELLED'
    await notifyAdmissionCandidate(notification)
    expect(mocks.email).not.toHaveBeenCalled()
    expect(mocks.whatsapp).not.toHaveBeenCalled()
  })

  it('envia normalmente enquanto a admissão estiver ativa', async () => {
    mocks.email.mockResolvedValue({ ok: true })
    mocks.whatsapp.mockResolvedValue({ ok: true })
    await notifyAdmissionCandidate(notification)
    expect(mocks.email).toHaveBeenCalledOnce()
    expect(mocks.whatsapp).toHaveBeenCalledOnce()
  })
})
