import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition } from './stateMachine'

describe('máquina de estados da admissão', () => {
  it('aceita o fluxo feliz controlado pelo backend', () => {
    expect(canTransition('DRAFT', 'LINK_SENT')).toBe(true)
    expect(canTransition('DOCUMENTS_UNDER_REVIEW', 'DOCUMENTS_APPROVED')).toBe(true)
    expect(canTransition('SYNCED', 'COMPLETED')).toBe(true)
  })

  it('impede saltos e alterações depois da conclusão', () => {
    expect(canTransition('DRAFT', 'COMPLETED')).toBe(false)
    expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false)
    expect(() => assertTransition('DRAFT', 'COMPLETED')).toThrow(/Transição inválida/)
  })

  it('permite retry do ERPNext sem duplicar a admissão', () => {
    expect(canTransition('ERPNEXT_ERROR', 'SYNCING')).toBe(true)
  })
})
