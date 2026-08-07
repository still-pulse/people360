'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Search, ExternalLink, Edit2, Trash2, FileSpreadsheet, Lock, RefreshCw,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react'
import {
  VagaData, VagaStatus, VAGA_STATUS_LABELS, VAGA_STATUS_COLORS, TIPO_VAGA_LABELS,
} from '@/types'
import { formatDate } from '@/lib/utils'
import { VagaModal } from '@/components/vagas/VagaModal'

export default function VagasListaPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === 'ADMIN'
  const canEdit = session?.user?.role !== 'JURIDICO'
  const canFilterAllUnits = ['ADMIN', 'JURIDICO', 'SUPERINTENDENT', 'GERENTE'].includes(session?.user?.role ?? '')
  const analystUnitIds: string[] = (session?.user as any)?.unitIds?.length
    ? (session?.user as any).unitIds
    : (session?.user?.unitId ? [session?.user?.unitId] : [])
  const analystUnitId = analystUnitIds[0] ?? null

  const [vagas, setVagas] = useState<VagaData[]>([])
  const [units, setUnits] = useState<{ id: string; name: string; color: string }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string; unitId?: string | null; managedUnits?: { unitId: string }[] }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editVaga, setEditVaga] = useState<VagaData | null>(null)

  const [search, setSearch] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [filterStatus, setFilterStatus] = useState<'' | 'abertas' | 'admissao' | 'fechadas' | 'canceladas'>('')
  const [filterType, setFilterType] = useState('')
  const [sortCol, setSortCol] = useState<'abertura' | 'prazo' | ''>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const CLOSED_STATUSES = ['CONTRATADA', 'FECHADA', 'CANCELADA']

  async function load() {
    setIsLoading(true)
    const params = filterUnit ? `?unitId=${filterUnit}` : ''
    const res = await fetch(`/api/vagas${params}`)
    setVagas(await res.json())
    setIsLoading(false)
  }

  useEffect(() => { load() }, [filterUnit, canFilterAllUnits])
  useEffect(() => {
    fetch('/api/units').then((r) => r.json()).then(setUnits)
    fetch('/api/users').then((r) => r.json()).then(setUsers)
  }, [])

  const filtered = useMemo(() => {
    const list = vagas.filter((v) => {
      if (search && !v.cargo.toLowerCase().includes(search.toLowerCase()) &&
        !v.titulo.toLowerCase().includes(search.toLowerCase()) &&
        !(v.municipio ?? '').toLowerCase().includes(search.toLowerCase())) return false
      if (filterStatus === 'abertas' && CLOSED_STATUSES.includes(v.status)) return false
      if (filterStatus === 'admissao' && v.status !== 'ADMISSAO_EM_ANDAMENTO') return false
      if (filterStatus === 'fechadas' && !['CONTRATADA', 'FECHADA'].includes(v.status)) return false
      if (filterStatus === 'canceladas' && v.status !== 'CANCELADA') return false
      if (filterType && v.tipoVaga !== filterType) return false
      return true
    })
    if (sortCol) {
      const field = sortCol === 'abertura' ? 'dataAbertura' : 'dataPrevistaFechamento'
      const mul = sortDir === 'asc' ? 1 : -1
      list.sort((a, b) => {
        const da = a[field] ? new Date(a[field]!).getTime() : 0
        const db = b[field] ? new Date(b[field]!).getTime() : 0
        return (da - db) * mul
      })
    }
    return list
  }, [vagas, search, filterStatus, filterType, sortCol, sortDir])

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta vaga? Todos os candidatos e histórico serão removidos.')) return
    await fetch(`/api/vagas/${id}`, { method: 'DELETE' })
    load()
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const rows = filtered.map((v) => ({
      'Cargo': v.cargo,
      'Título': v.titulo,
      'Unidade': v.unit?.name ?? '',
      'Município': v.municipio ?? '',
      'Setor': v.setor ?? '',
      'Tipo': TIPO_VAGA_LABELS[v.tipoVaga],
      'Qtd': v.quantidade,
      'Status': VAGA_STATUS_LABELS[v.status],
      'Analistas': (v as any).analistas?.map((a: any) => a.name).join(', ') ?? '',
      'Abertura': formatDate(v.dataAbertura),
      'Prazo': v.dataPrevistaFechamento ? formatDate(v.dataPrevistaFechamento) : '',
      'Candidatos': v._count?.candidatos ?? 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Vagas')
    XLSX.writeFile(wb, `vagas_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const analystUnit = units.find((u) => u.id === analystUnitId)

  const typeOptions = Object.entries(TIPO_VAGA_LABELS).map(([v, l]) => ({ value: v, label: l }))

  return (
    <>
      <Header title="Controle de Vagas" subtitle="Lista completa de vagas" />
      <div className="p-6 flex flex-col gap-5">

        {/* Tabs */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {[
              { label: 'Dashboard', href: '/vagas' },
              { label: 'Lista', href: '/vagas/lista' },
              { label: 'Controle', href: '/vagas/controle' },
            ].map((tab) => (
              <button key={tab.href} onClick={() => router.push(tab.href)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab.href === '/vagas/lista' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>{tab.label}</button>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm"
              icon={<FileSpreadsheet className="w-4 h-4 text-green-600" />}
              onClick={exportExcel} disabled={filtered.length === 0}>
              Excel
            </Button>
            {canEdit && (
              <Button icon={<Plus className="w-4 h-4" />}
                onClick={() => { setEditVaga(null); setModalOpen(true) }}>
                Nova Vaga
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vagas — {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</CardTitle>
            {!canFilterAllUnits && (
              analystUnitIds.length > 1 ? (
                <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
                  className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-600 outline-none focus:border-[#15AFA4]">
                  <option value="">Todas as minhas unidades</option>
                  {units.filter(u => analystUnitIds.includes(u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              ) : analystUnit && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: analystUnit.color }} />
                  {analystUnit.name}
                  <Lock className="w-3.5 h-3.5" />
                </div>
              )
            )}
          </CardHeader>

          {/* Filtros */}
          <div className="px-5 pb-4 flex flex-wrap gap-2 border-b border-gray-50">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cargo, título ou município..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4]" />
            </div>
            {canFilterAllUnits && (
              <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white">
                <option value="">Todas as unidades</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white">
              <option value="">Todas</option>
              <option value="abertas">Abertas</option>
              <option value="admissao">Admissão em Andamento</option>
              <option value="fechadas">Fechadas</option>
              <option value="canceladas">Canceladas</option>
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white">
              <option value="">Todos os tipos</option>
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={load} className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-12 animate-pulse bg-gray-50 rounded-xl"/>)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-100">
                  <tr>
                    {['Cargo', 'Unidade', 'Tipo', 'Qtd', 'Analista', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                    {([['Abertura', 'abertura'], ['Prazo', 'prazo']] as const).map(([label, col]) => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <button className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
                          onClick={() => { if (sortCol === col) { setSortDir(sortDir === 'asc' ? 'desc' : 'asc') } else { setSortCol(col); setSortDir('desc') } }}>
                          {label}
                          {sortCol === col
                            ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                            : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                        </button>
                      </th>
                    ))}
                    {['Cand.', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Nenhuma vaga encontrada</td></tr>
                  )}
                  {filtered.map((v) => {
                    const isOverdue = v.dataPrevistaFechamento &&
                      new Date(v.dataPrevistaFechamento) < new Date() &&
                      !['CONTRATADA', 'FECHADA', 'CANCELADA'].includes(v.status)
                    return (
                      <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {v.unit && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.unit.color }} />}
                            <span className="font-medium text-gray-900">{v.cargo}</span>
                          </div>
                          {v.municipio && <p className="text-xs text-gray-400 mt-0.5">{v.municipio}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{v.unit?.name ?? '—'}</td>
                        <td className="px-4 py-3"><Badge variant="secondary">{TIPO_VAGA_LABELS[v.tipoVaga]}</Badge></td>
                        <td className="px-4 py-3 text-gray-700 font-medium">{v.quantidade}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{(v as any).analistas?.map((a: any) => a.name).join(', ') || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: VAGA_STATUS_COLORS[v.status] + '18', color: VAGA_STATUS_COLORS[v.status] }}>
                            {VAGA_STATUS_LABELS[v.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(v.dataAbertura)}</td>
                        <td className="px-4 py-3 text-xs">
                          {v.dataPrevistaFechamento ? (
                            <span className={isOverdue ? 'text-red-500 font-semibold' : 'text-gray-500'}>
                              {formatDate(v.dataPrevistaFechamento)}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-medium">{v._count?.candidatos ?? 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => router.push(`/vagas/${v.id}`)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#15AFA4] hover:bg-[#15AFA4]/10 transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            {canEdit && (
                              <button onClick={() => { setEditVaga(v); setModalOpen(true) }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isAdmin && (
                              <button onClick={() => handleDelete(v.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {canEdit && (
        <VagaModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditVaga(null) }}
          onSaved={load}
          vaga={editVaga}
          units={units}
          users={users}
          isAdmin={isAdmin}
          analystUnitIds={analystUnitIds}
        />
      )}
    </>
  )
}
