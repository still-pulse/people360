'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ExternalLink, RefreshCw } from 'lucide-react'
import styles from './Admission.module.css'

type State = { status: 'NOT_STARTED' | 'PENDING' | 'PROCESSING' | 'SIGNED' | 'REJECTED' | 'CANCELLED'; signLink: string | null; rejectedReason: string | null }

/**
 * Etapa de assinatura quando SIGNATURE_PROVIDER=autentique: o candidato abre o link exclusivo dele na Autentique;
 * o portal acompanha a situação e segue para a conclusão quando a assinatura é confirmada.
 */
export function AutentiqueSignature({ token, documents, onBack, onSigned }: { token: string; documents: { id: string; name: string }[]; onBack: () => void; onSigned: () => void }) {
  const [state, setState] = useState<State | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Ref: o portal passa uma função nova a cada renderização; sem isso a consulta entraria em laço.
  const signedRef = useRef(onSigned)
  signedRef.current = onSigned

  const check = useCallback(async () => {
    const response = await fetch(`/api/admissao/${token}/assinatura/autentique`, { cache: 'no-store' })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result) return
    setState(result)
    if (result.status === 'SIGNED') signedRef.current()
  }, [token])

  useEffect(() => { void check() }, [check])
  // Enquanto o candidato assina na outra aba, confere a cada 15 segundos.
  useEffect(() => {
    if (state?.status !== 'PENDING' && state?.status !== 'PROCESSING') return
    const timer = setInterval(() => { void check() }, 15_000)
    return () => clearInterval(timer)
  }, [state?.status, check])

  async function start() {
    if (!accepted) { setError('Confirme a leitura e a concordância.'); return }
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admissao/${token}/assinatura/autentique`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accepted: true }) })
      const result = await response.json().catch(() => ({ error: 'Resposta inválida do servidor.' }))
      if (!response.ok) { setError(result.error || 'Não foi possível preparar a assinatura.'); return }
      setState({ status: result.status, signLink: result.signLink, rejectedReason: null })
      if (result.signLink) window.open(result.signLink, '_blank', 'noopener')
    } catch {
      setError('Não foi possível preparar a assinatura agora. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const pending = state?.status === 'PENDING' || state?.status === 'PROCESSING'
  return <>
    <h1 className={styles.portalTitle}>Assinatura eletrônica</h1>
    <p className={styles.portalText}>Seus documentos serão assinados pela <strong>Autentique</strong>, plataforma de assinatura eletrônica com validade jurídica. Você assina todos de uma vez, em um único envio.</p>
    <div className={styles.docRow}>
      <strong>Documentos para assinatura</strong>
      <ul className={styles.itemMeta} style={{ margin: '8px 0 0', paddingLeft: 18 }}>{documents.map((document) => <li key={document.id}>{document.name}</li>)}</ul>
    </div>

    {state?.status === 'REJECTED' ? <div className={styles.error} style={{ marginTop: 16 }}>A assinatura foi recusada{state.rejectedReason ? `: ${state.rejectedReason}` : ''}. Fale com o RH para receber um novo link.</div>
      : pending ? <div className={styles.docRow} style={{ marginTop: 16, background: '#F1F9F8' }}>
        <strong>Falta pouco: assine na Autentique</strong>
        <p className={styles.itemMeta} style={{ margin: '6px 0 12px' }}>A assinatura abre em outra aba. Depois de assinar, volte aqui: esta página confirma automaticamente{state.status === 'PROCESSING' ? ' (processando…)' : ''}.</p>
        <div className={styles.actions}>
          {state.signLink && <a className={styles.buttonPrimary} href={state.signLink} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Assinar na Autentique</a>}
          <button type="button" className={styles.button} onClick={() => void check()}><RefreshCw size={14} />Já assinei, verificar</button>
        </div>
      </div>
      : state?.status === 'SIGNED' ? <div className={styles.docRow} style={{ marginTop: 16 }}><Check size={14} /> Documentos assinados.</div>
      : <div style={{ marginTop: 16 }}>
        <label className={styles.docRow} style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span className={styles.itemMeta}>Li os documentos e concordo em assiná-los eletronicamente pela Autentique.</span>
        </label>
      </div>}

    {error && <p className={styles.error}>{error}</p>}
    <nav className={styles.portalNav}>
      <button type="button" className={styles.button} onClick={onBack} disabled={busy}><ChevronLeft size={15} />Voltar</button>
      {(!state || state.status === 'NOT_STARTED' || state.status === 'CANCELLED') && <button type="button" className={styles.buttonPrimary} onClick={() => void start()} disabled={busy || !accepted}>{busy ? 'Preparando documentos…' : 'Assinar na Autentique'}<ExternalLink size={14} /></button>}
    </nav>
  </>
}
