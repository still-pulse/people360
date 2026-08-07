'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { Plus, Edit2 } from 'lucide-react'
import { MONTHS_PT, AbsenteeismIndicatorData } from '@/types'
import { calculateAbsenteeismRate, formatMonthYear, formatMonthShort } from '@/lib/utils'

interface Unit { id: string; name: string; color: string }

const currentYear = new Date().getFullYear()
const years = [currentYear, currentYear - 1]
const monthOptions = MONTHS_PT.map((label, i) => ({ value: String(i + 1), label }))

export default function AbsenteismoPage() {
  const [data, setData] = useState<AbsenteeismIndicatorData[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterUnit, setFilterUnit] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    unitId: '', year: currentYear, month: new Date().getMonth() + 1,
    totalCertificates: 0, totalDaysLost: 0, totalEmployees: 0, workingDaysInMonth: 22,
  })

  async function loadData() {
    const params = new URLSearchParams({ year: String(filterYear) })
    if (filterUnit) params.set('unitId', filterUnit)
    const res = await fetch(`/api/indicators/absenteeism?${params}`)
    setData(await res.json())
  }

  useEffect(() => { loadData() }, [filterYear, filterUnit])
  useEffect(() => { fetch('/api/units?indicadores=true').then((r) => r.json()).then(setUnits) }, [])

  async function handleSave() {
    await fetch('/api/indicators/absenteeism', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setModalOpen(false)
    loadData()
  }

  const currentMonth = new Date().getMonth() + 1

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, new Date().getMonth() - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: formatMonthShort(d.getFullYear(), d.getMonth() + 1) }
  })

  const trendDays = months.map(({ year, month, label }) => {
    const entry: Record<string, number | string> = { month: label }
    units.forEach((unit) => {
      const item = data.find((d) => d.unitId === unit.id && d.month === month && d.year === year)
      entry[unit.name] = item?.totalDaysLost ?? 0
    })
    return entry
  })

  const trendRate = months.map(({ year, month, label }) => {
    const entry: Record<string, number | string> = { month: label }
    units.forEach((unit) => {
      const item = data.find((d) => d.unitId === unit.id && d.month === month && d.year === year)
      if (item) {
        entry[unit.name] = parseFloat(calculateAbsenteeismRate(item.totalDaysLost, item.totalEmployees, item.workingDaysInMonth).toFixed(2))
      }
    })
    return entry
  })

  const previewRate = calculateAbsenteeismRate(form.totalDaysLost, form.totalEmployees, form.workingDaysInMonth)

  return (
    <>
      <Header title="Indicador Absenteísmo" subtitle="Controle de ausências e atestados por unidade" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(filterYear)} onChange={(e) => setFilterYear(Number(e.target.value))} options={years.map((y) => ({ value: String(y), label: String(y) }))} className="w-32" />
          <Select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} options={units.map((u) => ({ value: u.id, label: u.name }))} placeholder="Todas as unidades" className="w-48" />
          <div className="ml-auto">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setForm({ unitId: '', year: currentYear, month: currentMonth, totalCertificates: 0, totalDaysLost: 0, totalEmployees: 0, workingDaysInMonth: 22 }); setModalOpen(true) }}>
              Lançar Indicador
            </Button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {units.map((unit) => {
            const item = data.find((d) => d.unitId === unit.id && d.month === currentMonth && d.year === filterYear)
            const rate = item ? calculateAbsenteeismRate(item.totalDaysLost, item.totalEmployees, item.workingDaysInMonth) : 0
            return (
              <Card key={unit.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ background: unit.color }} />
                    <span className="text-sm font-semibold text-gray-800">{unit.name}</span>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-gray-900">{item?.totalDaysLost ?? 0} <span className="text-sm text-gray-500 font-normal">dias</span></p>
                  <p className="text-sm font-semibold mt-1" style={{ color: rate > 2 ? '#EF4444' : '#10B981' }}>{rate.toFixed(2)}% absenteísmo</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item?.totalCertificates ?? 0} atestados</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Dias Perdidos por Unidade</CardTitle><span className="text-xs text-gray-400">Últimos 6 meses</span></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendDays} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  {units.map((u) => <Bar key={u.name} dataKey={u.name} fill={u.color} radius={[4, 4, 0, 0]} />)}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Taxa de Absenteísmo (%)</CardTitle><span className="text-xs text-gray-400">Evolução histórica</span></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendRate} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
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
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader><CardTitle>Registros — {filterYear}</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>
                  {['Unidade', 'Período', 'Atestados', 'Dias Perdidos', 'Colaboradores', 'Dias Úteis', 'Taxa', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>}
                {data.map((item) => {
                  const rate = calculateAbsenteeismRate(item.totalDaysLost, item.totalEmployees, item.workingDaysInMonth)
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: item.unit?.color }} /><span className="font-medium">{item.unit?.name}</span></div></td>
                      <td className="px-4 py-3 text-gray-600">{formatMonthYear(item.year, item.month)}</td>
                      <td className="px-4 py-3 text-gray-600">{item.totalCertificates}</td>
                      <td className="px-4 py-3 font-bold text-gray-900">{item.totalDaysLost}</td>
                      <td className="px-4 py-3 text-gray-600">{item.totalEmployees}</td>
                      <td className="px-4 py-3 text-gray-600">{item.workingDaysInMonth}</td>
                      <td className="px-4 py-3"><span className={`font-bold ${rate > 2 ? 'text-red-500' : 'text-green-600'}`}>{rate.toFixed(2)}%</span></td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => { setForm({ unitId: item.unitId, year: item.year, month: item.month, totalCertificates: item.totalCertificates, totalDaysLost: item.totalDaysLost, totalEmployees: item.totalEmployees, workingDaysInMonth: item.workingDaysInMonth }); setModalOpen(true) }}>Editar</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Lançar Indicador de Absenteísmo">
        <div className="p-6 space-y-4">
          <Select label="Unidade *" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} options={units.map((u) => ({ value: u.id, label: u.name }))} placeholder="Selecionar" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Ano" value={String(form.year)} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} options={years.map((y) => ({ value: String(y), label: String(y) }))} />
            <Select label="Mês" value={String(form.month)} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })} options={monthOptions} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Total de Atestados" type="number" min={0} value={form.totalCertificates} onChange={(e) => setForm({ ...form, totalCertificates: Number(e.target.value) })} />
            <Input label="Total de Dias Perdidos" type="number" min={0} value={form.totalDaysLost} onChange={(e) => setForm({ ...form, totalDaysLost: Number(e.target.value) })} />
            <Input label="Total de Colaboradores" type="number" min={0} value={form.totalEmployees} onChange={(e) => setForm({ ...form, totalEmployees: Number(e.target.value) })} />
            <Input label="Dias Úteis no Mês" type="number" min={1} max={31} value={form.workingDaysInMonth} onChange={(e) => setForm({ ...form, workingDaysInMonth: Number(e.target.value) })} />
          </div>
          {form.totalDaysLost > 0 && form.totalEmployees > 0 && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-sm text-amber-700 font-medium">
                Taxa calculada: <strong>{previewRate.toFixed(2)}%</strong>
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
