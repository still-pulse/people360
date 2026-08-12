'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Loader2, Calendar, ClipboardList, Clock, Timer, UserX } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TIPO_META } from '@/lib/chamadoMeta'

interface Solicitacao {
  id: string
  tipoSolicitacao: 'HORAS_EXTRAS' | 'BANCO_HORAS' | 'FOLGA' | 'AUSENCIA'
  aprovacaoStatus: 'PENDENTE' | 'APROVADO' | 'REJEITADO' | null
  dataInicio: string | null
  dataFim: string | null
  horasSolicitadas: number | null
  autor: { id: string; name: string }
  unit: { id: string; name: string; color: string } | null
}

interface Props {
  analistas: { id: string; name: string }[]
  onClose: () => void
}

const TIPOS_FILTRO = ['HORAS_EXTRAS', 'BANCO_HORAS', 'AUSENCIA', 'FOLGA'] as const

function getWeekRange(offset = 0) {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay()
  const mon = new Date(now); mon.setDate(now.getDate() - day + 1 + offset * 7)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) }
}

function getMonthRange(offset = 0) {
  const now   = new Date()
  const year  = now.getMonth() + offset < 0 ? now.getFullYear() - 1 : now.getFullYear()
  const month = ((now.getMonth() + offset) % 12 + 12) % 12
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) }
}

const SHORTCUTS = [
  { label: 'Esta semana',    fn: () => getWeekRange(0)   },
  { label: 'Semana passada', fn: () => getWeekRange(-1)  },
  { label: 'Este mês',       fn: () => getMonthRange(0)  },
  { label: 'Mês passado',    fn: () => getMonthRange(-1) },
]

function fmtDateBR(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
}

function diasNoPeriodo(inicio: string, fim: string | null) {
  if (!fim) return 1
  const d1 = new Date(inicio.slice(0, 10))
  const d2 = new Date(fim.slice(0, 10))
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
}

