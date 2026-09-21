'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

export const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', AGUARDANDO_ASSINATURA: 'Aguardando assinatura', ASSINADO: 'Assinado',
  VIGENTE: 'Vigente', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada',
}
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline'> = {
  RASCUNHO: 'secondary', AGUARDANDO_ASSINATURA: 'warning', ASSINADO: 'success', VIGENTE: 'default',
  FINALIZADO: 'secondary', CANCELADO: 'danger', FINALIZADA: 'success', CANCELADA: 'danger',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{STATUS_LABEL[status] ?? status}</Badge>
}

export function fmtDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export function fmtDateTime(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

export function fmtMoney(value?: number | string | null) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(value)
}

export function toInput(value?: string | null) {
  return value ? value.slice(0, 10) : ''
}

export function SectionTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-12 px-6">
      <div className="w-11 h-11 rounded-2xl bg-[#15AFA4]/10 mx-auto mb-3 flex items-center justify-center">
        <CheckCircle2 className="w-5 h-5 text-[#15AFA4]" />
      </div>
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Field({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={cn('text-sm text-gray-900 mt-0.5 break-words', mono && 'font-mono')}>{value || '—'}</p>
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger'; children: React.ReactNode }) {
  const tones = { info: 'bg-[#15AFA4]/5 border-[#15AFA4]/20 text-gray-700', warning: 'bg-amber-50 border-amber-200 text-amber-800', danger: 'bg-red-50 border-red-200 text-red-700' }
  return (
    <div role={tone === 'info' ? undefined : 'alert'} className={cn('flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm', tones[tone])}>
      <AlertTriangle className={cn('w-4 h-4 mt-0.5 flex-shrink-0', tone === 'info' && 'text-[#15AFA4]')} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Confirmação padrão para operações importantes. */
export function ConfirmModal(props: {
  open: boolean; title: string; message: React.ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean
  reasonLabel?: string; onCancel: () => void; onConfirm: (reason?: string) => void
}) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (props.open) setReason('') }, [props.open])
  const needsReason = !!props.reasonLabel
  return (
    <Modal open={props.open} onClose={props.onCancel} title={props.title} size="sm">
      <div className="p-6 space-y-4">
        <div className="text-sm text-gray-600 space-y-2">{props.message}</div>
        {needsReason && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">{props.reasonLabel}</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20" />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={props.onCancel}>Cancelar</Button>
          <Button variant={props.danger ? 'danger' : 'primary'} size="sm" isLoading={props.busy} disabled={needsReason && reason.trim().length < 5} onClick={() => props.onConfirm(needsReason ? reason.trim() : undefined)}>
            {props.confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export type ToastState = { kind: 'success' | 'error'; text: string } | null

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onClose, toast.kind === 'error' ? 7000 : 3500)
    return () => clearTimeout(id)
  }, [toast, onClose])
  if (!toast) return null
  return (
    <div role="status" className={cn('fixed bottom-5 right-5 z-[70] max-w-sm flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm shadow-xl border', toast.kind === 'success' ? 'bg-white border-green-200 text-green-800' : 'bg-white border-red-200 text-red-700')}>
      <span className="flex-1">{toast.text}</span>
      <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
    </div>
  )
}

export const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20'
