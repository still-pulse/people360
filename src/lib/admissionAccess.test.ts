import { describe, expect, it, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { canAccessAdmission } from './apiHelpers'

const analyst = (id: string, unitIds: string[]) => ({ user: { id, role: 'ANALYST', unitIds } })

describe('acesso à admissão por analista', () => {
  const admission = { unitId: 'gru', ownerId: 'ana', analysts: [{ id: 'bia' }] }

  it('libera a unidade, o responsável principal e os analistas adicionais', () => {
    expect(canAccessAdmission(analyst('carla', ['gru']), admission)).toBe(true)
    expect(canAccessAdmission(analyst('ana', ['osasco']), admission)).toBe(true)
    expect(canAccessAdmission(analyst('bia', ['osasco']), admission)).toBe(true)
  })

  it('bloqueia analista de outra unidade que não é responsável', () => {
    expect(canAccessAdmission(analyst('davi', ['osasco']), admission)).toBe(false)
    expect(canAccessAdmission(analyst('bia', ['osasco']), { unitId: 'gru', ownerId: 'ana' })).toBe(false)
  })
})
