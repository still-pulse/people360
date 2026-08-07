'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Search, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'

interface EmailLogEntry {
  id: string
  to: string
  subject: string
  status: 'SUCCESS' | 'ERROR'
  response?: string | null
  createdAt: string
}

function formatDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'SUCCESS') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-600 text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" /> Enviado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium">
      <XCircle className="w-3.5 h-3.5" /> Falha
    </span>
  )
}

export default function EmailLogsPage() {
  const [logs, setLogs]       = useState<EmailLogEntry[]>([])
  const [total, setTotal]     = useState(0)
  const [pages, setPages]     = useState(1)
  const [loading, setLoading] = useState(true)

  const [page,     setPage]     = useState(1)
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    if (search)   params.set('search', search)
    if (status)   params.set('status', status)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo)   params.set('dateTo', dateTo)

    const res = await fetch(`/api/admin/email-logs?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
      setPages(data.pages)
    }
    setLoading(false)
  }, [page, search, status, dateFrom, dateTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function handleFilter() { setPage(1); fetchLogs() }

  function clearFilters() {
    setSearch(''); setStatus(''); setDateFrom(''); setDateTo('')
    setPage(1)
  }

  const hasFilters = !!(search || status || dateFrom || dateTo)

  return (
    <>
      <Header title="Logs de E-mails" subtitle="Histórico de notificações enviadas por e-mail" />
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
                placeholder="Buscar por destinatário ou assunto..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
              />
            </div>

            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white text-gray-700 outline-none focus:border-[#15AFA4]">
              <option value="">Todos os status</option>
              <option value="SUCCESS">Enviado</option>
              <option value="ERROR">Falha</option>
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
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>
            )}
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
            <div className="overflow-auto max-h-[65vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide">
                    <th className="text-left px-4 py-3 w-44">Data / Hora</th>
                    <th className="text-left px-4 py-3">Destinatário</th>
                    <th className="text-left px-4 py-3">Assunto</th>
                    <th className="text-left px-4 py-3 w-28">Status</th>
                    <th className="text-left px-4 py-3">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                        {formatDt(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{log.to}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[280px] truncate">{log.subject}</td>
                      <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[260px] truncate" title={log.response ?? ''}>
                        {log.response ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
