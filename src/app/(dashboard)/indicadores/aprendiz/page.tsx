'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Plus, Edit2 } from 'lucide-react'
import { MONTHS_PT, ApprenticeIndicatorData } from '@/types'
import { formatMonthYear } from '@/lib/utils'

interface Unit { id: string; name: string; color: string }

const currentYear = new Date().getFullYear()
const years = [currentYear, currentYear - 1]
const monthOptions = MONTHS_PT.map((label, i) => ({ value: String(i + 1), label }))

export default function AprendizPage() {
  const [data, setData] = useState<ApprenticeIndicatorData[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterUnit, setFilterUnit] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<ApprenticeIndicatorData | null>(null)
  const [form, setForm] = useState({
    unitId: '', year: currentYear, month: new Date().getMonth() + 1,
    totalEmployees: 0, requiredCount: 0, currentCount: 0,
  })

  async function loadData() {
    const params = new URLSearchParams({ year: String(filterYear) })
    if (filterUnit) params.set('unitId', filterUnit)
    const res = await fetch(`/api/indicators/apprentice?${params}`)
    setData(await res.json())
  }

  useEffect(() => { loadData() }, [filterYear, filterUnit])
  useEffect(() => { fetch('/api/units?indicadores=true').then((r) => r.json()).then(setUnits) }, [])

  async function handleSave() {
    await fetch('/api/indicators/apprentice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setModalOpen(false)
    loadData()
  }

  function getStatus(current: number, required: number) {
    if (required === 0) return null
    const pct = (current / required) * 100
    if (pct >= 100) return { label: 'Meta atingida', variant: 'success' as const }
    if (pct >= 85) return { label: 'Atenção', variant: 'warning' as const }
    return { label: 'Abaixo da meta', variant: 'danger' as const }
  }

  const currentMonth = new Date().getMonth() + 1
  const chartData = units.map((unit) => {
    const item = data.find((d) => d.unitId === unit.id && d.month === currentMonth)
    return {
      name: unit.name,
      'Atual': item?.currentCount ?? 0,
      'Obrigatório': item?.requiredCount ?? 0,
    }
  })

  return (
    <>
      <Header title="Indicador Aprendiz" subtitle="Jovens Aprendizes por unidade" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(filterYear)} onChange={(e) => setFilterYear(Number(e.target.value))} options={years.map((y) => ({ value: String(y), label: String(y) }))} className="w-32" />
          <Select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} options={units.map((u) => ({ value: u.id, label: u.name }))} placeholder="Todas as unidades" className="w-48" />
          <div className="ml-auto">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setEditItem(null); setForm({ unitId: '', year: currentYear, month: currentMonth, totalEmployees: 0, requiredCount: 0, currentCount: 0 }); setModalOpen(true) }}>
              Lançar Indicador
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {units.map((unit) => {
            const item = data.find((d) => d.unitId === unit.id && d.month === currentMonth && d.year === filterYear)
            const current = item?.currentCount ?? 0
            const required = item?.requiredCount ?? 0
            const status = getStatus(current, required)
            const pct = required > 0 ? Math.min((current / required) * 100, 100) : 0
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
                      <p className="text-xs text-gray-500">atual / {required} obrigatório</p>
                    </div>
                    {status && <Badge variant={status.variant}>{status.label}</Badge>}
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#10B981' : pct >= 85 ? '#F59E0B' : '#EF4444' }} />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Comparativo por Unidade</CardTitle>
            <span className="text-xs text-gray-400">Mês atual</span>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Atual" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Obrigatório" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Registros — {filterYear}</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>
                  {['Unidade', 'Período', 'Colaboradores', 'Obrigatório', 'Atual', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>}
                {data.map((item) => {
                  const status = getStatus(item.currentCount, item.requiredCount)
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: item.unit?.color }} /><span className="font-medium">{item.unit?.name}</span></div></td>
                      <td className="px-4 py-3 text-gray-600">{formatMonthYear(item.year, item.month)}</td>
                      <td className="px-4 py-3 text-gray-600">{item.totalEmployees.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 font-medium">{item.requiredCount}</td>
                      <td className="px-4 py-3 font-bold">{item.currentCount}</td>
                      <td className="px-4 py-3">{status && <Badge variant={status.variant}>{status.label}</Badge>}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => { setEditItem(item); setForm({ unitId: item.unitId, year: item.year, month: item.month, totalEmployees: item.totalEmployees, requiredCount: item.requiredCount, currentCount: item.currentCount }); setModalOpen(true) }}>Editar</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Lançar Indicador Aprendiz">
        <div className="p-6 space-y-4">
          <Select label="Unidade *" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} options={units.map((u) => ({ value: u.id, label: u.name }))} placeholder="Selecionar" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Ano" value={String(form.year)} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} options={years.map((y) => ({ value: String(y), label: String(y) }))} />
            <Select label="Mês" value={String(form.month)} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })} options={monthOptions} />
          </div>
          <Input label="Total de Colaboradores" type="number" min={0} value={form.totalEmployees} onChange={(e) => setForm({ ...form, totalEmployees: Number(e.target.value) })} />
          <Input label="Quantidade Obrigatória" type="number" min={0} value={form.requiredCount} onChange={(e) => setForm({ ...form, requiredCount: Number(e.target.value) })} />
          <Input label="Quantidade Atual" type="number" min={0} value={form.currentCount} onChange={(e) => setForm({ ...form, currentCount: Number(e.target.value) })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.unitId}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
