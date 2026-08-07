'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { Plus, BookOpen, Plug, AlertCircle, Edit2 } from 'lucide-react'
import { MONTHS_PT } from '@/types'
import { formatMonthYear, formatMonthShort } from '@/lib/utils'

interface Unit { id: string; name: string; color: string }

interface ExtUnit {
  id: string; nome: string
  totalHoras: number; participantes: number; colaboradores: number
  mediaPorColaborador: number; taxaParticipacao: number
}
interface ExtRegistro {
  unidadeId: string; unidade: string; periodo: string; mes: number; ano: number
  totalHoras: number; participantes: number; colaboradores: number
  mediaPorColaborador: number; taxaParticipacao: number
}
interface ExtHistorico {
  meses: string[]
  series: { unidadeId: string; unidade: string; dados: number[] }[]
  totais: number[]
}
interface LocalItem {
  id: string; unitId: string; year: number; month: number
  totalHours: number; totalParticipants: number; totalEmployees: number; unit?: Unit
}

const CY = new Date().getFullYear()
const CM = new Date().getMonth() + 1
const YEARS = [CY, CY - 1]
const MONTH_OPTS = MONTHS_PT.map((l, i) => ({ value: String(i + 1), label: l }))
const FALLBACK_COLORS = ['#15AFA4','#3B82F6','#8B5CF6','#F59E0B','#10B981','#EF4444','#06B6D4','#84CC16','#F97316','#EC4899','#6366F1','#14B8A6']

