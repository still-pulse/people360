import { describe, expect, it } from 'vitest'
import { admissionProgressForEvent, canUseAdmissionTour, resolveAdmissionTourSteps, searchAdmissionTours } from './registry'
import { admissionTours } from './catalog'

describe('guias da Admissão Digital', () => {
  it('filtra busca e permissões', () => {
    expect(searchAdmissionTours(admissionTours, 'revisar documentos')).toHaveLength(1)
    const review = admissionTours.find((tour) => tour.id === 'admission-document-review')!
    expect(canUseAdmissionTour(review, 'ADMIN')).toBe(true)
    expect(canUseAdmissionTour(review, 'ANALYST')).toBe(true)
  })

  it('ignora seletores ausentes sem quebrar o tour', () => {
    const tour = admissionTours[0]
    const resolved = resolveAdmissionTourSteps(tour, (selector) => selector.includes('heading'))
    expect(resolved).toHaveLength(1)
  })

  it('calcula progresso concluído', () => {
    expect(admissionProgressForEvent('tour_completed', undefined, 4)).toEqual({ status: 'COMPLETED', currentStep: 3 })
  })
})
