'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import styles from './Admission.module.css'

type User = { id: string; name: string }

/** Outros analistas responsáveis: chips removíveis + lista para adicionar (sem repetir o principal). */
export function AnalystPicker({ users, ownerId, value, onChange }: { users: User[]; ownerId?: string; value: string[]; onChange: (ids: string[]) => void }) {
  const selected = value.map((id) => users.find((user) => user.id === id)).filter((user): user is User => !!user)
  const available = users.filter((user) => user.id !== ownerId && !value.includes(user.id))
  return <div>
    {selected.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
      {selected.map((user) => <span key={user.id} className={styles.badge} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {user.name}
        <button type="button" aria-label={`Remover ${user.name}`} onClick={() => onChange(value.filter((id) => id !== user.id))} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex' }}><X size={12} /></button>
      </span>)}
    </div>}
    <select className={styles.select} value="" onChange={(event) => { if (event.target.value) onChange([...value, event.target.value]) }} disabled={!available.length}>
      <option value="">{available.length ? 'Adicionar analista…' : 'Todos os analistas já foram adicionados'}</option>
      {available.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
    </select>
  </div>
}

/** Edição dos responsáveis no detalhe da admissão. */
export function ResponsibleEditor({ owner, analysts, onSave }: { owner?: User | null; analysts: User[]; onSave: (ownerId: string, analystIds: string[]) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [ownerId, setOwnerId] = useState(owner?.id ?? '')
  const [analystIds, setAnalystIds] = useState(analysts.map((analyst) => analyst.id))
  const [saving, setSaving] = useState(false)
  useEffect(() => { setOwnerId(owner?.id ?? ''); setAnalystIds(analysts.map((analyst) => analyst.id)) }, [owner, analysts])
  useEffect(() => {
    if (!editing || users.length) return
    fetch('/api/admissao-digital/meta').then((response) => response.json()).then((meta) => setUsers(meta.users ?? [])).catch(() => setUsers([]))
  }, [editing, users.length])
  const names = [owner?.name, ...analysts.map((analyst) => analyst.name)].filter(Boolean).join(', ') || '—'
  if (!editing) return <div className={styles.itemMeta} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
    <span><strong>Responsáveis:</strong> {names}</span>
    <button type="button" className={styles.button} style={{ padding: '4px 10px', minHeight: 0 }} onClick={() => setEditing(true)}>Editar responsáveis</button>
  </div>
  return <div className={styles.docRow} style={{ display: 'grid', gap: 10 }}>
    <label className={styles.field}><span className={styles.label}>Analista responsável (principal)</span>
      <select className={styles.select} value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setAnalystIds((ids) => ids.filter((id) => id !== event.target.value)) }}>
        {!ownerId && <option value="">Selecione</option>}
        {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
      </select>
    </label>
    <label className={styles.field}><span className={styles.label}>Outros analistas responsáveis</span>
      <AnalystPicker users={users} ownerId={ownerId} value={analystIds} onChange={setAnalystIds} />
    </label>
    <div className={styles.actions}>
      <button type="button" className={styles.buttonPrimary} disabled={saving || !ownerId} onClick={async () => { setSaving(true); try { await onSave(ownerId, analystIds); setEditing(false) } finally { setSaving(false) } }}>{saving ? 'Salvando…' : 'Salvar responsáveis'}</button>
      <button type="button" className={styles.button} onClick={() => setEditing(false)}>Cancelar</button>
    </div>
  </div>
}
