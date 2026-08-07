'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts'
import { Plus, Edit2, Briefcase } from 'lucide-react'
import { MONTHS_PT } from '@/types'
import { formatMonthYear, formatMonthShort } from '@/lib/utils'

interface Unit { id: string; name: string; color: string }
interface HcItem { id: string; unitId: string; year: number; month: number; totalCost: number; totalHires: number; unit?: Unit }

const CY = new Date().getFullYear()
const YEARS = [CY, CY - 1]
const MONTH_OPTS = MONTHS_PT.map((l, i) => ({ value: String(i + 1), label: l }))

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function CustoContratacaoPage() {
  const [data, setData] = useState<HcItem[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [filterYear, setFilterYear] = useState(CY)
  const [filterUnit, setFilterUnit] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ unitId: '', year: CY, month: new Date().getMonth() + 1, totalCost: 0, totalHires: 0 })

  const cm = new Date().getMonth() + 1

  async function load() {
    const p = new URLSearchParams({ year: String(filterYear) })
    if (filterUnit) p.set('unitId', filterUnit)
    const res = await fetch(`/api/indicators/hiring-cost?${p}`)
    setData(await res.json())
  }

  useEffect(() => { load() }, [filterYear, filterUnit])
  useEffect(() => { fetch('/api/units').then(r => r.json()).then(setUnits) }, [])

  async function save() {
    await fetch('/api/indicators/hiring-cost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
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
      if (item && item.totalHires > 0) entry[u.name] = Math.round(item.totalCost / item.totalHires)
    })
    return entry
  })

  const currentCards = units.map(u => {
    const item = data.find(d => d.unitId === u.id && d.month === cm && d.year === filterYear)
    const cph = item && item.totalHires > 0 ? Math.round(item.totalCost / item.totalHires) : 0
    return { name: u.name, color: u.color, cph, totalHires: item?.totalHires ?? 0 }
  })

  const previewCph = form.totalHires > 0 ? Math.round(form.totalCost / form.totalHires) : 0

  return (
    <>
      <Header title="Custo de Contratação" subtitle="Custo médio por contratação realizada por unidade" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(filterYear)} onChange={e => setFilterYear(Number(e.target.value))} options={YEARS.map(y => ({ value: String(y), label: String(y) }))} className="w-32" />
          <Select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} options={units.map(u => ({ value: u.id, label: u.name }))} placeholder="Todas as unidades" className="w-48" />
          <div className="ml-auto">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setForm({ unitId: '', year: CY, month: cm, totalCost: 0, totalHires: 0 }); setModalOpen(true) }}>
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
                  <Briefcase className="w-5 h-5 text-[#F59E0B]" />
                  <p className="text-xl font-bold text-gray-900">{item.cph > 0 ? fmtBRL(item.cph) : '—'}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">{item.totalHires > 0 ? `${item.totalHires} contratações no mês` : 'Sem dados'}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Custo/Contratação — Evolução</CardTitle><span className="text-xs text-gray-400">Últimos 6 meses (R$)</span></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [fmtBRL(v), '']} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
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
                <BarChart data={currentCards} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [fmtBRL(v), 'Custo/Contrat.']} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Bar dataKey="cph" radius={[4, 4, 0, 0]}>
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
                <tr>{['Unidade', 'Período', 'Custo Total (R$)', 'Contratações', 'Custo/Contratação', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>}
                {data.map(item => {
                  const cph = item.totalHires > 0 ? Math.round(item.totalCost / item.totalHires) : 0
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: item.unit?.color }} /><span className="font-medium">{item.unit?.name}</span></div></td>
                      <td className="px-4 py-3 text-gray-600">{formatMonthYear(item.year, item.month)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{fmtBRL(item.totalCost)}</td>
                      <td className="px-4 py-3 text-gray-600">{item.totalHires}</td>
                      <td className="px-4 py-3"><span className="font-bold text-[#F59E0B]">{cph > 0 ? fmtBRL(cph) : '—'}</span></td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => { setForm({ unitId: item.unitId, year: item.year, month: item.month, totalCost: item.totalCost, totalHires: item.totalHires }); setModalOpen(true) }}>Editar</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Lançar Custo de Contratação">
        <div className="p-6 space-y-4">
          <Select label="Unidade *" value={form.unitId} onChange={e => setForm({ ...form, unitId: e.target.value })} options={units.map(u => ({ value: u.id, label: u.name }))} placeholder="Selecionar" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Ano" value={String(form.year)} onChange={e => setForm({ ...form, year: Number(e.target.value) })} options={YEARS.map(y => ({ value: String(y), label: String(y) }))} />
            <Select label="Mês" value={String(form.month)} onChange={e => setForm({ ...form, month: Number(e.target.value) })} options={MONTH_OPTS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Custo Total de Contratações (R$)" type="number" min={0} step={100} value={form.totalCost} onChange={e => setForm({ ...form, totalCost: parseFloat(e.target.value) || 0 })} />
            <Input label="Total de Contratações" type="number" min={0} value={form.totalHires} onChange={e => setForm({ ...form, totalHires: Number(e.target.value) })} />
          </div>
          {previewCph > 0 && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-sm text-amber-700 font-medium">Custo por contratação: <strong>{fmtBRL(previewCph)}</strong></p>
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
