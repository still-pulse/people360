'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts'
import { Save, Plus } from 'lucide-react'
import { MONTHS_PT } from '@/types'
import { formatMonthShort } from '@/lib/utils'

interface Unit { id: string; name: string; color: string }
interface Position { id: string; name: string }
interface HeadcountEntry {
  id: string; unitId: string; positionId: string; year: number; month: number; count: number
  unit?: Unit; position?: Position
}

const currentYear = new Date().getFullYear()
const years = [currentYear, currentYear - 1]
const monthOptions = MONTHS_PT.map((label, i) => ({ value: String(i + 1), label }))

export default function HeadcountPage() {
  const [data, setData] = useState<HeadcountEntry[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterUnit, setFilterUnit] = useState('')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<Record<string, number>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [newPositionName, setNewPositionName] = useState('')

  const loadData = useCallback(async () => {
    const params = new URLSearchParams({ year: String(filterYear), month: String(filterMonth) })
    if (filterUnit) params.set('unitId', filterUnit)
    const res = await fetch(`/api/headcount?${params}`)
    const d: HeadcountEntry[] = await res.json()
    setData(d)
    const map: Record<string, number> = {}
    d.forEach((e) => { map[`${e.unitId}_${e.positionId}`] = e.count })
    setEditData(map)
  }, [filterYear, filterMonth, filterUnit])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    fetch('/api/units').then((r) => r.json()).then(setUnits)
    fetch('/api/positions').then((r) => r.json()).then(setPositions)
  }, [])

  async function handleSave() {
    setIsSaving(true)
    const displayedUnits = filterUnit ? units.filter((u) => u.id === filterUnit) : units
    const entries = displayedUnits.flatMap((unit) =>
      positions.map((pos) => ({
        unitId: unit.id,
        positionId: pos.id,
        year: filterYear,
        month: filterMonth,
        count: editData[`${unit.id}_${pos.id}`] ?? 0,
      }))
    )

    await fetch('/api/headcount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entries),
    })
    setIsSaving(false)
    setEditMode(false)
    loadData()
  }

  async function addPosition() {
    if (!newPositionName.trim()) return
    await fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPositionName }),
    })
    setNewPositionName('')
    fetch('/api/positions').then((r) => r.json()).then(setPositions)
  }

  // Dados para gráfico por cargo
  const displayedUnits = filterUnit ? units.filter((u) => u.id === filterUnit) : units
  const positionChart = positions.map((pos) => {
    const entry: Record<string, number | string> = { name: pos.name }
    displayedUnits.forEach((unit) => {
      const key = `${unit.id}_${pos.id}`
      entry[unit.name] = editData[key] ?? 0
    })
    return entry
  }).filter((e) => displayedUnits.some((u) => (e[u.name] as number) > 0))

  // Total por unidade
  const unitTotals = displayedUnits.map((unit) => ({
    name: unit.name,
    color: unit.color,
    total: positions.reduce((sum, pos) => sum + (editData[`${unit.id}_${pos.id}`] ?? 0), 0),
  }))

  // Trend histórico (últimos 6 meses)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(filterYear, filterMonth - 1 - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: formatMonthShort(d.getFullYear(), d.getMonth() + 1) }
  })

  return (
    <>
      <Header title="Headcount" subtitle="Dimensionamento e evolução do quadro de pessoal" />
      <div className="p-6 space-y-6">
        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(filterYear)} onChange={(e) => setFilterYear(Number(e.target.value))} options={years.map((y) => ({ value: String(y), label: String(y) }))} className="w-28" />
          <Select value={String(filterMonth)} onChange={(e) => setFilterMonth(Number(e.target.value))} options={monthOptions} className="w-40" />
          <Select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} options={units.map((u) => ({ value: u.id, label: u.name }))} placeholder="Todas as unidades" className="w-48" />
          <div className="ml-auto flex gap-2">
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
                <Button icon={<Save className="w-4 h-4" />} isLoading={isSaving} onClick={handleSave}>Salvar</Button>
              </>
            ) : (
              <Button onClick={() => setEditMode(true)}>Editar Headcount</Button>
            )}
          </div>
        </div>

        {/* Cards de total por unidade */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {unitTotals.map((unit) => (
            <Card key={unit.name}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: unit.color }} />
                  <span className="text-sm font-semibold text-gray-800">{unit.name}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{unit.total.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-gray-500 mt-1">colaboradores em {MONTHS_PT[filterMonth - 1]}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabela editável */}
        <Card>
          <CardHeader>
            <CardTitle>Quadro por Cargo — {MONTHS_PT[filterMonth - 1]}/{filterYear}</CardTitle>
            {editMode && (
              <div className="flex items-center gap-2">
                <input
                  value={newPositionName}
                  onChange={(e) => setNewPositionName(e.target.value)}
                  placeholder="Novo cargo..."
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#15AFA4]"
                  onKeyDown={(e) => e.key === 'Enter' && addPosition()}
                />
                <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addPosition}>Adicionar</Button>
              </div>
            )}
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cargo</th>
                  {displayedUnits.map((unit) => (
                    <th key={unit.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: unit.color }} />
                        {unit.name}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {positions.map((pos) => {
                  const rowTotal = displayedUnits.reduce((sum, unit) => sum + (editData[`${unit.id}_${pos.id}`] ?? 0), 0)
                  return (
                    <tr key={pos.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-800">{pos.name}</td>
                      {displayedUnits.map((unit) => {
                        const key = `${unit.id}_${pos.id}`
                        return (
                          <td key={unit.id} className="px-4 py-3">
                            {editMode ? (
                              <input
                                type="number"
                                min={0}
                                value={editData[key] ?? 0}
                                onChange={(e) => setEditData((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                                className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-center outline-none focus:border-[#15AFA4]"
                              />
                            ) : (
                              <span className="text-gray-700">{editData[key] ?? 0}</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 font-bold text-gray-900">{rowTotal}</td>
                    </tr>
                  )
                })}
                {/* Linha de total */}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-gray-800">Total Geral</td>
                  {displayedUnits.map((unit) => {
                    const colTotal = positions.reduce((sum, pos) => sum + (editData[`${unit.id}_${pos.id}`] ?? 0), 0)
                    return <td key={unit.id} className="px-4 py-3 text-gray-900">{colTotal}</td>
                  })}
                  <td className="px-4 py-3 text-gray-900">
                    {unitTotals.reduce((sum, u) => sum + u.total, 0).toLocaleString('pt-BR')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Gráfico */}
        {positionChart.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Cargo</CardTitle>
              <span className="text-xs text-gray-400">Por unidade</span>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={positionChart} margin={{ top: 5, right: 20, left: -10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  {displayedUnits.map((u) => (
                    <Bar key={u.name} dataKey={u.name} fill={u.color} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
