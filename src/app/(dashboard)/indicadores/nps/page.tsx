'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts'
import { Plus, Edit2, Star } from 'lucide-react'
import { MONTHS_PT } from '@/types'
import { formatMonthYear, formatMonthShort } from '@/lib/utils'

interface Unit { id: string; name: string; color: string }
interface NpsItem { id: string; unitId: string; year: number; month: number; promoters: number; neutrals: number; detractors: number; totalRespondents: number; unit?: Unit }

const CY = new Date().getFullYear()
const YEARS = [CY, CY - 1]
const MONTH_OPTS = MONTHS_PT.map((l, i) => ({ value: String(i + 1), label: l }))

function calcNps(p: number, d: number, t: number) {
  if (t === 0) return 0
  return Math.round(((p - d) / t) * 100)
}

function npsColor(v: number) {
  if (v >= 50) return '#22C55E'
  if (v >= 0) return '#F59E0B'
  return '#EF4444'
}

function npsLabel(v: number) {
  if (v >= 75) return 'Excelente'
  if (v >= 50) return 'Muito Bom'
  if (v >= 0) return 'Razoável'
  return 'Crítico'
}

export default function NpsPage() {
  const [data, setData] = useState<NpsItem[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [filterYear, setFilterYear] = useState(CY)
  const [filterUnit, setFilterUnit] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ unitId: '', year: CY, month: new Date().getMonth() + 1, promoters: 0, neutrals: 0, detractors: 0, totalRespondents: 0 })

  const cm = new Date().getMonth() + 1

  async function load() {
    const p = new URLSearchParams({ year: String(filterYear) })
    if (filterUnit) p.set('unitId', filterUnit)
    const res = await fetch(`/api/indicators/nps?${p}`)
    setData(await res.json())
  }

  useEffect(() => { load() }, [filterYear, filterUnit])
  useEffect(() => { fetch('/api/units').then(r => r.json()).then(setUnits) }, [])

  async function save() {
    const total = form.totalRespondents || (form.promoters + form.neutrals + form.detractors)
    await fetch('/api/indicators/nps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, totalRespondents: total }) })
    setModalOpen(false)
    load()
  }

  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(CY, cm - 1 - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: formatMonthShort(d.getFullYear(), d.getMonth() + 1) }
  })

  const trendData = months6.map(({ year, month, label }) => {
    const entry: Record<string, number | string> = { month: label }
    units.forEach(u => {
      const item = data.find(d => d.unitId === u.id && d.month === month && d.year === year)
      if (item) entry[u.name] = calcNps(item.promoters, item.detractors, item.totalRespondents)
    })
    return entry
  })

  const currentCards = units.map(u => {
    const item = data.find(d => d.unitId === u.id && d.month === cm && d.year === filterYear)
    const nps = item ? calcNps(item.promoters, item.detractors, item.totalRespondents) : null
    return { name: u.name, color: u.color, nps }
  })

  const previewNps = calcNps(form.promoters, form.detractors, form.promoters + form.neutrals + form.detractors)

  return (
    <>
      <Header title="NPS / eNPS" subtitle="Net Promoter Score de colaboradores por unidade" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(filterYear)} onChange={e => setFilterYear(Number(e.target.value))} options={YEARS.map(y => ({ value: String(y), label: String(y) }))} className="w-32" />
          <Select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} options={units.map(u => ({ value: u.id, label: u.name }))} placeholder="Todas as unidades" className="w-48" />
          <div className="ml-auto">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setForm({ unitId: '', year: CY, month: cm, promoters: 0, neutrals: 0, detractors: 0, totalRespondents: 0 }); setModalOpen(true) }}>
              Lançar Indicador
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {currentCards.map(item => (
            <Card key={item.name}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Star className="w-5 h-5" style={{ color: item.nps !== null ? npsColor(item.nps) : '#94A3B8' }} />
                  <p className="text-3xl font-bold" style={{ color: item.nps !== null ? npsColor(item.nps) : '#94A3B8' }}>
                    {item.nps !== null ? (item.nps >= 0 ? `+${item.nps}` : item.nps) : '—'}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-1">{item.nps !== null ? npsLabel(item.nps) : 'Sem dados'}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Evolução Histórica</CardTitle><span className="text-xs text-gray-400">Últimos 6 meses</span></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} domain={[-100, 100]} />
                  <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="3 3" />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  {units.map(u => <Line key={u.name} type="monotone" dataKey={u.name} stroke={u.color} strokeWidth={2} dot={{ r: 3 }} />)}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Comparativo — Mês Atual</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={currentCards.filter(c => c.nps !== null)} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} domain={[-100, 100]} />
                  <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="3 3" />
                  <Tooltip formatter={(v: number) => [v >= 0 ? `+${v}` : v, 'NPS']} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Bar dataKey="nps" radius={[4, 4, 0, 0]}>
                    {currentCards.map((entry, i) => <Cell key={i} fill={entry.nps !== null ? npsColor(entry.nps) : '#94A3B8'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Registros — {filterYear}</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>{['Unidade', 'Período', 'Promotores', 'Neutros', 'Detratores', 'Total Resp.', 'NPS', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>}
                {data.map(item => {
                  const nps = calcNps(item.promoters, item.detractors, item.totalRespondents)
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: item.unit?.color }} /><span className="font-medium">{item.unit?.name}</span></div></td>
                      <td className="px-4 py-3 text-gray-600">{formatMonthYear(item.year, item.month)}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">{item.promoters}</td>
                      <td className="px-4 py-3 text-gray-500">{item.neutrals}</td>
                      <td className="px-4 py-3 text-red-500 font-medium">{item.detractors}</td>
                      <td className="px-4 py-3 text-gray-600">{item.totalRespondents}</td>
                      <td className="px-4 py-3"><span className="font-bold text-base" style={{ color: npsColor(nps) }}>{nps >= 0 ? `+${nps}` : nps}</span></td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => { setForm({ unitId: item.unitId, year: item.year, month: item.month, promoters: item.promoters, neutrals: item.neutrals, detractors: item.detractors, totalRespondents: item.totalRespondents }); setModalOpen(true) }}>Editar</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Lançar NPS / eNPS">
        <div className="p-6 space-y-4">
          <Select label="Unidade *" value={form.unitId} onChange={e => setForm({ ...form, unitId: e.target.value })} options={units.map(u => ({ value: u.id, label: u.name }))} placeholder="Selecionar" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Ano" value={String(form.year)} onChange={e => setForm({ ...form, year: Number(e.target.value) })} options={YEARS.map(y => ({ value: String(y), label: String(y) }))} />
            <Select label="Mês" value={String(form.month)} onChange={e => setForm({ ...form, month: Number(e.target.value) })} options={MONTH_OPTS} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Promotores (9-10)" type="number" min={0} value={form.promoters} onChange={e => setForm({ ...form, promoters: Number(e.target.value) })} />
            <Input label="Neutros (7-8)" type="number" min={0} value={form.neutrals} onChange={e => setForm({ ...form, neutrals: Number(e.target.value) })} />
            <Input label="Detratores (0-6)" type="number" min={0} value={form.detractors} onChange={e => setForm({ ...form, detractors: Number(e.target.value) })} />
          </div>
          {(form.promoters > 0 || form.detractors > 0) && (
            <div className="p-3 rounded-xl border" style={{ background: `${npsColor(previewNps)}10`, borderColor: `${npsColor(previewNps)}30` }}>
              <p className="text-sm font-medium" style={{ color: npsColor(previewNps) }}>
                NPS calculado: <strong>{previewNps >= 0 ? `+${previewNps}` : previewNps}</strong> — {npsLabel(previewNps)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Total respondentes: {form.promoters + form.neutrals + form.detractors}</p>
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
