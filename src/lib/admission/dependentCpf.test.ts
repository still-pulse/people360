import { describe, expect, it } from 'vitest'
import { resolveDependentCpf } from './dependentCpf'
import { encryptAdmissionValue, hashSensitive, maskCpf } from './security'

describe('recuperação do CPF do dependente', () => {
  it('recupera o número completo conferindo o hash original', () => {
    for (const cpf of ['11144477735', '52998224725', '00000000191']) {
      expect(resolveDependentCpf({ cpfMasked: maskCpf(cpf), cpfHash: hashSensitive(cpf) })).toBe(cpf)
    }
  })
  it('não retorna um número quando o hash ou a máscara não conferem', () => {
    expect(resolveDependentCpf({ cpfMasked: maskCpf('11144477735'), cpfHash: hashSensitive('52998224725') })).toBe('')
    expect(resolveDependentCpf({ cpfMasked: null, cpfHash: null })).toBe('')
  })
  it('usa o CPF criptografado quando disponível', () => {
    expect(resolveDependentCpf({ cpfEncrypted: encryptAdmissionValue('11144477735'), cpfMasked: null, cpfHash: null })).toBe('11144477735')
  })
})
