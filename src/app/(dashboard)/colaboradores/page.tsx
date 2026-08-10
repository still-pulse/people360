'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Search, RefreshCw, Users, UserCheck, UserX, Building2, Briefcase,
  Phone, Mail, ChevronLeft, ChevronRight, Accessibility,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

interface ColaboradorRow {
  id: string
  erpnextId: string
  employeeName: string
  status: string
  company?: string | null
  department?: string | null
  designation?: string | null
  cellNumber?: string | null
  personalEmail?: string | null
  dateOfJoining?: string | null
  pcd?: boolean
  unit?: { id: string; name: string; color: string } | null
}

interface Meta {
  total: number
  active: number
  left: number
  lastSyncAt?: string | null
  companies: string[]
}

const STATUS_LABEL: Record<string, string> = {
  Active: 'Ativo',
  Left: 'Desligado',
  Suspended: 'Suspenso',
  Inactive: 'Inativo',
}

export default function ColaboradoresPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === 'ADMIN'

  const [rows, setRows] = useState<ColaboradorRow[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('Active')
  const [company, setCompany] = useState('')
  const [pcdOnly, setPcdOnly] = useState(false)

  const loadMeta = useCallback(async () => {
    const res = await fetch('/api/colaboradores/meta')
    if (res.ok) setMeta(await res.json())
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '30' })
    if (search.trim()) params.set('search', search.trim())
    if (status) params.set('status', status)
    if (company) params.set('company', company)
    if (pcdOnly) params.set('pcd', '1')
    const res = await fetch(`/api/colaboradores?${params}`)
    if (res.ok) {
      const data = await res.json()
      setRows(data.data)
      setTotal(data.total)
      setPages(data.pages)
    }
    setLoading(false)
  }, [page, search, status, company, pcdOnly])

  useEffect(() => { loadMeta() }, [loadMeta])
  useEffect(() => { load() }, [load])

  // debounce search reset page
  useEffect(() => {
    setPage(1)
  }, [search, status, company, pcdOnly])

  async function sync() {
    if (!isAdmin) return
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/colaboradores/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // todos os status
      })
      const data = await res.json()
      if (!res.ok) {
        setSyncMsg(data.error || 'Falha no sync')
      } else if (!data.configured) {
        setSyncMsg('ERPNext não configurado no servidor.')
      } else {
        setSyncMsg(
          `Sync: ${data.upserted}/${data.totalRemote} colaboradores · ${data.pages} páginas` +
            (data.errors?.length ? ` · ${data.errors.length} erro(s)` : ''),
        )
        await loadMeta()
        await load()
      }
    } catch {
      setSyncMsg('Falha de rede no sync.')
    }
    setSyncing(false)
  }

  return (
    <>
      <Header
        title="Colaboradores"
        subtitle={
          meta
            ? `${meta.active.toLocaleString('pt-BR')} ativos · ${meta.total.toLocaleString('pt-BR')} no cadastro`
            : 'Espelho do Employee (ERPNext)'
        }
      />

      <div className="p-6 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Users className="w-3.5 h-3.5" /> Total
            </div>
            <p className="text-2xl font-bold text-gray-900">{meta?.total ?? '—'}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-green-600 mb-1">
              <UserCheck className="w-3.5 h-3.5" /> Ativos
            </div>
            <p className="text-2xl font-bold text-green-700">{meta?.active ?? '—'}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <UserX className="w-3.5 h-3.5" /> Desligados
            </div>
            <p className="text-2xl font-bold text-gray-600">{meta?.left ?? '—'}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <RefreshCw className="w-3.5 h-3.5" /> Último sync
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {meta?.lastSyncAt
                ? new Date(meta.lastSyncAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                : 'Nunca'}
            </p>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, matrícula, cargo, e-mail, CPF…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#15AFA4]/30"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
          >
            <option value="">Todos os status</option>
            <option value="Active">Ativos</option>
            <option value="Left">Desligados</option>
            <option value="Suspended">Suspensos</option>
          </select>
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white max-w-[220px]"
          >
            <option value="">Todas as unidades</option>
            {(meta?.companies || []).map((c) => (
              <option key={c} value={c!}>{c}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none px-2">
            <input
              type="checkbox"
              checked={pcdOnly}
              onChange={(e) => setPcdOnly(e.target.checked)}
              className="rounded accent-[#15AFA4]"
            />
            Só PCD
          </label>
          {isAdmin && (
            <div className="flex items-center gap-2 ml-auto">
              {syncMsg && <span className="text-xs text-gray-500 max-w-xs truncate">{syncMsg}</span>}
              <Button variant="outline" size="sm" disabled={syncing} onClick={sync} icon={<RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />}>
                {syncing ? 'Sincronizando…' : 'Sincronizar ERPNext'}
              </Button>
            </div>
          )}
        </div>

        {/* Tabela */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum colaborador encontrado</p>
              <p className="text-xs text-gray-400 mt-1">
                {meta?.total === 0 && isAdmin
                  ? 'Clique em “Sincronizar ERPNext” para importar o cadastro de Employee.'
                  : 'Ajuste os filtros de busca.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">Cargo</th>
                    <th className="px-4 py-3">Unidade / Setor</th>
                    <th className="px-4 py-3">Contato</th>
                    <th className="px-4 py-3">Admissão</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/colaboradores/${r.id}`)}
                      className="border-b border-gray-50 hover:bg-[#15AFA4]/5 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{r.employeeName}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{r.erpnextId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate max-w-[180px]">{r.designation || '—'}</span>
                        </div>
                        {r.pcd && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            <Accessibility className="w-3 h-3" /> PCD
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {r.unit?.name || r.company?.split(' - ')[0] || '—'}
                          </span>
                        </div>
                        {r.department && (
                          <div className="text-[11px] text-gray-400 truncate max-w-[200px] mt-0.5">{r.department}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.cellNumber && (
                          <div className="flex items-center gap-1 text-xs">
                            <Phone className="w-3 h-3 text-gray-400" />{r.cellNumber}
                          </div>
                        )}
                        {r.personalEmail && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 truncate max-w-[160px]">
                            <Mail className="w-3 h-3" />{r.personalEmail}
                          </div>
                        )}
                        {!r.cellNumber && !r.personalEmail && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {r.dateOfJoining ? formatDate(r.dateOfJoining) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          r.status === 'Active' ? 'bg-green-50 text-green-700' :
                          r.status === 'Left' ? 'bg-gray-100 text-gray-600' :
                          'bg-amber-50 text-amber-700',
                        )}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
              <span>
                {total.toLocaleString('pt-BR')} registro(s) · página {page}/{pages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
