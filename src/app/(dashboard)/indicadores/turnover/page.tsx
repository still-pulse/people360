'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import { Plus, Edit2 } from 'lucide-react'
import { MONTHS_PT, TurnoverIndicatorData } from '@/types'
import { calculateTurnoverRate, formatMonthYear, formatMonthShort } from '@/lib/utils'

interface Unit { id: string; name: string; color: string }

const currentYear = new Date().getFullYear()
const years = [currentYear, currentYear - 1]
const monthOptions = MONTHS_PT.map((label, i) => ({ value: String(i + 1), label }))

export default function TurnoverPage() {
  const [data, setData] = useState<TurnoverIndicatorData[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterUnit, setFilterUnit] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    unitId: '', year: currentYear, month: new Date().getMonth() + 1,
    admissions: 0, dismissals: 0, headcountStart: 0, headcountEnd: 0,
  })

  async function loadData() {
    const params = new URLSearchParams({ year: String(filterYear) })
    if (filterUnit) params.set('unitId', filterUnit)
    const res = await fetch(`/api/indicators/turnover?${params}`)
    setData(await res.json())
  }

  useEffect(() => { loadData() }, [filterYear, filterUnit])
  useEffect(() => { fetch('/api/units?indicadores=true').then((r) => r.json()).then(setUnits) }, [])

  async function handleSave() {
    await fetch('/api/indicators/turnover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setModalOpen(false)
    loadData()
  }

  // Trend por mês
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, new Date().getMonth() - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: formatMonthShort(d.getFullYear(), d.getMonth() + 1) }
  })

  const trendData = months.map(({ year, month, label }) => {
    const entry: Record<string, number | string> = { month: label }
    units.forEach((unit) => {
      const item = data.find((d) => d.unitId === unit.id && d.month === month && d.year === year)
      if (item) {
        entry[unit.name] = parseFloat(calculateTurnoverRate(item.admissions, item.dismissals, item.headcountStart, item.headcountEnd).toFixed(1))
      }
    })
    return entry
  })

  const currentMonth = new Date().getMonth() + 1
  const currentData = units.map((unit) => {
    const item = data.find((d) => d.unitId === unit.id && d.month === currentMonth && d.year === filterYear)
    const rate = item ? calculateTurnoverRate(item.admissions, item.dismissals, item.headcountStart, item.headcountEnd) : 0
    return { name: unit.name, color: unit.color, 'Turnover %': parseFloat(rate.toFixed(1)) }
  })

  const previewRate = calculateTurnoverRate(form.admissions, form.dismissals, form.headcountStart, form.headcountEnd)

  return (
    <>
      <Header title="Indicador Turnover" subtitle="Taxa de rotatividade por unidade" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(filterYear)} onChange={(e) => setFilterYear(Number(e.target.value))} options={years.map((y) => ({ value: String(y), label: String(y) }))} className="w-32" />
          <Select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} options={units.map((u) => ({ value: u.id, label: u.name }))} placeholder="Todas as unidades" className="w-48" />
          <div className="ml-auto">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setForm({ unitId: '', year: currentYear, month: currentMonth, admissions: 0, dismissals: 0, headcountStart: 0, headcountEnd: 0 }); setModalOpen(true) }}>
              Lançar Indicador
            </Button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {currentData.map((item) => (
            <Card key={item.name}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                </div>
                <p className="text-3xl font-bold mt-2" style={{ color: item['Turnover %'] > 5 ? '#EF4444' : '#10B981' }}>
                  {item['Turnover %']}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {item['Turnover %'] > 5 ? 'Acima do ideal' : item['Turnover %'] > 3 ? 'Atenção' : 'Dentro do ideal'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Evolução Histórica</CardTitle><span className="text-xs text-gray-400">Últimos 6 meses</span></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit="%" />
                  <Tooltip formatter={(v: number) => [`${v}%`, '']} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  {units.map((u) => <Line key={u.name} type="monotone" dataKey={u.name} stroke={u.color} strokeWidth={2} dot={{ r: 3 }} />)}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Comparativo — Mês Atual</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={currentData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit="%" />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Turnover']} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Bar dataKey="Turnover %" radius={[4, 4, 0, 0]}>
                    {currentData.map((entry, i) => (
                      <rect key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader><CardTitle>Registros — {filterYear}</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>
                  {['Unidade', 'Período', 'Admissões', 'Desligamentos', 'HC Início', 'HC Fim', 'Taxa Turnover', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>}
                {data.map((item) => {
                  const rate = calculateTurnoverRate(item.admissions, item.dismissals, item.headcountStart, item.headcountEnd)
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: item.unit?.color }} /><span className="font-medium">{item.unit?.name}</span></div></td>
                      <td className="px-4 py-3 text-gray-600">{formatMonthYear(item.year, item.month)}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">+{item.admissions}</td>
                      <td className="px-4 py-3 text-red-500 font-medium">-{item.dismissals}</td>
                      <td className="px-4 py-3 text-gray-600">{item.headcountStart}</td>
                      <td className="px-4 py-3 text-gray-600">{item.headcountEnd}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-base ${rate > 5 ? 'text-red-500' : 'text-green-600'}`}>{rate.toFixed(1)}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => { setForm({ unitId: item.unitId, year: item.year, month: item.month, admissions: item.admissions, dismissals: item.dismissals, headcountStart: item.headcountStart, headcountEnd: item.headcountEnd }); setModalOpen(true) }}>Editar</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Lançar Indicador de Turnover">
        <div className="p-6 space-y-4">
          <Select label="Unidade *" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} options={units.map((u) => ({ value: u.id, label: u.name }))} placeholder="Selecionar" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Ano" value={String(form.year)} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} options={years.map((y) => ({ value: String(y), label: String(y) }))} />
            <Select label="Mês" value={String(form.month)} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })} options={monthOptions} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Admissões" type="number" min={0} value={form.admissions} onChange={(e) => setForm({ ...form, admissions: Number(e.target.value) })} />
            <Input label="Desligamentos" type="number" min={0} value={form.dismissals} onChange={(e) => setForm({ ...form, dismissals: Number(e.target.value) })} />
            <Input label="Headcount Início" type="number" min={0} value={form.headcountStart} onChange={(e) => setForm({ ...form, headcountStart: Number(e.target.value) })} />
            <Input label="Headcount Fim" type="number" min={0} value={form.headcountEnd} onChange={(e) => setForm({ ...form, headcountEnd: Number(e.target.value) })} />
          </div>
          {(form.admissions > 0 || form.dismissals > 0) && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm text-blue-700 font-medium">
                Taxa de Turnover calculada: <strong>{previewRate.toFixed(2)}%</strong>
              </p>
              <p className="text-xs text-blue-500 mt-0.5">
                Fórmula: ((admissões + desligamentos) / 2) / ((HC início + HC fim) / 2) × 100
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.unitId}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
