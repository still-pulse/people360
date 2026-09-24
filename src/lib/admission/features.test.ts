import { afterEach, describe, expect, it } from 'vitest'
import { isFaceVerificationEnabled } from './features'

const original = process.env.ADMISSION_FACE_VERIFICATION_ENABLED

afterEach(() => {
  if (original === undefined) delete process.env.ADMISSION_FACE_VERIFICATION_ENABLED
  else process.env.ADMISSION_FACE_VERIFICATION_ENABLED = original
})

describe('recursos opcionais da admissão', () => {
  it('mantém a validação facial desligada por padrão', () => {
    delete process.env.ADMISSION_FACE_VERIFICATION_ENABLED
    expect(isFaceVerificationEnabled()).toBe(false)
  })

  it('só ativa a validação facial de forma explícita', () => {
    process.env.ADMISSION_FACE_VERIFICATION_ENABLED = 'true'
    expect(isFaceVerificationEnabled()).toBe(true)
  })
})
