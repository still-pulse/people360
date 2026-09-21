export type AdmissionTourEventName =
  | 'tour_started'
  | 'tour_step_viewed'
  | 'tour_skipped'
  | 'tour_completed'

export type AdmissionTourStep = {
  element: `[data-admission-tour="${string}"]`
  title: string
  description: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

export type AdmissionTour = {
  id: string
  version: number
  name: string
  description: string
  category: string
  estimatedTime: number
  keywords: string[]
  route: string
  roles?: string[]
  onboarding?: boolean
  steps: AdmissionTourStep[]
}

export type AdmissionTourProgress = {
  tourId: string
  version: number
  status: 'STARTED' | 'SKIPPED' | 'COMPLETED'
  currentStep: number
  totalSteps: number
}

export function admissionTourKey(tour: Pick<AdmissionTour, 'id' | 'version'>) {
  return `${tour.id}:v${tour.version}`
}
