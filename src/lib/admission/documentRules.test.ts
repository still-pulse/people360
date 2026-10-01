import { describe, expect, it } from 'vitest'
import { isDocumentApplicableToPosition, isMaleGender, isNursingPosition } from './documentRules'

describe('regras condicionais dos documentos admissionais', () => {
  it.each(['Enfermeiro', 'Técnico de Enfermagem', 'AUXILIAR DE ENFERMAGEM'])('aplica COREN ao cargo %s', (jobTitle) => {
    expect(isNursingPosition(jobTitle)).toBe(true)
    expect(isDocumentApplicableToPosition('coren_carteirinha', jobTitle)).toBe(true)
  })

  it.each(['Assistente Administrativo', 'Analista de RH', 'Recepcionista'])('não aplica COREN ao cargo %s', (jobTitle) => {
    expect(isDocumentApplicableToPosition('coren_carteirinha', jobTitle)).toBe(false)
  })

  it.each(['Male', 'Masculino', 'M'])('reconhece %s como gênero masculino', (gender) => {
    expect(isMaleGender(gender)).toBe(true)
  })

  it.each(['Female', 'Feminino', 'Other', ''])('não reconhece %s como gênero masculino', (gender) => {
    expect(isMaleGender(gender)).toBe(false)
  })
})
