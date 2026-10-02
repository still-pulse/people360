import { describe, expect, it } from 'vitest'
import { DEPENDENT_DOSSIER_VERSION, needsDependentDossierCorrection } from './accountingDossier'

describe('correção de dossiês antigos com dependentes', () => {
  it('considera somente processos cujo dossiê já foi gerado', () => {
    expect(needsDependentDossierCorrection([])).toBe(false)
    expect(needsDependentDossierCorrection([{ metadata: null }])).toBe(true)
    expect(needsDependentDossierCorrection([{ metadata: { batch: true } }])).toBe(true)
  })

  it('usa a última geração para não repetir os dossiês corrigidos', () => {
    expect(needsDependentDossierCorrection([{ metadata: { dependentDataVersion: DEPENDENT_DOSSIER_VERSION } }, { metadata: null }])).toBe(false)
    expect(needsDependentDossierCorrection([{ metadata: null }, { metadata: { dependentDataVersion: DEPENDENT_DOSSIER_VERSION } }])).toBe(true)
  })
})