export function ChamadosRelatorioAdmin({ analistas, onClose }: Props) {
  const monthRange = getMonthRange(0)
  const [startDate, setStartDate]     = useState(monthRange.start)
  const [endDate, setEndDate]         = useState(monthRange.end)
  const [activeShortcut, setShortcut] = useState('Este mês')
  const [filterAutor, setFilterAutor] = useState('')
  const [filterTipo, setFilterTipo]   = useState('')
  const [loading, setLoading]         = useState(false)
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[] | null>(null)

  function applyShortcut(s: typeof SHORTCUTS[number]) {
    const range = s.fn()
    setStartDate(range.start); setEndDate(range.end); setShortcut(s.label)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ startDate, endDate })
    if (filterAutor) params.set('autorId', filterAutor)
    const res = await fetch(`/api/chamados/relatorio?${params}`)
    if (res.ok) {
      const data = await res.json()
      setSolicitacoes(data.solicitacoes)
    }
    setLoading(false)
  }, [startDate, endDate, filterAutor])

  useEffect(() => { load() }, [load])

  const filtradas = useMemo(
    () => (solicitacoes ?? []).filter((s) => !filterTipo || s.tipoSolicitacao === filterTipo),
    [solicitacoes, filterTipo],
  )

  const kpis = useMemo(() => {
    const horasExtras = filtradas.filter((s) => s.tipoSolicitacao === 'HORAS_EXTRAS')
    const bancoHoras   = filtradas.filter((s) => s.tipoSolicitacao === 'BANCO_HORAS')
    const ausencias    = filtradas.filter((s) => s.tipoSolicitacao === 'AUSENCIA')
    return {
      total: filtradas.length,
      horasExtras: {
        qtd: horasExtras.length,
        horas: horasExtras.reduce((s, c) => s + (c.horasSolicitadas ?? 0), 0),
      },
      bancoHoras: {
        qtd: bancoHoras.length,
        horas: bancoHoras.reduce((s, c) => s + (c.horasSolicitadas ?? 0), 0),
      },
      ausencias: {
        qtd: ausencias.length,
        dias: ausencias.reduce((s, c) => s + (c.dataInicio ? diasNoPeriodo(c.dataInicio, c.dataFim) : 0), 0),
      },
    }
  }, [filtradas])

  const porAnalista = useMemo(() => {
    const map = new Map<string, {
      nome: string
      HORAS_EXTRAS: number; BANCO_HORAS: number; AUSENCIA: number; FOLGA: number
      horasExtras: number; bancoHoras: number; dias: number
      aprovado: number; pendente: number; rejeitado: number
      total: number
    }>()
    for (const s of filtradas) {
      const key = s.autor.id
      if (!map.has(key)) {
        map.set(key, {
          nome: s.autor.name,
          HORAS_EXTRAS: 0, BANCO_HORAS: 0, AUSENCIA: 0, FOLGA: 0,
          horasExtras: 0, bancoHoras: 0, dias: 0,
          aprovado: 0, pendente: 0, rejeitado: 0,
          total: 0,
        })
      }
      const row = map.get(key)!
      row[s.tipoSolicitacao] += 1
      row.total += 1
      if (s.tipoSolicitacao === 'HORAS_EXTRAS') row.horasExtras += s.horasSolicitadas ?? 0
      if (s.tipoSolicitacao === 'BANCO_HORAS')  row.bancoHoras  += s.horasSolicitadas ?? 0
      if (s.tipoSolicitacao === 'AUSENCIA' && s.dataInicio) row.dias += diasNoPeriodo(s.dataInicio, s.dataFim)
      if (s.aprovacaoStatus === 'APROVADO')  row.aprovado += 1
      else if (s.aprovacaoStatus === 'REJEITADO') row.rejeitado += 1
      else row.pendente += 1
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filtradas])

  const chartPorAnalista = porAnalista.map((r) => ({
    name: r.nome.split(' ')[0],
    full: r.nome,
    ...Object.fromEntries(TIPOS_FILTRO.map((t) => [t, r[t]])),
  }))

  const chartPorTipo = TIPOS_FILTRO.map((t) => ({
    name: TIPO_META[t].label,
    value: filtradas.filter((s) => s.tipoSolicitacao === t).length,
    color: TIPO_META[t].hex,
  }))

  return (
    <Modal open onClose={onClose} title="Relatório · Solicitações das Analistas" size="xl">
      <div className="p-6 space-y-5">
        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3 pb-4 border-b border-gray-100">
          <div className="flex gap-2 flex-wrap">
            {SHORTCUTS.map((s) => (
              <button key={s.label} onClick={() => applyShortcut(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  activeShortcut === s.label
                    ? 'bg-[#15AFA4] text-white border-[#15AFA4]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#15AFA4] hover:text-[#15AFA4]'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input type="date" value={startDate} max={endDate}
              onChange={(e) => { setStartDate(e.target.value); setShortcut('') }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#15AFA4]" />
            <span className="text-gray-400 text-xs">até</span>
            <input type="date" value={endDate} min={startDate}
              onChange={(e) => { setEndDate(e.target.value); setShortcut('') }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#15AFA4]" />
          </div>
          <Select value={filterAutor} onChange={(e) => setFilterAutor(e.target.value)} className="w-44 text-xs">
            <option value="">Todas as analistas</option>
            {analistas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="w-40 text-xs">
            <option value="">Todos os tipos</option>
            {TIPOS_FILTRO.map((t) => <option key={t} value={t}>{TIPO_META[t].label}</option>)}
          </Select>
          <Button size="sm" onClick={load} isLoading={loading} className="ml-auto">Aplicar</Button>
        </div>

        {loading && !solicitacoes ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-[#15AFA4] animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <ClipboardList className="w-4 h-4 text-gray-400 mb-1.5" />
                <p className="text-2xl font-bold text-gray-900">{kpis.total}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Total de solicitações</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <Clock className="w-4 h-4 text-indigo-500 mb-1.5" />
                <p className="text-2xl font-bold text-gray-900">{kpis.horasExtras.qtd}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Horas extras · {kpis.horasExtras.horas}h</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <Timer className="w-4 h-4 text-purple-500 mb-1.5" />
                <p className="text-2xl font-bold text-gray-900">{kpis.bancoHoras.qtd}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Banco de horas · {kpis.bancoHoras.horas}h</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <UserX className="w-4 h-4 text-orange-500 mb-1.5" />
                <p className="text-2xl font-bold text-gray-900">{kpis.ausencias.qtd}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Ausências · {kpis.ausencias.dias} dia(s)</p>
              </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Solicitações por analista</p>
                {chartPorAnalista.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Sem dados no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(160, chartPorAnalista.length * 32)}>
                    <BarChart layout="vertical" data={chartPorAnalista} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                      <Tooltip
                        formatter={(v: any, key: any) => [v, TIPO_META[key as keyof typeof TIPO_META]?.label ?? key]}
                        labelFormatter={(_l, p: any) => p?.[0]?.payload?.full}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      />
                      {TIPOS_FILTRO.map((t) => (
                        <Bar key={t} dataKey={t} stackId="tipo" fill={TIPO_META[t].hex} radius={[0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Distribuição por tipo</p>
                {kpis.total === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Sem dados no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart layout="vertical" data={chartPorTipo} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartPorTipo.map((t, i) => <Cell key={i} fill={t.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Tabela por analista */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Detalhamento por analista</p>
              {porAnalista.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-xs">
                  Nenhuma solicitação encontrada no período
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['Analista', 'Horas extras', 'Banco de horas', 'Ausência', 'Folga', 'Total', 'Aprovação'].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {porAnalista.map((r) => (
                          <tr key={r.nome} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2.5 font-medium text-gray-900">{r.nome}</td>
                            <td className="px-3 py-2.5 text-gray-600">{r.HORAS_EXTRAS} <span className="text-gray-400">({r.horasExtras}h)</span></td>
                            <td className="px-3 py-2.5 text-gray-600">{r.BANCO_HORAS} <span className="text-gray-400">({r.bancoHoras}h)</span></td>
                            <td className="px-3 py-2.5 text-gray-600">{r.AUSENCIA} <span className="text-gray-400">({r.dias}d)</span></td>
                            <td className="px-3 py-2.5 text-gray-600">{r.FOLGA}</td>
                            <td className="px-3 py-2.5 font-semibold text-gray-900">{r.total}</td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex items-center gap-2 text-[11px]">
                                <span className="text-green-600 font-medium">{r.aprovado}✓</span>
                                <span className="text-amber-600 font-medium">{r.pendente}⏳</span>
                                <span className="text-red-500 font-medium">{r.rejeitado}✕</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
