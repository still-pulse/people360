'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ActionBadge, fieldLabel, formatAuditValue } from '@/lib/auditMeta'
import { formatDatetime } from '@/lib/utils'

interface AuditEntry {
  id: string
  userName?: string | null
  userRole?: string | null
  action: string
  details?: Record<string, unknown> | null
  createdAt: string
}

function DiffDetails({ details }: { details: Record<string, unknown> }) {
  // Padrão diff(): { before: {...}, after: {...} } ou { antes: {...}, depois: {...} }
  const before = (details.before ?? details.antes) as Record<string, unknown> | undefined
  const after  = (details.after ?? details.depois) as Record<string, unknown> | undefined

  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    if (keys.length === 0) return null
    return (
      <div className="space-y-1 mt-1.5">
        {keys.map((k) => (
          <div key={k} className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="text-gray-400 font-medium">{fieldLabel(k)}:</span>
            <span className="text-gray-400 line-through">{formatAuditValue(before[k])}</span>
            <span className="text-gray-300">→</span>
            <span className="text-gray-700 font-medium">{formatAuditValue(after[k])}</span>
          </div>
        ))}
      </div>
    )
  }

  // Detalhes genéricos — chave: valor
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined)
  if (entries.length === 0) return null
  return (
    <div className="space-y-1 mt-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-400 font-medium">{fieldLabel(k)}:</span>
          <span className="text-gray-700">{formatAuditValue(v)}</span>
        </div>
      ))}
    </div>
  )
}

/** Histórico de alterações (quem alterou o quê) de um registro específico, a partir do AuditLog. */
export function AuditTrail({ entity, entityId }: { entity: string; entityId: string }) {
  const [logs, setLogs] = useState<AuditEntry[] | null>(null)

  useEffect(() => {
    let active = true
    setLogs(null)
    fetch(`/api/audit?entity=${encodeURIComponent(entity)}&entityId=${encodeURIComponent(entityId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (active) setLogs(data) })
      .catch(() => { if (active) setLogs([]) })
    return () => { active = false }
  }, [entity, entityId])

  if (logs === null) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
      </div>
    )
  }

  if (logs.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">Nenhuma alteração registrada</p>
  }

  return (
    <div className="space-y-2">
      {logs.map((entry) => (
        <div key={entry.id} className="bg-gray-50 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <ActionBadge action={entry.action} />
            <span className="text-xs font-medium text-gray-700">{entry.userName ?? 'Sistema'}</span>
            <span className="ml-auto text-xs text-gray-400">{formatDatetime(entry.createdAt)}</span>
          </div>
          {entry.details && Object.keys(entry.details).length > 0 && (
            <DiffDetails details={entry.details} />
          )}
        </div>
      ))}
    </div>
  )
}
