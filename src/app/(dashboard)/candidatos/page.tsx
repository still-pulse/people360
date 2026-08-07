'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus, Search, Edit2, Trash2, FileSpreadsheet, RefreshCw,
  ArrowUp, ArrowDown, ArrowUpDown, Lock, Unlock, LayoutDashboard, List,
  Trophy, Users, UserCheck, XCircle, Clock,
} from 'lucide-react'
import {
  ControleCandidatoData, ControleCandidatoStatus,
  CONTROLE_CANDIDATO_STATUS_LABELS, CONTROLE_CANDIDATO_STATUS_COLORS,
  CandidatosMonthSnapshotData, MONTHS_PT,
} from '@/types'
import { formatDate } from '@/lib/utils'
import { CandidatoControleModal } from '@/components/candidatos/CandidatoControleModal'

type SortCol = 'dataProcesso' | 'nome' | ''
type Tab = 'lista' | 'dashboard'

const STATUS_ORDER: ControleCandidatoStatus[] = ['BANCO_TALENTOS', 'CONTRATADO', 'REPROVADO', 'DESISTIU']

// ─── Analytics helpers ────────────────────────────────────────────────────────

interface AnalistaStats {
  id: string
  name: string
  total: number
  BANCO_TALENTOS: number
  CONTRATADO: number
  REPROVADO: number
  DESISTIU: number
  topFuncoes: { funcao: string; count: number }[]
}

interface FuncaoStats { funcao: string; count: number }

