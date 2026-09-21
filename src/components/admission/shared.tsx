'use client'

import Link from 'next/link'
import { Search, Plus, RefreshCw } from 'lucide-react'
import styles from './Admission.module.css'

export const statusLabel: Record<string, string> = {
  DRAFT:'Rascunho', LINK_SENT:'Aguardando candidato', IN_PROGRESS:'Em andamento', AWAITING_DOCUMENTS:'Documentos pendentes',
  DOCUMENTS_UNDER_REVIEW:'Documentos em análise', CORRECTION_REQUESTED:'Correção solicitada', DOCUMENTS_APPROVED:'Documentos aprovados',
  FACE_VALIDATION_PENDING:'Validação facial pendente', CONTRACT_PENDING:'Contrato pendente', SIGNATURE_PENDING:'Aguardando assinatura',
  SIGNED:'Assinado', READY_FOR_ERPNEXT:'Pronto para ERPNext', SYNCING:'Sincronizando', SYNCED:'Sincronizado', ERPNEXT_ERROR:'Erro no ERPNext',
  COMPLETED:'Concluída', CANCELLED:'Cancelada', EXPIRED:'Expirada',
}

export function statusTone(status: string) {
  if (['COMPLETED','SYNCED','SIGNED','APPROVED','DOCUMENTS_APPROVED','SUCCESS'].includes(status)) return 'ok'
  if (['ERPNEXT_ERROR','CANCELLED','REJECTED','ERROR'].includes(status)) return 'error'
  if (['LINK_SENT','AWAITING_DOCUMENTS','CORRECTION_REQUESTED','SIGNATURE_PENDING','EXPIRED','RESUBMISSION_REQUIRED'].includes(status)) return 'warn'
  return 'info'
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={styles.badge} data-tone={statusTone(status)}><span className={styles.dot} />{label || statusLabel[status] || status}</span>
}

export function AdmissionTitle({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return <div className={styles.titleRow}><div className={styles.titleBlock}><h1 className={styles.title}>{title}</h1><p className={styles.subtitle}>{subtitle}</p></div>{children && <div className={styles.actions}>{children}</div>}</div>
}

export function NewAdmissionButton() { return <Link href="/admissao-digital/admissoes/nova" className={styles.buttonPrimary}><Plus size={15}/>Nova admissão</Link> }

export function SearchBox({ value, onChange, placeholder = 'Buscar candidato, CPF ou vaga…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className={styles.search}><Search size={15}/><input className={styles.input} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/></div>
}

export function LoadingCards({ count = 4 }: { count?: number }) { return <div className={styles.kpiGrid}>{Array.from({length:count},(_,i)=><div key={i} className={styles.skeleton}/>)}</div> }

export function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className={`${styles.card} ${styles.empty}`}><p>{message}</p><button className={styles.button} onClick={retry}><RefreshCw size={14}/>Tentar novamente</button></div> }

export function formatDate(value?: string | Date | null) { return value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : '—' }
export function formatDateTime(value?: string | Date | null) { return value ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '—' }
