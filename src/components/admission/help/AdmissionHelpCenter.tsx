'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Play, RotateCcw, Search } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { AdmissionTitle } from '../shared'
import styles from '../Admission.module.css'
import { searchAdmissionTours } from '@/lib/admission/tours/registry'
import { admissionTourKey } from '@/lib/admission/tours/types'
import { useAdmissionTours } from './AdmissionTourProvider'

export function AdmissionHelpCenter() {
  const { tours, progress, startTour, loading } = useAdmissionTours()
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchAdmissionTours(tours, query), [query, tours])
  const categories = useMemo(() => {
    const grouped = new Map<string, typeof results>()
    results.forEach((tour) => grouped.set(tour.category, [...(grouped.get(tour.category) ?? []), tour]))
    return Array.from(grouped.entries())
  }, [results])

  return <>
    <Header title="Central de Ajuda" subtitle="Admissão Digital"/>
    <div className={styles.module}><div className={styles.content}>
      <AdmissionTitle title="Central de Ajuda" subtitle="Aprenda no seu ritmo e repita qualquer passo a passo quando precisar."/>
      <label className={styles.helpSearch} data-admission-tour="help-search">
        <Search size={18}/><span className="sr-only">Pesquisar ajuda</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por admissão, documento, facial..."/>
      </label>
      {!loading && !categories.length && <div className={`${styles.card} ${styles.empty}`}><strong>Nenhum tutorial encontrado</strong><p>Tente buscar por uma ação, como “revisar documento”.</p></div>}
      {categories.map(([category, categoryTours]) => <section className={styles.helpSection} key={category}>
        <h2>{category}</h2>
        <div className={styles.helpGrid}>
          {categoryTours.map((tour) => {
            const state = progress.find((item) => item.tourId === tour.id && item.version === tour.version)
            const completed = state?.status === 'COMPLETED'
            const resumable = state?.status === 'STARTED' && state.currentStep > 0
            return <article className={styles.helpCard} key={admissionTourKey(tour)}>
              <div className={completed ? styles.helpCardIconDone : styles.helpCardIcon}>{completed ? <CheckCircle2 size={20}/> : <Play size={18}/>}</div>
              <div className={styles.helpCardBody}>
                <h3>{tour.name}</h3><p>{tour.description}</p>
                <span><Clock3 size={14}/> Cerca de {Math.max(1, Math.ceil(tour.estimatedTime / 60))} min · {tour.steps.length} passos</span>
              </div>
              <button className={completed ? styles.button : styles.buttonPrimary} onClick={() => startTour(tour.id, resumable ? state.currentStep : 0)}>
                {completed ? <><RotateCcw size={14}/>Repetir</> : resumable ? `Continuar do passo ${state.currentStep + 1}` : <><Play size={14}/>Iniciar</>}
              </button>
            </article>
          })}
        </div>
      </section>)}
    </div></div>
  </>
}
