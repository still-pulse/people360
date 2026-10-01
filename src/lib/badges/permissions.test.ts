import { describe, expect, it } from 'vitest'
import { canBadge } from './permissions'

describe('permissões de crachás', () => {
  it('permite visualizar, gerar e baixar para ADMIN e ANALYST', () => {
    for (const role of ['ADMIN', 'ANALYST']) {
      expect(canBadge(role, 'badges.view')).toBe(true)
      expect(canBadge(role, 'badges.generate')).toBe(true)
      expect(canBadge(role, 'badges.download')).toBe(true)
    }
  })

  it('nega o módulo aos demais papéis', () => {
    for (const role of ['GERENTE', 'SUPERINTENDENT', 'JURIDICO', undefined]) {
      expect(canBadge(role, 'badges.view')).toBe(false)
    }
  })
})