function computeAnalytics(candidatos: ControleCandidatoData[]) {
  const analistaMap = new Map<string, AnalistaStats & { funcoes: Map<string, number> }>()
  const funcaoMap = new Map<string, number>()

  for (const c of candidatos) {
    const entries = c.analistas?.length
      ? c.analistas.map((a) => ({ id: a.id, name: a.name }))
      : [{ id: '__sem__', name: 'Sem analista' }]

    for (const { id, name } of entries) {
      if (!analistaMap.has(id)) {
        analistaMap.set(id, {
          id, name, total: 0,
          BANCO_TALENTOS: 0, CONTRATADO: 0, REPROVADO: 0, DESISTIU: 0,
          funcoes: new Map(), topFuncoes: [],
        })
      }
      const a = analistaMap.get(id)!
      a.total++
      a[c.status as keyof Pick<AnalistaStats, 'BANCO_TALENTOS' | 'CONTRATADO' | 'REPROVADO' | 'DESISTIU'>]++
      a.funcoes.set(c.funcao, (a.funcoes.get(c.funcao) ?? 0) + 1)
    }
    funcaoMap.set(c.funcao, (funcaoMap.get(c.funcao) ?? 0) + 1)
  }

  const analistaList: AnalistaStats[] = Array.from(analistaMap.values())
    .map(({ funcoes, ...rest }) => ({
      ...rest,
      topFuncoes: Array.from(funcoes.entries())
        .map(([funcao, count]) => ({ funcao, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4),
    }))
    .sort((a, b) => b.total - a.total)

  const funcaoList: FuncaoStats[] = Array.from(funcaoMap.entries())
    .map(([funcao, count]) => ({ funcao, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return { analistaList, funcaoList }
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ isAdmin }: { isAdmin: boolean }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [candidatos, setCandidatos] = useState<ControleCandidatoData[]>([])
  const [snapshot, setSnapshot] = useState<CandidatosMonthSnapshotData | null>(null)
  const [snapshots, setSnapshots] = useState<CandidatosMonthSnapshotData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isClosing, setIsClosing] = useState(false)
  const [expandedAnalista, setExpandedAnalista] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    const [lista, snap, snaps] = await Promise.all([
      fetch(`/api/candidatos-controle?year=${year}&month=${month}`).then((r) => r.json()),
      fetch(`/api/candidatos-controle/dashboard?year=${year}&month=${month}`).then((r) => r.json()),
      fetch('/api/candidatos-controle/snapshots').then((r) => r.json()),
    ])
    setCandidatos(Array.isArray(lista) ? lista : [])
    setSnapshot(snap?.snapshot ?? null)
    setSnapshots(Array.isArray(snaps) ? snaps : [])
    setIsLoading(false)
  }

  useEffect(() => { load() }, [year, month])

  const { analistaList, funcaoList } = useMemo(() => computeAnalytics(candidatos), [candidatos])

  const isFrozen = !!snapshot

  // KPIs: se tem snapshot usa dados congelados, senão computa ao vivo
  const kpis = useMemo(() => {
    if (isFrozen && snapshot) {
      return {
        total: snapshot.total,
        BANCO_TALENTOS: snapshot.bancoTalentos,
        CONTRATADO: snapshot.contratado,
        REPROVADO: snapshot.reprovado,
        DESISTIU: snapshot.desistiu,
      }
    }
    const counts = { total: candidatos.length, BANCO_TALENTOS: 0, CONTRATADO: 0, REPROVADO: 0, DESISTIU: 0 }
    for (const c of candidatos) counts[c.status as keyof typeof counts]++
    return counts
  }, [candidatos, snapshot, isFrozen])

  async function handleCloseMonth() {
    if (!confirm(`Fechar ${MONTHS_PT[month - 1]}/${year}? Os KPIs ficarão congelados.`)) return
    setIsClosing(true)
    const res = await fetch('/api/candidatos-controle/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month }),
    })
    setIsClosing(false)
    if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Erro ao fechar mês.') }
    else load()
  }

  async function handleReopenMonth() {
    if (!confirm(`Reabrir ${MONTHS_PT[month - 1]}/${year}? O snapshot será excluído.`)) return
    await fetch('/api/candidatos-controle/snapshots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month }),
    })
    load()
  }

  const yearOptions = now.getMonth() === 11
    ? [now.getFullYear(), now.getFullYear() + 1]
    : [now.getFullYear()]
  const maxAnalista = analistaList[0]?.total ?? 1

  const kpiCards = [
    { label: 'Total de Processos', value: kpis.total, icon: Users, color: '#15AFA4' },
    { label: CONTROLE_CANDIDATO_STATUS_LABELS.BANCO_TALENTOS, value: kpis.BANCO_TALENTOS, icon: Clock, color: CONTROLE_CANDIDATO_STATUS_COLORS.BANCO_TALENTOS },
    { label: CONTROLE_CANDIDATO_STATUS_LABELS.CONTRATADO, value: kpis.CONTRATADO, icon: UserCheck, color: CONTROLE_CANDIDATO_STATUS_COLORS.CONTRATADO },
    { label: CONTROLE_CANDIDATO_STATUS_LABELS.REPROVADO, value: kpis.REPROVADO, icon: XCircle, color: CONTROLE_CANDIDATO_STATUS_COLORS.REPROVADO },
    { label: CONTROLE_CANDIDATO_STATUS_LABELS.DESISTIU, value: kpis.DESISTIU, icon: ArrowDown, color: CONTROLE_CANDIDATO_STATUS_COLORS.DESISTIU },
  ]

  return (
    <div className="space-y-5">

      {/* Filtros + controle do mês */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ano</label>
          <div className="flex gap-1">
            {yearOptions.map((y) => (
              <button key={y} onClick={() => setYear(y)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  year === y ? 'bg-[#15AFA4] text-white border-[#15AFA4]' : 'border-gray-200 text-gray-600 hover:border-[#15AFA4]/40'
                }`}>
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mês</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white min-w-[140px]">
            {MONTHS_PT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {isFrozen ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-100">
                <Lock className="w-3 h-3" /> Mês fechado
              </span>
              {isAdmin && (
                <button onClick={handleReopenMonth}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors">
                  <Unlock className="w-3 h-3" /> Reabrir
                </button>
              )}
            </>
          ) : isAdmin ? (
            <Button size="sm" icon={<Lock className="w-3.5 h-3.5" />}
              onClick={handleCloseMonth} disabled={isClosing}
              style={{ background: '#F97316' }}>
              {isClosing ? 'Fechando...' : `Fechar ${MONTHS_PT[month - 1]}`}
            </Button>
          ) : null}
          {snapshot && (
            <span className="text-xs text-gray-400">
              Fechado por {snapshot.createdBy?.name ?? '—'} em {formatDate(snapshot.createdAt)}
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map((i) => <div key={i} className="h-28 animate-pulse bg-white rounded-2xl border border-gray-100" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {kpiCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color + '18' }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <p className="text-xs text-gray-500 font-medium leading-tight mb-1">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              {isFrozen && <p className="text-xs text-amber-500 mt-1 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> congelado</p>}
            </div>
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Ranking de Analistas */}
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Ranking de Analistas — {MONTHS_PT[month - 1]}/{year}
              </CardTitle>
              <span className="text-xs text-gray-400">{candidatos.length} processo{candidatos.length !== 1 ? 's' : ''} seletivo{candidatos.length !== 1 ? 's' : ''} no período</span>
            </CardHeader>
            {analistaList.length === 0 ? (
              <div className="px-5 pb-8 text-center text-gray-400 text-sm">Nenhum processo seletivo neste mês</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Analista</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.BANCO_TALENTOS }}>B. Talentos</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.CONTRATADO }}>Contratados</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.REPROVADO }}>Reprovados</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.DESISTIU }}>Desistiram</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {analistaList.map((a, idx) => (
                      <>
                        <tr
                          key={a.id}
                          onClick={() => setExpandedAnalista(expandedAnalista === a.id ? null : a.id)}
                          className={`cursor-pointer transition-colors ${
                            idx === 0 ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-gray-50/60'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className={`font-bold text-sm ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className={`font-semibold ${idx === 0 ? 'text-amber-700' : 'text-gray-800'}`}>{a.name}</p>
                              <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-32">
                                <div className="h-full rounded-full bg-[#15AFA4] transition-all"
                                  style={{ width: `${(a.total / maxAnalista) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-gray-900 text-base">{a.total}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.BANCO_TALENTOS }}>{a.BANCO_TALENTOS}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.CONTRATADO }}>{a.CONTRATADO}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.REPROVADO }}>{a.REPROVADO}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.DESISTIU }}>{a.DESISTIU}</span>
                          </td>
                        </tr>
                        {expandedAnalista === a.id && a.topFuncoes.length > 0 && (
                          <tr key={`${a.id}-expand`} className={idx === 0 ? 'bg-amber-50/40' : 'bg-gray-50/40'}>
                            <td />
                            <td colSpan={6} className="px-4 py-2.5 pb-3">
                              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">
                                Funções mais selecionadas por {a.name.split(' ')[0]}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {a.topFuncoes.map(({ funcao, count }) => (
                                  <span key={funcao} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-700">
                                    <span className="font-bold text-[#15AFA4]">{count}</span>
                                    {funcao}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Top Funções */}
          <Card>
            <CardHeader>
              <CardTitle>Funções mais selecionadas</CardTitle>
              <span className="text-xs text-gray-400">Top {funcaoList.length} do período</span>
            </CardHeader>
            <CardContent>
              {funcaoList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sem dados</p>
              ) : (
                <div className="space-y-3">
                  {funcaoList.map(({ funcao, count }, i) => {
                    const pct = Math.round((count / (funcaoList[0]?.count ?? 1)) * 100)
                    return (
                      <div key={funcao}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700 truncate max-w-[160px]" title={funcao}>{funcao}</span>
                          <span className="font-bold text-[#15AFA4] ml-2 flex-shrink-0">{count}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: i === 0 ? '#15AFA4' : i === 1 ? '#3B82F6' : i === 2 ? '#8B5CF6' : '#94A3B8' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Histórico de meses fechados */}
      {snapshots.length > 0 && !isLoading && (
        <Card>
          <CardHeader><CardTitle>Histórico de Meses Fechados</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>
                  {['Mês/Ano', 'Total', 'B. Talentos', 'Contratados', 'Reprovados', 'Desistiram', 'Fechado por'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {snapshots.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 cursor-pointer"
                    onClick={() => { setYear(s.year); setMonth(s.month) }}>
                    <td className="px-4 py-3 font-semibold text-gray-800">{MONTHS_PT[s.month - 1]}/{s.year}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{s.total}</td>
                    <td className="px-4 py-3"><span className="font-semibold" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.BANCO_TALENTOS }}>{s.bancoTalentos}</span></td>
                    <td className="px-4 py-3"><span className="font-semibold" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.CONTRATADO }}>{s.contratado}</span></td>
                    <td className="px-4 py-3"><span className="font-semibold" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.REPROVADO }}>{s.reprovado}</span></td>
                    <td className="px-4 py-3"><span className="font-semibold" style={{ color: CONTROLE_CANDIDATO_STATUS_COLORS.DESISTIU }}>{s.desistiu}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.createdBy?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Lista Tab ────────────────────────────────────────────────────────────────

function ListaTab({ isAdmin }: { isAdmin: boolean }) {
  const [candidatos, setCandidatos] = useState<ControleCandidatoData[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editCandidato, setEditCandidato] = useState<ControleCandidatoData | null>(null)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ControleCandidatoStatus | ''>('')
  const [filterAnalista, setFilterAnalista] = useState('')
  const [filterMunicipio, setFilterMunicipio] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('dataProcesso')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  async function load() {
    setIsLoading(true)
    const res = await fetch('/api/candidatos-controle')
    setCandidatos(await res.json())
    setIsLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { fetch('/api/users').then((r) => r.json()).then(setUsers) }, [])

  const municipios = useMemo(() => {
    const set = new Set(candidatos.map((c) => c.municipio).filter(Boolean) as string[])
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [candidatos])

  const filtered = useMemo(() => {
    const list = candidatos.filter((c) => {
      if (filterStatus && c.status !== filterStatus) return false
      if (filterAnalista && !c.analistas?.some((a) => a.id === filterAnalista)) return false
      if (filterMunicipio && (c.municipio ?? '') !== filterMunicipio) return false
      if (search) {
        const q = search.toLowerCase()
        if (!c.nome.toLowerCase().includes(q) && !c.funcao.toLowerCase().includes(q) &&
          !(c.municipio ?? '').toLowerCase().includes(q) && !(c.telefone ?? '').includes(q)) return false
      }
      return true
    })
    if (sortCol) {
      const mul = sortDir === 'asc' ? 1 : -1
      list.sort((a, b) => {
        if (sortCol === 'nome') return a.nome.localeCompare(b.nome) * mul
        return (new Date(a.dataProcesso).getTime() - new Date(b.dataProcesso).getTime()) * mul
      })
    }
    return list
  }, [candidatos, search, filterStatus, filterAnalista, filterMunicipio, sortCol, sortDir])

  async function handleDelete(id: string) {
    if (!confirm('Excluir este candidato?')) return
    await fetch(`/api/candidatos-controle/${id}`, { method: 'DELETE' })
    load()
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const rows = filtered.map((c) => ({
      'Nome': c.nome, 'Telefone': c.telefone ?? '', 'Função': c.funcao,
      'Data do Processo': formatDate(c.dataProcesso), 'Analistas': c.analistas?.map((a) => a.name).join(', ') ?? '',
      'Município': c.municipio ?? '', 'Status': CONTROLE_CANDIDATO_STATUS_LABELS[c.status],
      'Observações': (c as any).observacoes ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Candidatos')
    XLSX.writeFile(wb, `candidatos_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('desc') }
  }

  const sortIcon = (col: SortCol) =>
    sortCol === col
      ? sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
      : <ArrowUpDown className="w-3 h-3 opacity-40" />

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Candidatos — {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</CardTitle>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm"
              icon={<FileSpreadsheet className="w-4 h-4 text-green-600" />}
              onClick={exportExcel} disabled={filtered.length === 0}>
              Excel
            </Button>
            <Button icon={<Plus className="w-4 h-4" />}
              onClick={() => { setEditCandidato(null); setModalOpen(true) }}>
              Novo Candidato
            </Button>
          </div>
        </CardHeader>

        <div className="px-5 pb-4 flex flex-wrap gap-2 border-b border-gray-50">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, função, município..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4]" />
          </div>
          <select value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ControleCandidatoStatus | '')}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white">
            <option value="">Todos os status</option>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{CONTROLE_CANDIDATO_STATUS_LABELS[s]}</option>)}
          </select>
          <select value={filterMunicipio}
            onChange={(e) => setFilterMunicipio(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white">
            <option value="">Todos os municípios</option>
            {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {isAdmin && (
            <select value={filterAnalista} onChange={(e) => setFilterAnalista(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white">
              <option value="">Todos os analistas</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <button onClick={load} className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-12 animate-pulse bg-gray-50 rounded-xl" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <button className="inline-flex items-center gap-1 hover:text-gray-700" onClick={() => toggleSort('nome')}>
                      Nome {sortIcon('nome')}
                    </button>
                  </th>
                  {['Telefone', 'Função', 'Analista', 'Município', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <button className="inline-flex items-center gap-1 hover:text-gray-700" onClick={() => toggleSort('dataProcesso')}>
                      Data Processo {sortIcon('dataProcesso')}
                    </button>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Nenhum candidato encontrado</td></tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.telefone ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{c.funcao}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{c.analistas?.map((a) => a.name).join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.municipio ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: CONTROLE_CANDIDATO_STATUS_COLORS[c.status] + '18', color: CONTROLE_CANDIDATO_STATUS_COLORS[c.status] }}>
                        {CONTROLE_CANDIDATO_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(c.dataProcesso)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditCandidato(c); setModalOpen(true) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <button onClick={() => handleDelete(c.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <CandidatoControleModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditCandidato(null) }}
        onSaved={load}
        candidato={editCandidato}
        users={users}
        isAdmin={isAdmin}
      />
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ControleCandidatosPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <>
      <Header title="Controle de Candidatos" subtitle="Processos seletivos — ranking e banco de talentos" />
      <div className="p-6 flex flex-col gap-5">

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {([
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'lista', label: 'Lista', icon: List },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && <DashboardTab isAdmin={isAdmin} />}
        {tab === 'lista' && <ListaTab isAdmin={isAdmin} />}
      </div>
    </>
  )
}
