'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { admissionOverviewTour, admissionTours, getAdmissionTour } from '@/lib/admission/tours/catalog'
import { canUseAdmissionTour, resolveAdmissionTourSteps } from '@/lib/admission/tours/registry'
import type { AdmissionTour, AdmissionTourEventName, AdmissionTourProgress } from '@/lib/admission/tours/types'
import { AdmissionWelcomeDialog } from './AdmissionWelcomeDialog'

type ContextValue = {
  tours: AdmissionTour[]
  progress: AdmissionTourProgress[]
  loading: boolean
  startTour: (id: string, startAt?: number) => void
}

const AdmissionTourContext = createContext<ContextValue | null>(null)
const pendingKey = 'people360:admission:pending-tour'

export function AdmissionTourProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const driverRef = useRef<Driver | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [progress, setProgress] = useState<AdmissionTourProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const role = session?.user?.role ?? 'ANALYST'
  const availableTours = useMemo(() => admissionTours.filter((tour) => canUseAdmissionTour(tour, role)), [role])

  const refreshProgress = useCallback(async () => {
    if (status !== 'authenticated') return
    try {
      const response = await fetch('/api/admissao-digital/ajuda', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json() as { progress: AdmissionTourProgress[] }
        setProgress(data.progress)
      }
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { void refreshProgress() }, [refreshProgress])

  const record = useCallback(async (tour: AdmissionTour, event: AdmissionTourEventName, stepIndex?: number) => {
    await fetch('/api/admissao-digital/ajuda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tourId: tour.id, version: tour.version, event, stepIndex, totalSteps: tour.steps.length }),
      keepalive: true,
    }).catch(() => undefined)
  }, [])

  const launch = useCallback((tour: AdmissionTour, requestedStep = 0) => {
    const visibleSteps = resolveAdmissionTourSteps(tour, (selector) => Boolean(document.querySelector(selector)))
    if (!visibleSteps.length) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    let completed = false
    const instance = driver({
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      allowKeyboardControl: true,
      overlayClickBehavior: 'close',
      disableActiveInteraction: true,
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Próximo',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      popoverClass: 'people360-admission-tour',
      stagePadding: 8,
      stageRadius: 12,
      steps: visibleSteps.map((tourStep) => ({
        element: tourStep.element,
        popover: {
          title: tourStep.title, description: tourStep.description,
          side: tourStep.side, align: tourStep.align,
        },
      })),
      onHighlightStarted: (_element, _step, options) => {
        void record(tour, 'tour_step_viewed', options.state.activeIndex ?? 0)
      },
      onCloseClick: (_element, _step, options) => options.driver.destroy(),
      onDoneClick: (_element, _step, options) => {
        completed = true
        void record(tour, 'tour_completed', visibleSteps.length - 1).then(refreshProgress)
        options.driver.destroy()
      },
      onDestroyed: () => {
        if (!completed) void record(tour, 'tour_skipped', instance.getActiveIndex() ?? 0).then(refreshProgress)
        returnFocusRef.current?.focus()
        driverRef.current = null
      },
    })
    driverRef.current = instance
    void record(tour, 'tour_started', requestedStep)
    instance.drive(Math.min(requestedStep, visibleSteps.length - 1))
  }, [record, refreshProgress])

  const startTour = useCallback((id: string, startAt = 0) => {
    const tour = getAdmissionTour(id)
    if (!tour || !canUseAdmissionTour(tour, role)) return
    driverRef.current?.destroy()
    if (pathname !== tour.route) {
      sessionStorage.setItem(pendingKey, JSON.stringify({ id, startAt }))
      router.push(tour.route)
      return
    }
    window.setTimeout(() => launch(tour, startAt), 120)
  }, [launch, pathname, role, router])

  useEffect(() => {
    const raw = sessionStorage.getItem(pendingKey)
    if (!raw) return
    try {
      const pending = JSON.parse(raw) as { id: string; startAt: number }
      const tour = getAdmissionTour(pending.id)
      if (tour?.route === pathname) {
        sessionStorage.removeItem(pendingKey)
        window.setTimeout(() => launch(tour, pending.startAt), 300)
      }
    } catch {
      sessionStorage.removeItem(pendingKey)
    }
  }, [launch, pathname])

  const onboardingProgress = progress.find((item) => item.tourId === admissionOverviewTour.id && item.version === admissionOverviewTour.version)
  const showWelcome = !loading && status === 'authenticated' && !welcomeDismissed && !onboardingProgress

  return (
    <AdmissionTourContext.Provider value={{ tours: availableTours, progress, loading, startTour }}>
      {children}
      <AdmissionWelcomeDialog
        open={showWelcome}
        onStart={() => { setWelcomeDismissed(true); startTour(admissionOverviewTour.id) }}
        onSkip={() => {
          setWelcomeDismissed(true)
          void record(admissionOverviewTour, 'tour_skipped', 0).then(refreshProgress)
        }}
      />
    </AdmissionTourContext.Provider>
  )
}

export function useAdmissionTours() {
  const context = useContext(AdmissionTourContext)
  if (!context) throw new Error('useAdmissionTours deve ser usado dentro de AdmissionTourProvider')
  return context
}
