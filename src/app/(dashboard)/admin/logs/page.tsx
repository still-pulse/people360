'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Search, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from 'lucide-react'
import { ACTION_META, ActionBadge } from '@/lib/auditMeta'

interface LogEntry {
  id: string
  userId?: string | null
  userName?: string | null
  userRole?: string | null
  action: string
  entity: string
  entityId?: string | null
  entityName?: string | null
  details?: Record<string, unknown> | null
  ip?: string | null
  createdAt: string
}

const ENTITIES = ['Tarefa', 'Evento', 'Vaga', 'Usuário', 'Unidade', 'Cargo', 'Perfil', 'Configuração', 'Logo', 'Sessão']
const ACTIONS  = Object.keys(ACTION_META)

function formatDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function DetailsPanel({ details }: { details: Record<string, unknown> }) {
  const render = (val: unknown, depth = 0): React.ReactNode => {
    if (val === null || val === undefined) return <span className="text-gray-400">—</span>
    if (typeof val === 'boolean') return <span className={val ? 'text-green-600' : 'text-red-500'}>{val ? 'sim' : 'não'}</span>
    if (typeof val !== 'object') return <span className="text-gray-700">{String(val)}</span>
    if (Array.isArray(val)) return <span className="text-gray-600">[{val.join(', ')}]</span>
    return (
      <div className={`${depth > 0 ? 'pl-3 border-l border-gray-200 mt-1' : ''} space-y-1`}>
        {Object.entries(val as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="flex gap-2 text-xs">
            <span className="text-gray-400 font-medium min-w-[80px] flex-shrink-0">{k}:</span>
            {render(v, depth + 1)}
          </div>
        ))}
      </div>
    )
  }
  return <div className="text-xs">{render(details)}</div>
}

export default function LogsPage() {
  const [logs, setLogs]       = useState<LogEntry[]>([])
  const [total, setTotal]     = useState(0)
  const [pages, setPages]     = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [page,     setPage]     = useState(1)
  const [search,   setSearch]   = useState('')
  const [entity,   setEntity]   = useState('')
  const [action,   setAction]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    if (search)   params.set('search', search)
    if (entity)   params.set('entity', entity)
    if (action)   params.set('action', action)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo)   params.set('dateTo', dateTo)

    const res = await fetch(`/api/admin/logs?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
      setPages(data.pages)
    }
    setLoading(false)
  }, [page, search, entity, action, dateFrom, dateTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function handleFilter() { setPage(1); fetchLogs() }

  function clearFilters() {
    setSearch(''); setEntity(''); setAction(''); setDateFrom(''); setDateTo('')
    setPage(1)
  }

  function exportCSV() {
    const params = new URLSearchParams()
    if (entity)   params.set('entity', entity)
    if (action)   params.set('action', action)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo)   params.set('dateTo', dateTo)
    window.open(`/api/admin/logs/export?${params}`, '_blank')
  }

  const hasFilters = !!(search || entity || action || dateFrom || dateTo)

  return (
    <>
      <Header title="Logs de Auditoria" subtitle="Registro completo de todas as ações no sistema" />
      <div className="p-6 space-y-5">

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                placeholder="Buscar por usuário ou item..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
              />
            </div>

            <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1) }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white text-gray-700 outline-none focus:border-[#15AFA4]">
              <option value="">Todas as entidades</option>
              {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>

            <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white text-gray-700 outline-none focus:border-[#15AFA4]">
              <option value="">Todas as ações</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_META[a].label}</option>)}
            </select>

            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4]" />
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4]" />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {loading ? 'Carregando...' : `${total.toLocaleString('pt-BR')} registro${total !== 1 ? 's' : ''}`}
            </p>
            <div className="flex gap-2">
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>
              )}
              <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportCSV}>
                Exportar CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Carregando...</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
              <Search className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nenhum log encontrado</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide">
                  <th className="text-left px-4 py-3 w-44">Data / Hora</th>
                  <th className="text-left px-4 py-3">Usuário</th>
                  <th className="text-left px-4 py-3 w-36">Ação</th>
                  <th className="text-left px-4 py-3 w-28">Entidade</th>
                  <th className="text-left px-4 py-3">Item</th>
                  <th className="text-left px-4 py-3 w-32">IP</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <>
                    <tr key={log.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                        {formatDt(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{log.userName ?? '—'}</div>
                        {log.userRole && (
                          <div className="text-xs text-gray-400">{log.userRole === 'ADMIN' ? 'Administrador' : 'Analista'}</div>
                        )}
                      </td>
                      <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                      <td className="px-4 py-3 text-gray-600">{log.entity}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{log.entityName ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{log.ip ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {log.details && (
                          expanded === log.id
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />
                        )}
                      </td>
                    </tr>
                    {expanded === log.id && log.details && (
                      <tr key={`${log.id}-detail`} className="bg-gray-50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Detalhes</p>
                            <DetailsPanel details={log.details as Record<string, unknown>} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
        {pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Página {page} de {pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" icon={<ChevronLeft className="w-4 h-4" />}
                disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>
                Próxima <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
