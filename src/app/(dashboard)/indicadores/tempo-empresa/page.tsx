'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Plus, Edit2, Clock } from 'lucide-react'
import { MONTHS_PT } from '@/types'
import { formatMonthYear } from '@/lib/utils'

interface Unit { id: string; name: string; color: string }
interface TenureItem {
  id: string; unitId: string; year: number; month: number
  ate1ano: number; de1a3: number; de3a5: number; de5a10: number; acima10: number
  unit?: Unit
}

const CY = new Date().getFullYear()
const YEARS = [CY, CY - 1]
const MONTH_OPTS = MONTHS_PT.map((l, i) => ({ value: String(i + 1), label: l }))

const FAIXAS = [
  { key: 'ate1ano', label: 'Até 1 ano', color: '#3B82F6' },
  { key: 'de1a3', label: '1 a 3 anos', color: '#8B5CF6' },
  { key: 'de3a5', label: '3 a 5 anos', color: '#15AFA4' },
  { key: 'de5a10', label: '5 a 10 anos', color: '#22C55E' },
  { key: 'acima10', label: 'Acima de 10 anos', color: '#F59E0B' },
] as const

function toChartData(item: TenureItem | undefined, asPercent = false) {
  if (!item) return FAIXAS.map(f => ({ name: f.label, value: 0, color: f.color }))
  const total = item.ate1ano + item.de1a3 + item.de3a5 + item.de5a10 + item.acima10
  return FAIXAS.map(f => ({
    name: f.label,
    value: asPercent && total > 0 ? parseFloat(((item[f.key] / total) * 100).toFixed(1)) : item[f.key],
    color: f.color,
  }))
}

export default function TempoEmpresaPage() {
  const [data, setData] = useState<TenureItem[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [filterYear, setFilterYear] = useState(CY)
  const [filterUnit, setFilterUnit] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ unitId: '', year: CY, month: new Date().getMonth() + 1, ate1ano: 0, de1a3: 0, de3a5: 0, de5a10: 0, acima10: 0 })

  const cm = new Date().getMonth() + 1

  async function load() {
    const p = new URLSearchParams({ year: String(filterYear) })
    if (filterUnit) p.set('unitId', filterUnit)
    const res = await fetch(`/api/indicators/tenure?${p}`)
    const d = await res.json()
    setData(d)
    if (!selectedUnit && d.length > 0) setSelectedUnit(d[0].unitId)
  }

  useEffect(() => { load() }, [filterYear, filterUnit])
  useEffect(() => { fetch('/api/units').then(r => r.json()).then(setUnits) }, [])

  async function save() {
    await fetch('/api/indicators/tenure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setModalOpen(false)
    load()
  }

  const currentItem = data.find(d => d.unitId === (selectedUnit || units[0]?.id) && d.month === cm && d.year === filterYear)
  const chartData = toChartData(currentItem, true)
  const totalColabs = currentItem ? Object.values({ ate1ano: currentItem.ate1ano, de1a3: currentItem.de1a3, de3a5: currentItem.de3a5, de5a10: currentItem.de5a10, acima10: currentItem.acima10 }).reduce((a, b) => a + b, 0) : 0

  const previewTotal = form.ate1ano + form.de1a3 + form.de3a5 + form.de5a10 + form.acima10

  return (
    <>
      <Header title="Distribuição por Tempo de Empresa" subtitle="Composição do quadro por faixa de tempo na organização" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(filterYear)} onChange={e => setFilterYear(Number(e.target.value))} options={YEARS.map(y => ({ value: String(y), label: String(y) }))} className="w-32" />
          <Select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} options={units.map(u => ({ value: u.id, label: u.name }))} placeholder="Todas as unidades" className="w-48" />
          <div className="ml-auto">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setForm({ unitId: '', year: CY, month: cm, ate1ano: 0, de1a3: 0, de3a5: 0, de5a10: 0, acima10: 0 }); setModalOpen(true) }}>
              Lançar Indicador
            </Button>
          </div>
        </div>

        {/* Seletor de unidade para o gráfico */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-500">Visualizar unidade:</span>
          {units.map(u => (
            <button key={u.id} onClick={() => setSelectedUnit(u.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${selectedUnit === u.id ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'}`}
              style={selectedUnit === u.id ? { background: u.color, borderColor: u.color } : {}}>
              {u.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Faixa (% do total)</CardTitle>
              <span className="text-xs text-gray-400">Mês atual — {units.find(u => u.id === selectedUnit)?.name ?? '—'} · {totalColabs} colaboradores</span>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} width={110} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [`${v}%`]} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} label={{ position: 'right', fontSize: 10, fill: '#6B7280', formatter: (v: number) => `${v}%` }}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Legenda e Resumo</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {FAIXAS.map(f => {
                  const count = currentItem?.[f.key] ?? 0
                  const pct = totalColabs > 0 ? ((count / totalColabs) * 100).toFixed(1) : '0'
                  return (
                    <div key={f.key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: f.color }} />
                          <span className="text-sm text-gray-700">{f.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{count} colab.</span>
                          <span className="text-sm font-bold text-gray-800">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: f.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Registros — {filterYear}</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>{['Unidade', 'Período', 'Até 1 ano', '1-3 anos', '3-5 anos', '5-10 anos', '+10 anos', 'Total', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>}
                {data.map(item => {
                  const total = item.ate1ano + item.de1a3 + item.de3a5 + item.de5a10 + item.acima10
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: item.unit?.color }} /><span className="font-medium">{item.unit?.name}</span></div></td>
                      <td className="px-4 py-3 text-gray-600">{formatMonthYear(item.year, item.month)}</td>
                      <td className="px-4 py-3 text-gray-700">{item.ate1ano}</td>
                      <td className="px-4 py-3 text-gray-700">{item.de1a3}</td>
                      <td className="px-4 py-3 text-gray-700">{item.de3a5}</td>
                      <td className="px-4 py-3 text-gray-700">{item.de5a10}</td>
                      <td className="px-4 py-3 text-gray-700">{item.acima10}</td>
                      <td className="px-4 py-3 font-bold text-gray-900">{total}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => { setForm({ unitId: item.unitId, year: item.year, month: item.month, ate1ano: item.ate1ano, de1a3: item.de1a3, de3a5: item.de3a5, de5a10: item.de5a10, acima10: item.acima10 }); setModalOpen(true) }}>Editar</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Lançar Distribuição por Tempo de Empresa">
        <div className="p-6 space-y-4">
          <Select label="Unidade *" value={form.unitId} onChange={e => setForm({ ...form, unitId: e.target.value })} options={units.map(u => ({ value: u.id, label: u.name }))} placeholder="Selecionar" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Ano" value={String(form.year)} onChange={e => setForm({ ...form, year: Number(e.target.value) })} options={YEARS.map(y => ({ value: String(y), label: String(y) }))} />
            <Select label="Mês" value={String(form.month)} onChange={e => setForm({ ...form, month: Number(e.target.value) })} options={MONTH_OPTS} />
          </div>
          <p className="text-xs text-gray-500">Informe o número de colaboradores em cada faixa:</p>
          <div className="grid grid-cols-2 gap-3">
            {FAIXAS.map(f => (
              <Input key={f.key} label={f.label} type="number" min={0}
                value={form[f.key]}
                onChange={e => setForm({ ...form, [f.key]: Number(e.target.value) })} />
            ))}
          </div>
          {previewTotal > 0 && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm text-blue-700 font-medium">Total de colaboradores registrados: <strong>{previewTotal}</strong></p>
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
