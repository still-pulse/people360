'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Plus, Edit2, Camera, TrendingUp, TrendingDown, Minus, CalendarPlus, Trash2, FileText } from 'lucide-react'
import { MONTHS_PT, PCDIndicatorData, PcdWeeklySnapshotData } from '@/types'
import { calculatePCDMinimum, unitVisibleInIndicators } from '@/lib/utils'
import { PCDRelatorioExecutivo } from '@/components/pcd/PCDRelatorioExecutivo'

interface Unit {
  id: string
  name: string
  color: string
  exibirIndicadores?: boolean
  indicadoresAteYear?: number | null
  indicadoresAteMonth?: number | null
}

const currentYear = new Date().getFullYear()
const years = [currentYear, currentYear - 1, currentYear - 2]
const monthOptions = MONTHS_PT.map((label, i) => ({ value: String(i + 1), label }))

function formatWeekDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}


export default function PCDPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const canEdit = session?.user?.role !== 'JURIDICO'

  const [data, setData] = useState<PCDIndicatorData[]>([])
  const [weeklyData, setWeeklyData] = useState<PcdWeeklySnapshotData[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterUnit, setFilterUnit] = useState('')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<PCDIndicatorData | null>(null)
  const [tableView, setTableView] = useState<'atual' | 'semanal'>('atual')
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  const [relatorioOpen, setRelatorioOpen] = useState(false)
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [manualDate, setManualDate] = useState('')
  const [manualEntries, setManualEntries] = useState<Record<string, number>>({})
  const [manualSaving, setManualSaving] = useState(false)

  const [form, setForm] = useState({
    unitId: '',
    year: currentYear,
    month: new Date().getMonth() + 1,
    totalEmployees: 0,
    metaPercentage: 5,
    currentPcd: 0,
  })

  async function loadData() {
    const params = new URLSearchParams({ year: String(filterYear) })
    if (filterUnit) params.set('unitId', filterUnit)
    const res = await fetch(`/api/indicators/pcd?${params}`)
    const d = await res.json()
    setData(d)
  }

  async function loadWeeklyData() {
    const params = new URLSearchParams({ year: String(filterYear) })
    if (filterUnit) params.set('unitId', filterUnit)
    const res = await fetch(`/api/indicators/pcd/weekly?${params}`)
    const d = await res.json()
    setWeeklyData(d)
  }

  useEffect(() => { loadData() }, [filterYear, filterUnit])
  useEffect(() => { loadWeeklyData() }, [filterYear, filterUnit])
  useEffect(() => {
    fetch('/api/units?indicadores=true').then((r) => r.json()).then(setUnits)
  }, [])

  async function handleSave() {
    await fetch('/api/indicators/pcd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setModalOpen(false)
    setEditItem(null)
    loadData()
  }

  async function handleSnapshot() {
    setSnapshotLoading(true)
    try {
      await fetch('/api/indicators/pcd/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      await loadWeeklyData()
    } finally {
      setSnapshotLoading(false)
    }
  }

  function openManualModal() {
    const initial: Record<string, number> = {}
    unitsForMonth(filterMonth, filterYear).forEach((u) => {
      const item = data.find((d) => d.unitId === u.id && d.month === filterMonth)
      initial[u.id] = item?.currentPcd ?? 0
    })
    setManualEntries(initial)
    setManualDate('')
    setManualModalOpen(true)
  }


  async function handleManualSave() {
    if (!manualDate) return
    setManualSaving(true)
    try {
      const week = new Date(manualDate + 'T12:00:00Z')
      const weekUnits = unitsForMonth(week.getUTCMonth() + 1, week.getUTCFullYear())
      const entries = weekUnits.map((u) => ({
        unitId: u.id,
        currentPcd: manualEntries[u.id] ?? 0,
      }))
      await fetch('/api/indicators/pcd/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekDate: manualDate, entries }),
      })
      setManualModalOpen(false)
      await loadWeeklyData()
    } finally {
      setManualSaving(false)
    }
  }

  async function handleDeleteWeek(weekDate: string) {
    const dateLabel = new Date(weekDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
    if (!confirm(`Excluir todos os registros da coluna ${dateLabel}?`)) return
    await fetch(`/api/indicators/pcd/weekly?weekDate=${encodeURIComponent(weekDate)}`, { method: 'DELETE' })
    await loadWeeklyData()
  }

  function openEdit(item: PCDIndicatorData) {
    setEditItem(item)
    setForm({
      unitId: item.unitId,
      year: item.year,
      month: item.month,
      totalEmployees: item.totalEmployees,
      metaPercentage: item.metaPercentage,
      currentPcd: item.currentPcd,
    })
    setModalOpen(true)
  }

  function openNew() {
    setEditItem(null)
    setForm({ unitId: '', year: currentYear, month: new Date().getMonth() + 1, totalEmployees: 0, metaPercentage: 5, currentPcd: 0 })
    setModalOpen(true)
  }

  function openRow(unit: Unit, item: PCDIndicatorData | undefined) {
    if (item) {
      openEdit(item)
    } else {
      setEditItem(null)
      setForm({ unitId: unit.id, year: filterYear, month: filterMonth, totalEmployees: 0, metaPercentage: 5, currentPcd: 0 })
      setModalOpen(true)
    }
  }

  function unitsForMonth(month: number, year: number = filterYear) {
    return units.filter((u) => unitVisibleInIndicators(u, year, month))
  }

  const currentMonth = new Date().getMonth() + 1
  const currentYearNow = new Date().getFullYear()
  const unitsAtual = unitsForMonth(currentMonth, currentYearNow)
  const unitsTabela = unitsForMonth(filterMonth, filterYear)

  // Unidades com algum mês visível nos últimos 6 (para legenda da evolução histórica)
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(filterYear, new Date().getMonth() - (5 - i), 1)
    return { month: d.getMonth() + 1, year: d.getFullYear() }
  })
  const unitsHistorico = units.filter((u) =>
    trendMonths.some(({ year, month }) => unitVisibleInIndicators(u, year, month))
  )

  const chartData = unitsAtual.map((unit) => {
    const item = data.find((d) => d.unitId === unit.id && d.month === currentMonth && d.year === currentYearNow)
    const req = item ? calculatePCDMinimum(item.totalEmployees, item.metaPercentage) : 0
    return {
      name: unit.name,
      color: unit.color,
      'Atual': item?.currentPcd ?? 0,
      'Meta Mínima': req,
    }
  })

  const trendData = trendMonths.map(({ month, year }) => {
    const label = `${MONTHS_PT[month - 1].slice(0, 3)}/${String(year).slice(2)}`
    const entry: Record<string, number | string | null> = { month: label }
    unitsHistorico.forEach((unit) => {
      if (!unitVisibleInIndicators(unit, year, month)) {
        entry[unit.name] = null
        return
      }
      const item = data.find((d) => d.unitId === unit.id && d.month === month && d.year === year)
      entry[unit.name] = item?.currentPcd ?? 0
    })
    return entry
  })

  function getPCDStatus(current: number, required: number) {
    if (required === 0) return null
    const pct = (current / required) * 100
    if (pct >= 100) return { label: 'Meta atingida', variant: 'success' as const }
    if (pct >= 85) return { label: 'Atenção', variant: 'warning' as const }
    return { label: 'Abaixo da meta', variant: 'danger' as const }
  }

  const weekDates = Array.from(new Set(weeklyData.map((s) => s.weekDate))).sort()

  return (
    <>
      <Header title="Indicador PCD" subtitle="Profissionais com Deficiência por unidade" />
      <div className="p-6 space-y-6">

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={String(filterYear)}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
            className="w-32"
          />
          <Select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            options={units.map((u) => ({ value: u.id, label: u.name }))}
            placeholder="Todas as unidades"
            className="w-48"
          />
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              icon={<FileText className="w-4 h-4" />}
              onClick={() => setRelatorioOpen(true)}
            >
              Relatório Executivo
            </Button>
            {canEdit && (
              <Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>
                Lançar Indicador
              </Button>
            )}
          </div>
        </div>

        {/* Cards de status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {unitsAtual.map((unit) => {
            const item = data.find((d) => d.unitId === unit.id && d.month === currentMonth && d.year === currentYearNow)
            const req = item ? calculatePCDMinimum(item.totalEmployees, item.metaPercentage) : 0
            const current = item?.currentPcd ?? 0
            const status = getPCDStatus(current, req)
            const pct = req > 0 ? Math.min((current / req) * 100, 100) : 0

            return (
              <Card key={unit.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: unit.color }} />
                    <span className="text-sm font-semibold text-gray-800">{unit.name}</span>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{current}</p>
                      <p className="text-xs text-gray-500">atual / {req} mínimo</p>
                    </div>
                    {status && <Badge variant={status.variant}>{status.label}</Badge>}
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 100 ? '#10B981' : pct >= 85 ? '#F59E0B' : '#EF4444',
                      }}
                    />
                  </div>
                  {item && (
                    <p className="text-xs text-gray-400 mt-1">
                      Meta: {item.metaPercentage}% de {item.totalEmployees} colaboradores
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Atual vs. Meta por Unidade</CardTitle>
              <span className="text-xs text-gray-400">Mês atual</span>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Atual" fill="#15AFA4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Meta Mínima" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolução Histórica</CardTitle>
              <span className="text-xs text-gray-400">Últimos 6 meses</span>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  {unitsHistorico.map((u) => (
                    <Bar key={u.name} dataKey={u.name} fill={u.color} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabela com abas Atual / Semanal */}
        <Card>
          <CardHeader className="flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <CardTitle>Registros de PCD — {filterYear}</CardTitle>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setTableView('atual')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    tableView === 'atual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Atual
                </button>
                <button
                  onClick={() => setTableView('semanal')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    tableView === 'semanal' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Semanal
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              {monthOptions.map((m) => {
                const active = filterMonth === Number(m.value)
                return (
                  <button
                    key={m.value}
                    onClick={() => setFilterMonth(Number(m.value))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      active ? 'bg-[#15AFA4] text-white' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {m.label.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </CardHeader>

          {tableView === 'atual' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-100">
                  <tr>
                    {['Unidade', 'Colaboradores', 'Meta %', 'Mínimo Calc.', 'Atual', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {unitsTabela.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum registro encontrado</td></tr>
                  )}
                  {unitsTabela.map((unit) => {
                    const item = data.find((d) => d.unitId === unit.id && d.month === filterMonth && d.year === filterYear)
                    const req = item ? calculatePCDMinimum(item.totalEmployees, item.metaPercentage) : 0
                    const status = item ? getPCDStatus(item.currentPcd, req) : null
                    return (
                      <tr key={unit.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: unit.color }} />
                            <span className="font-medium text-gray-800">{unit.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{item ? item.totalEmployees.toLocaleString('pt-BR') : '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{item ? `${item.metaPercentage}%` : '-'}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{item ? req : '-'}</td>
                        <td className="px-4 py-3 font-bold text-gray-900">{item ? item.currentPcd : '-'}</td>
                        <td className="px-4 py-3">
                          {status ? <Badge variant={status.variant}>{status.label}</Badge> : <span className="text-gray-400">Sem registro</span>}
                        </td>
                        <td className="px-4 py-3">
                          {canEdit && (
                            <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => openRow(unit, item)}>
                              {item ? 'Editar' : 'Lançar'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {canEdit && (
                <div className="px-4 py-2 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<CalendarPlus className="w-3.5 h-3.5" />}
                    onClick={openManualModal}
                  >
                    Adicionar Semana
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Camera className="w-3.5 h-3.5" />}
                    onClick={handleSnapshot}
                    disabled={snapshotLoading}
                  >
                    {snapshotLoading ? 'Gerando...' : 'Snapshot Atual'}
                  </Button>
                </div>
              )}
              {weekDates.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-gray-400 text-sm">Nenhum registro semanal para {MONTHS_PT[filterMonth - 1]} de {filterYear}</p>
                  <p className="text-gray-400 text-xs mt-1">Use os botões acima para adicionar registros semanais</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50">
                        Unidade
                      </th>
                      {weekDates.map((wd) => (
                        <th key={wd} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {formatWeekDate(wd)}
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteWeek(wd)}
                                className="text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded"
                                title="Excluir coluna"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Variação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {unitsHistorico.map((unit) => {
                      const unitSnapshots = weekDates.map((wd) => {
                        const snap = weeklyData.find((s) => s.unitId === unit.id && s.weekDate === wd)
                        if (!snap) return null
                        // Só exibe snapshot se a unidade ainda estava no indicador naquela semana
                        if (!unitVisibleInIndicators(unit, snap.year, snap.month)) return null
                        return snap
                      })
                      // Esconde linha se não há nenhum snapshot válido no período
                      if (!unitSnapshots.some(Boolean) && !unitVisibleInIndicators(unit, filterYear, filterMonth)) {
                        return null
                      }
                      const first = unitSnapshots.find(Boolean)
                      const last = unitSnapshots.slice().reverse().find(Boolean)
                      const diff = first && last ? last.currentPcd - first.currentPcd : 0

                      return (
                        <tr key={unit.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 sticky left-0 bg-white">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: unit.color }} />
                              <span className="font-medium text-gray-800">{unit.name}</span>
                            </div>
                          </td>
                          {unitSnapshots.map((snap, i) => {
                            const prev = i > 0 ? unitSnapshots[i - 1] : null
                            const changed = prev && snap ? snap.currentPcd - prev.currentPcd : 0
                            return (
                              <td key={weekDates[i]} className="px-4 py-3 text-center">
                                {snap ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="font-bold text-gray-900">{snap.currentPcd}</span>
                                    {prev && changed !== 0 && (
                                      <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
                                        changed > 0 ? 'text-emerald-600' : 'text-red-500'
                                      }`}>
                                        {changed > 0 ? (
                                          <TrendingUp className="w-3 h-3" />
                                        ) : (
                                          <TrendingDown className="w-3 h-3" />
                                        )}
                                        {changed > 0 ? `+${changed}` : changed}
                                      </span>
                                    )}
                                    {prev && changed === 0 && (
                                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                        <Minus className="w-3 h-3" />
                                        0
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-4 py-3 text-center">
                            {first && last && weekDates.length > 1 ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                diff > 0 ? 'bg-emerald-50 text-emerald-700' :
                                diff < 0 ? 'bg-red-50 text-red-700' :
                                'bg-gray-50 text-gray-500'
                              }`}>
                                {diff > 0 ? (
                                  <><TrendingUp className="w-3 h-3" /> +{diff}</>
                                ) : diff < 0 ? (
                                  <><TrendingDown className="w-3 h-3" /> {diff}</>
                                ) : (
                                  <><Minus className="w-3 h-3" /> 0</>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Modal Lançar/Editar Indicador */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar PCD' : 'Lançar Indicador PCD'}>
        <div className="p-6 space-y-4">
          <Select
            label="Unidade *"
            value={form.unitId}
            onChange={(e) => setForm({ ...form, unitId: e.target.value })}
            options={unitsForMonth(form.month, form.year).map((u) => ({ value: u.id, label: u.name }))}
            placeholder="Selecionar unidade"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Ano"
              value={String(form.year)}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
            <Select
              label="Mês"
              value={String(form.month)}
              onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
              options={monthOptions}
            />
          </div>
          <Input
            label="Total de Colaboradores"
            type="number"
            min={0}
            value={form.totalEmployees}
            onChange={(e) => setForm({ ...form, totalEmployees: Number(e.target.value) })}
          />
          <Input
            label="Meta PCD (%)"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={form.metaPercentage}
            onChange={(e) => setForm({ ...form, metaPercentage: Number(e.target.value) })}
          />
          {form.totalEmployees > 0 && (
            <div className="p-3 bg-teal-50 rounded-xl border border-teal-100">
              <p className="text-sm text-teal-700 font-medium">
                Mínimo necessário calculado: <strong>{calculatePCDMinimum(form.totalEmployees, form.metaPercentage)} profissionais PCD</strong>
              </p>
              <p className="text-xs text-teal-600 mt-0.5">
                {form.totalEmployees} colaboradores × {form.metaPercentage}% = {(form.totalEmployees * form.metaPercentage / 100).toFixed(1)} → arredondado para cima
              </p>
            </div>
          )}
          <Input
            label="PCD Atual"
            type="number"
            min={0}
            value={form.currentPcd}
            onChange={(e) => setForm({ ...form, currentPcd: Number(e.target.value) })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.unitId}>Salvar</Button>
          </div>
        </div>
      </Modal>

      {/* Relatório Executivo */}
      {relatorioOpen && (
        <PCDRelatorioExecutivo
          data={data}
          weeklyData={weeklyData}
          units={unitsTabela}
          filterYear={filterYear}
          filterMonth={filterMonth}
          onClose={() => setRelatorioOpen(false)}
        />
      )}

      {/* Modal Adicionar Semana Manual */}
      <Modal open={manualModalOpen} onClose={() => setManualModalOpen(false)} title="Adicionar Registro Semanal">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#15AFA4] focus:border-transparent"
            />
            {manualDate && (
              <p className="text-xs text-emerald-600 mt-1">
                {new Date(manualDate + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </p>
            )}
          </div>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Unidade</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 w-32">PCD Atual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(manualDate
                  ? unitsForMonth(
                      new Date(manualDate + 'T12:00:00Z').getUTCMonth() + 1,
                      new Date(manualDate + 'T12:00:00Z').getUTCFullYear(),
                    )
                  : unitsTabela
                ).map((unit) => (
                  <tr key={unit.id}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: unit.color }} />
                        <span className="text-gray-800 text-sm">{unit.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        value={manualEntries[unit.id] ?? 0}
                        onChange={(e) => setManualEntries({ ...manualEntries, [unit.id]: Number(e.target.value) })}
                        className="w-full text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#15AFA4] focus:border-transparent"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setManualModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleManualSave} disabled={!manualDate || manualSaving}>
              {manualSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
