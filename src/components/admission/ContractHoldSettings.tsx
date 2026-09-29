'use client'

import { useEffect, useState } from 'react'
import styles from './Admission.module.css'
import { StatusBadge } from './shared'

type Unit = { id: string; name: string }

/**
 * Unidades com a assinatura de contrato em espera: o candidato envia e o RH aprova os documentos, mas o
 * contrato e os termos não são gerados nem assinados (e nada segue para o ERPNext/eSocial) até liberar aqui.
 */
export function ContractHoldSettings({ units, initial }: { units: Unit[]; initial: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial)
  const [saved, setSaved] = useState<string[]>(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { setSelected(initial); setSaved(initial) }, [initial])
  const changed = selected.length !== saved.length || selected.some((id) => !saved.includes(id))

  async function save() {
    setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/admissao-digital/configuracoes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractHoldUnitIds: selected }) })
      const result = await response.json().catch(() => ({ error: 'Resposta inválida do servidor.' }))
      if (!response.ok) { setMessage(result.error || 'Não foi possível salvar.'); return }
      setSaved(result.unitIds); setSelected(result.unitIds); setMessage('Configuração salva.')
    } finally {
      setSaving(false)
    }
  }

  return <section className={styles.card} style={{ marginBottom: 16 }}>
    <div className={styles.cardHeader}>
      <div>
        <h2 className={styles.cardTitle}>Assinatura de contrato por unidade</h2>
        <p className={styles.itemMeta}>Unidade <strong>em espera</strong>: o candidato envia os documentos e o RH aprova normalmente, mas o contrato e os termos não são gerados nem assinados, e nada é enviado ao ERPNext/eSocial. Ao liberar, o candidato continua pelo mesmo link (ou por um novo, se o link tiver expirado).</p>
      </div>
      <StatusBadge status={saved.length ? 'CORRECTION_REQUESTED' : 'APPROVED'} label={saved.length ? `${saved.length} em espera` : 'Todas liberadas'} />
    </div>
    <div className={styles.metricList} style={{ marginTop: 12 }}>
      {units.map((unit) => {
        const onHold = selected.includes(unit.id)
        return <label key={unit.id} className={styles.attention} style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={onHold} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, unit.id] : ids.filter((id) => id !== unit.id))} />
          <div style={{ flex: 1 }}><div className={styles.itemTitle}>{unit.name}</div></div>
          <StatusBadge status={onHold ? 'CORRECTION_REQUESTED' : 'APPROVED'} label={onHold ? 'Em espera' : 'Liberada'} />
        </label>
      })}
    </div>
    <div className={styles.actions} style={{ marginTop: 14 }}>
      <button type="button" className={styles.buttonPrimary} disabled={!changed || saving} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar'}</button>
      {message && <span className={styles.itemMeta}>{message}</span>}
    </div>
  </section>
}
