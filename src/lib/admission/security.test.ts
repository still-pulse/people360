import { describe, expect, it } from 'vitest'
import { decryptAdmissionValue, encryptAdmissionValue, generateAdmissionToken, hashToken, isValidCpf, maskCpf, sanitizeAuditMetadata } from './security'

describe('segurança da admissão', () => {
  it('gera tokens fortes, distintos e persiste somente hashes', () => {
    const a = generateAdmissionToken(), b = generateAdmissionToken()
    expect(a.token).not.toBe(b.token)
    expect(a.token.length).toBeGreaterThanOrEqual(40)
    expect(a.hash).toBe(hashToken(a.token))
    expect(a.hash).not.toContain(a.token)
  })

  it('valida e mascara CPF sem expor o valor completo', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(maskCpf('529.982.247-25')).toBe('***.982.247-**')
  })

  it('remove chaves sensíveis dos metadados de auditoria', () => {
    expect(sanitizeAuditMetadata({ token: 'secret', cpf: 'secret', action: 'ok', count: 2 })).toEqual({ action: 'ok', count: 2 })
  })

  it('protege campos sensíveis em repouso', () => {
    const protectedValue = encryptAdmissionValue('529.982.247-25')
    expect(JSON.stringify(protectedValue)).not.toContain('529.982')
    expect(decryptAdmissionValue(protectedValue)).toBe('529.982.247-25')
  })
})
