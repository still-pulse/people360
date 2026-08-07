'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { Plus, Edit2, Smile } from 'lucide-react'
import { MONTHS_PT } from '@/types'
import { formatMonthYear, formatMonthShort } from '@/lib/utils'

interface Unit { id: string; name: string; color: string }
interface EngItem { id: string; unitId: string; year: number; month: number; rate: number; totalRespondents: number; totalEmployees: number; unit?: Unit }

const CY = new Date().getFullYear()
const YEARS = [CY, CY - 1]
const MONTH_OPTS = MONTHS_PT.map((l, i) => ({ value: String(i + 1), label: l }))

export default function EngajamentoPage() {
  const [data, setData] = useState<EngItem[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [filterYear, setFilterYear] = useState(CY)
  const [filterUnit, setFilterUnit] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ unitId: '', year: CY, month: new Date().getMonth() + 1, rate: 0, totalRespondents: 0, totalEmployees: 0 })

  const cm = new Date().getMonth() + 1

  async function load() {
    const p = new URLSearchParams({ year: String(filterYear) })
    if (filterUnit) p.set('unitId', filterUnit)
    const res = await fetch(`/api/indicators/engagement?${p}`)
    setData(await res.json())
  }

  useEffect(() => { load() }, [filterYear, filterUnit])
  useEffect(() => { fetch('/api/units').then(r => r.json()).then(setUnits) }, [])

  async function save() {
    await fetch('/api/indicators/engagement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
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
      if (item) entry[u.name] = parseFloat(item.rate.toFixed(1))
    })
    return entry
  })

  const currentCards = units.map(u => {
    const item = data.find(d => d.unitId === u.id && d.month === cm && d.year === filterYear)
    return { name: u.name, color: u.color, rate: item?.rate ?? 0 }
  })

  return (
    <>
      <Header title="Indicador de Engajamento" subtitle="Taxa de engajamento dos colaboradores por unidade" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(filterYear)} onChange={e => setFilterYear(Number(e.target.value))} options={YEARS.map(y => ({ value: String(y), label: String(y) }))} className="w-32" />
          <Select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} options={units.map(u => ({ value: u.id, label: u.name }))} placeholder="Todas as unidades" className="w-48" />
          <div className="ml-auto">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setForm({ unitId: '', year: CY, month: cm, rate: 0, totalRespondents: 0, totalEmployees: 0 }); setModalOpen(true) }}>
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
                  <Smile className="w-5 h-5" style={{ color: item.rate >= 70 ? '#22C55E' : item.rate >= 50 ? '#F59E0B' : '#EF4444' }} />
                  <p className="text-3xl font-bold" style={{ color: item.rate >= 70 ? '#22C55E' : item.rate >= 50 ? '#F59E0B' : '#EF4444' }}>
                    {item.rate.toFixed(1)}%
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {item.rate >= 70 ? 'Engajamento alto' : item.rate >= 50 ? 'Atenção' : item.rate === 0 ? 'Sem dados' : 'Engajamento baixo'}
                </p>
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
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v: number) => [`${v}%`, '']} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
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
                <BarChart data={currentCards} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Engajamento']} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {currentCards.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
                <tr>{['Unidade', 'Período', 'Taxa (%)', 'Respondentes', 'Colaboradores', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>}
                {data.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: item.unit?.color }} /><span className="font-medium">{item.unit?.name}</span></div></td>
                    <td className="px-4 py-3 text-gray-600">{formatMonthYear(item.year, item.month)}</td>
                    <td className="px-4 py-3"><span className="font-bold text-base" style={{ color: item.rate >= 70 ? '#22C55E' : item.rate >= 50 ? '#F59E0B' : '#EF4444' }}>{item.rate.toFixed(1)}%</span></td>
                    <td className="px-4 py-3 text-gray-600">{item.totalRespondents}</td>
                    <td className="px-4 py-3 text-gray-600">{item.totalEmployees}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => { setForm({ unitId: item.unitId, year: item.year, month: item.month, rate: item.rate, totalRespondents: item.totalRespondents, totalEmployees: item.totalEmployees }); setModalOpen(true) }}>Editar</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Lançar Indicador de Engajamento">
        <div className="p-6 space-y-4">
          <Select label="Unidade *" value={form.unitId} onChange={e => setForm({ ...form, unitId: e.target.value })} options={units.map(u => ({ value: u.id, label: u.name }))} placeholder="Selecionar" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Ano" value={String(form.year)} onChange={e => setForm({ ...form, year: Number(e.target.value) })} options={YEARS.map(y => ({ value: String(y), label: String(y) }))} />
            <Select label="Mês" value={String(form.month)} onChange={e => setForm({ ...form, month: Number(e.target.value) })} options={MONTH_OPTS} />
          </div>
          <Input label="Taxa de Engajamento (%)" type="number" min={0} max={100} step={0.1} value={form.rate} onChange={e => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Total de Respondentes" type="number" min={0} value={form.totalRespondents} onChange={e => setForm({ ...form, totalRespondents: Number(e.target.value) })} />
            <Input label="Total de Colaboradores" type="number" min={0} value={form.totalEmployees} onChange={e => setForm({ ...form, totalEmployees: Number(e.target.value) })} />
          </div>
          {form.rate > 0 && (
            <div className="p-3 bg-green-50 rounded-xl border border-green-100">
              <p className="text-sm text-green-700 font-medium">Taxa informada: <strong>{form.rate.toFixed(1)}%</strong></p>
              {form.totalRespondents > 0 && form.totalEmployees > 0 && (
                <p className="text-xs text-green-600 mt-0.5">Cobertura: {((form.totalRespondents / form.totalEmployees) * 100).toFixed(0)}% dos colaboradores responderam</p>
              )}
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
