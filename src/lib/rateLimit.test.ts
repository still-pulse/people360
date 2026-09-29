import { describe, expect, it } from 'vitest'
import { checkPublicDocLinkRateLimit, isPublicDocLinkBlocked } from './rateLimit'

describe('limite de acesso do portal de admissão', () => {
  it('não bloqueia o candidato que preenche o formulário com muitos salvamentos automáticos', () => {
    const valid = { max: 900, windowMs: 15 * 60 * 1000, blockMs: 2 * 60 * 1000 }
    // ~200 salvamentos (um a cada pausa na digitação) + aberturas do link: antes bloqueava a partir de 60.
    const results = Array.from({ length: 200 }, () => checkPublicDocLinkRateLimit('1.2.3.4:abcd1234', valid).allowed)
    expect(results.every(Boolean)).toBe(true)
  })

  it('continua barrando varredura de links inválidos pelo mesmo IP', () => {
    const invalid = { max: 30, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 }
    for (let i = 0; i < 31; i++) checkPublicDocLinkRateLimit('5.6.7.8:admission-invalid', invalid)
    expect(isPublicDocLinkBlocked('5.6.7.8:admission-invalid')).toBe(true)
    expect(isPublicDocLinkBlocked('9.9.9.9:admission-invalid')).toBe(false)
  })

  it('mantém o limite padrão para os demais links públicos', () => {
    for (let i = 0; i < 60; i++) expect(checkPublicDocLinkRateLimit('doc:token-x').allowed).toBe(true)
    expect(checkPublicDocLinkRateLimit('doc:token-x').allowed).toBe(false)
  })
})