export default function TreinamentoPage() {
  const [units, setUnits]           = useState<Unit[]>([])
  const [filterYear, setFilterYear] = useState(CY)
  const [filterUnit, setFilterUnit] = useState('')
  const [apiMode, setApiMode]       = useState<'external' | 'local' | null>(null)
  const [loading, setLoading]       = useState(false)
  const [extError, setExtError]     = useState<string | null>(null)

  const [extUnits, setExtUnits]         = useState<ExtUnit[]>([])
  const [extRegistros, setExtRegistros] = useState<ExtRegistro[]>([])
  const [extHistorico, setExtHistorico] = useState<ExtHistorico | null>(null)
  const [localData, setLocalData]       = useState<LocalItem[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    unitId: '', year: CY, month: CM,
    totalHours: 0, totalParticipants: 0, totalEmployees: 0,
  })

  const getColor = (unitId: string, idx: number) =>
    units.find(u => u.id === unitId)?.color ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length]

  async function loadData() {
    setLoading(true)
    setExtError(null)

    const p = new URLSearchParams({ ano: String(filterYear) })
    if (filterUnit) p.set('unidadeId', filterUnit)

    try {
      const res  = await fetch(`/api/integrations/training?${p}`)
      const json = await res.json()

      if (json.configured === false) {
        setApiMode('local')
        const lp = new URLSearchParams({ year: String(filterYear) })
        if (filterUnit) lp.set('unitId', filterUnit)
        const lr   = await fetch(`/api/indicators/training?${lp}`)
        setLocalData(await lr.json())
        return
      }

      if (!res.ok) {
        setExtError(json.error ?? 'Erro ao conectar com a API de treinamentos')
        setApiMode('external')
        return
      }

      setApiMode('external')
      setExtUnits(json.porUnidade ?? [])
      setExtRegistros(json.registros ?? [])

      const hp = new URLSearchParams({ meses: '6' })
      if (filterUnit) hp.set('unidadeId', filterUnit)
      const hr = await fetch(`/api/integrations/training/historico?${hp}`)
      if (hr.ok) {
        const hj = await hr.json()
        if (hj.configured !== false && !hj.error) setExtHistorico(hj)
      }
    } catch {
      setExtError('Erro de conexão com a API de treinamentos')
      setApiMode('external')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [filterYear, filterUnit])
  useEffect(() => { fetch('/api/units').then(r => r.json()).then(setUnits) }, [])

  async function save() {
    await fetch('/api/indicators/training', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setModalOpen(false)
    loadData()
  }

  // ─── Cards por unidade ────────────────────────────────────────────────────
  const currentCards = apiMode === 'external'
    ? extUnits.map((u, i) => ({
        id: u.id, name: u.nome, color: getColor(u.id, i),
        totalHoras: u.totalHoras, media: u.mediaPorColaborador, taxa: u.taxaParticipacao,
      }))
    : units.map(u => {
        const item = localData.find(d => d.unitId === u.id && d.month === CM && d.year === filterYear)
        return {
          id: u.id, name: u.name, color: u.color,
          totalHoras: item?.totalHours ?? 0,
          media: item && item.totalEmployees > 0 ? item.totalHours / item.totalEmployees : 0,
          taxa:  item && item.totalEmployees > 0 ? (item.totalParticipants / item.totalEmployees) * 100 : 0,
        }
      })

  // ─── Gráfico de linha (últimos 6 meses) ───────────────────────────────────
  const trendData = extHistorico
    ? extHistorico.meses.map((mes, mi) => {
        const entry: Record<string, number | string> = { month: mes }
        extHistorico.series.forEach(s => { entry[s.unidade] = s.dados[mi] })
        return entry
      })
    : (() => {
        const months6 = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(CY, CM - 1 - (5 - i), 1)
          return { year: d.getFullYear(), month: d.getMonth() + 1, label: formatMonthShort(d.getFullYear(), d.getMonth() + 1) }
        })
        return months6.map(({ year, month, label }) => {
          const entry: Record<string, number | string> = { month: label }
          units.forEach(u => {
            const item = localData.find(d => d.unitId === u.id && d.month === month && d.year === year)
            if (item) entry[u.name] = parseFloat(item.totalHours.toFixed(1))
          })
          return entry
        })
      })()

  const trendSeries = extHistorico
    ? extHistorico.series.map((s, i) => ({ key: s.unidade, color: getColor(s.unidadeId, i) }))
    : units.map(u => ({ key: u.name, color: u.color }))

  // ─── Gráfico de barra (mês atual) ────────────────────────────────────────
  const barData = extHistorico
    ? extHistorico.series.map((s, i) => ({
        name: s.unidade,
        color: getColor(s.unidadeId, i),
        totalHoras: s.dados[s.dados.length - 1] ?? 0,
      }))
    : currentCards.map(c => ({ name: c.name, color: c.color, totalHoras: c.totalHoras }))

  const previewAvg  = form.totalEmployees > 0 ? (form.totalHours / form.totalEmployees).toFixed(1) : '—'
  const previewRate = form.totalEmployees > 0 ? ((form.totalParticipants / form.totalEmployees) * 100).toFixed(0) : '—'

  return (
    <>
      <Header title="Treinamento & Desenvolvimento" subtitle="Horas de treinamento e taxa de participação por unidade" />
      <div className="p-6 space-y-6">

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(filterYear)} onChange={e => setFilterYear(Number(e.target.value))}
            options={YEARS.map(y => ({ value: String(y), label: String(y) }))} className="w-32" />
          <Select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
            options={units.map(u => ({ value: u.id, label: u.name }))} placeholder="Todas as unidades" className="w-48" />

          {apiMode === 'external' && !extError && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#15AFA4]/10 text-[#15AFA4] text-xs font-semibold">
              <Plug className="w-3 h-3" />
              Integrado — BHCL Treinamentos
            </div>
          )}

          <div className="ml-auto">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => {
              setForm({ unitId: '', year: CY, month: CM, totalHours: 0, totalParticipants: 0, totalEmployees: 0 })
              setModalOpen(true)
            }}>
              Lançar Indicador
            </Button>
          </div>
        </div>

        {/* Erro de conexão */}
        {extError && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{extError}</p>
          </div>
        )}

        {/* Cards por unidade */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {currentCards.map(item => (
            <Card key={item.id}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <BookOpen className="w-5 h-5 text-[#15AFA4]" />
                  <p className="text-2xl font-bold text-gray-900">
                    {item.totalHoras > 0 ? `${item.totalHoras.toFixed(0)}h` : '—'}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {item.totalHoras > 0
                    ? `${item.media.toFixed(1)}h/colab. · ${item.taxa.toFixed(0)}% participação`
                    : 'Sem dados'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Horas de Treinamento</CardTitle>
              <span className="text-xs text-gray-400">Últimos 6 meses</span>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit="h" />
                  <Tooltip formatter={(v: number) => [`${v}h`, '']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  {trendSeries.map(s => (
                    <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Horas Totais — Mês Atual</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit="h" />
                  <Tooltip formatter={(v: number) => [`${v}h`, 'Horas']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Bar dataKey="totalHoras" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de registros */}
        <Card>
          <CardHeader><CardTitle>Registros — {filterYear}</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>
                  {['Unidade', 'Período', 'Total de Horas', 'Participantes', 'Colaboradores', 'Média h/colab.', 'Taxa Participação', ...(apiMode === 'local' ? [''] : [])].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Carregando...</td></tr>
                )}

                {/* External API rows */}
                {!loading && apiMode === 'external' && extRegistros.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>
                )}
                {!loading && apiMode === 'external' && extRegistros.map((item, i) => (
                  <tr key={`${item.unidadeId}-${item.mes}`} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: getColor(item.unidadeId, i) }} />
                        <span className="font-medium">{item.unidade}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.periodo}</td>
                    <td className="px-4 py-3 font-semibold text-[#15AFA4]">{item.totalHoras.toFixed(1)}h</td>
                    <td className="px-4 py-3 text-gray-600">{item.participantes}</td>
                    <td className="px-4 py-3 text-gray-600">{item.colaboradores}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{item.mediaPorColaborador.toFixed(1)}h</td>
                    <td className="px-4 py-3">
                      <span className="font-bold" style={{ color: item.taxaParticipacao >= 70 ? '#22C55E' : '#F59E0B' }}>
                        {item.taxaParticipacao.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}

                {/* Local DB rows */}
                {!loading && apiMode === 'local' && localData.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>
                )}
                {!loading && apiMode === 'local' && localData.map(item => {
                  const avg  = item.totalEmployees > 0 ? (item.totalHours / item.totalEmployees).toFixed(1) : '—'
                  const rate = item.totalEmployees > 0 ? ((item.totalParticipants / item.totalEmployees) * 100).toFixed(0) : '—'
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.unit?.color }} />
                          <span className="font-medium">{item.unit?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatMonthYear(item.year, item.month)}</td>
                      <td className="px-4 py-3 font-semibold text-[#15AFA4]">{item.totalHours.toFixed(1)}h</td>
                      <td className="px-4 py-3 text-gray-600">{item.totalParticipants}</td>
                      <td className="px-4 py-3 text-gray-600">{item.totalEmployees}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{avg}h</td>
                      <td className="px-4 py-3">
                        <span className="font-bold" style={{ color: Number(rate) >= 70 ? '#22C55E' : '#F59E0B' }}>
                          {rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setForm({ unitId: item.unitId, year: item.year, month: item.month, totalHours: item.totalHours, totalParticipants: item.totalParticipants, totalEmployees: item.totalEmployees })
                            setModalOpen(true)
                          }}>
                          Editar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal de lançamento manual */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Lançar Indicador de Treinamento">
        <div className="p-6 space-y-4">
          <Select label="Unidade *" value={form.unitId}
            onChange={e => setForm({ ...form, unitId: e.target.value })}
            options={units.map(u => ({ value: u.id, label: u.name }))} placeholder="Selecionar" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Ano" value={String(form.year)}
              onChange={e => setForm({ ...form, year: Number(e.target.value) })}
              options={YEARS.map(y => ({ value: String(y), label: String(y) }))} />
            <Select label="Mês" value={String(form.month)}
              onChange={e => setForm({ ...form, month: Number(e.target.value) })}
              options={MONTH_OPTS} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Total de Horas" type="number" min={0} step={0.5} value={form.totalHours}
              onChange={e => setForm({ ...form, totalHours: parseFloat(e.target.value) || 0 })} />
            <Input label="Participantes" type="number" min={0} value={form.totalParticipants}
              onChange={e => setForm({ ...form, totalParticipants: Number(e.target.value) })} />
            <Input label="Total de Colaboradores" type="number" min={0} value={form.totalEmployees}
              onChange={e => setForm({ ...form, totalEmployees: Number(e.target.value) })} />
          </div>
          {form.totalHours > 0 && (
            <div className="p-3 bg-teal-50 rounded-xl border border-teal-100">
              <p className="text-sm text-teal-700 font-medium">
                Média: <strong>{previewAvg}h por colaborador</strong> · Taxa de participação: <strong>{previewRate}%</strong>
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.unitId}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
