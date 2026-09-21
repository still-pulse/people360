'use client'

import { useEffect, useRef } from 'react'
import { Compass } from 'lucide-react'
import styles from '../Admission.module.css'

export function AdmissionWelcomeDialog({ open, onStart, onSkip }: { open: boolean; onStart: () => void; onSkip: () => void }) {
  const startRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open) startRef.current?.focus() }, [open])
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onSkip() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onSkip])
  if (!open) return null

  return (
    <div className={styles.helpWelcomeOverlay} role="presentation">
      <div className={styles.helpWelcomeDialog} role="dialog" aria-modal="true" aria-labelledby="admission-welcome-title">
        <div className={styles.helpWelcomeIcon}><Compass size={25}/></div>
        <h2 id="admission-welcome-title">Bem-vindo à Admissão Digital</h2>
        <p>Quer conhecer o fluxo, os indicadores e os pontos que exigem atenção? O passeio leva cerca de um minuto.</p>
        <div className={styles.actions}>
          <button className={styles.button} onClick={onSkip}>Agora não</button>
          <button ref={startRef} className={styles.helpWelcomePrimary} onClick={onStart}>Fazer tour</button>
        </div>
      </div>
    </div>
  )
}
