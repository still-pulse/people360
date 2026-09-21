import type { AdmissionTour } from './types'

export function canUseAdmissionTour(tour: AdmissionTour, role: string) {
  return !tour.roles || tour.roles.includes(role)
}

export function searchAdmissionTours(tours: AdmissionTour[], query: string) {
  const normalized = query.trim().toLocaleLowerCase('pt-BR')
  if (!normalized) return tours
  const terms = normalized.split(/\s+/)
  return tours.filter((tour) => {
    const haystack = [tour.name, tour.description, tour.category, ...tour.keywords]
      .join(' ')
      .toLocaleLowerCase('pt-BR')
    return terms.every((term) => haystack.includes(term))
  })
}

export function resolveAdmissionTourSteps(tour: AdmissionTour, exists: (selector: string) => boolean) {
  return tour.steps.filter((step) => exists(step.element))
}

export function admissionProgressForEvent(
  event: 'tour_started' | 'tour_step_viewed' | 'tour_skipped' | 'tour_completed',
  stepIndex: number | undefined,
  totalSteps: number,
) {
  return {
    status: event === 'tour_completed' ? 'COMPLETED' as const : event === 'tour_skipped' ? 'SKIPPED' as const : 'STARTED' as const,
    currentStep: event === 'tour_completed' ? totalSteps - 1 : (stepIndex ?? 0),
  }
}
