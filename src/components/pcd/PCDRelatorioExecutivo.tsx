'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Printer, X, RotateCcw, Pencil, Check, ChevronUp, ChevronDown, ChevronsUpDown, Target } from 'lucide-react'
import { MONTHS_PT, PCDIndicatorData, PcdWeeklySnapshotData } from '@/types'
import { calculatePCDMinimum } from '@/lib/utils'

interface Unit { id: string; name: string; color: string }

interface Props {
  data: PCDIndicatorData[]
  weeklyData: PcdWeeklySnapshotData[]
  units: Unit[]
  filterYear: number
  filterMonth: number
  onClose: () => void
}

const MONTH_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtChartDate(dateStr: string) {
  const datePart = dateStr.slice(0, 10)
  const d = new Date(datePart + 'T12:00:00Z')
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${String(d.getUTCDate()).padStart(2,'0')}/${months[d.getUTCMonth()]}`
}

function gerarNarrativa({
  weekTotals, totalAtual, totalMinimo, totalProjetado, emAndamento,
  pctMeta, faltam, unitsWithPcd, totalUnits, metaPercentage, bestUnit, atencaoUnits,
}: {
  weekTotals: { label: string; total: number }[]
  totalAtual: number
  totalMinimo: number
  totalProjetado: number
  emAndamento: number
  pctMeta: number
  faltam: number
  unitsWithPcd: number
  totalUnits: number
  metaPercentage: number
  bestUnit: { unit: Unit; atual: number; minimo: number; pct: number } | null
  atencaoUnits: { unit: Unit; atual: number; minimo: number; pct: number }[]
}): string {
  const parts: string[] = []

  if (weekTotals.length > 1) {
    const first = weekTotals[0]
    const last = weekTotals[weekTotals.length - 1]
    const delta = last.total - first.total
    const crescimento = first.total > 0 ? Math.round((delta / first.total) * 100) : 0
    parts.push(`<b>Leitura do indicador:</b> o total de colaboradores PCD avançou de <b>${first.total} para ${last.total}</b> desde ${first.label}`)
    if (crescimento > 0) parts.push(`, um crescimento de <b>+${crescimento}%</b>`)
    else if (crescimento < 0) parts.push(`, uma queda de <b>${crescimento}%</b>`)
    parts.push('. ')
  } else {
    parts.push(`<b>Leitura do indicador:</b> o total atual é de <b>${totalAtual} colaboradores PCD</b>. `)
  }

  if (totalUnits > 0) {
    if (unitsWithPcd === totalUnits) {
      parts.push(`Todas as ${totalUnits} unidades já têm ao menos 1 colaborador PCD enquadrado. `)
    } else if (unitsWithPcd > 0) {
      parts.push(`${unitsWithPcd} de ${totalUnits} unidades têm ao menos 1 colaborador PCD enquadrado. `)
    }
  }

  if (emAndamento > 0) {
    parts.push(
      `Há ainda <b>${emAndamento} enquadramento${emAndamento !== 1 ? 's' : ''} e admiss${emAndamento !== 1 ? 'ões' : 'ão'} em andamento</b> no total (ainda não detalhados por unidade), que projetam o total para <b>${totalProjetado} colaboradores (${pctMeta.toFixed(1)}% da meta)</b>. `
    )
  } else {
    parts.push(
      `Com o quadro atual, a projeção é de <b>${totalProjetado} colaboradores (${pctMeta.toFixed(1)}% da meta)</b>. `
    )
  }

  if (faltam > 0) {
    parts.push(
      `A meta legal de ${metaPercentage}% exige <b>${totalMinimo} colaboradores PCD</b> — ainda faltariam <b>${faltam} contratações</b> para a adequação plena.`
    )
  } else if (totalMinimo > 0) {
    parts.push(
      `A meta legal de ${metaPercentage}% exige <b>${totalMinimo} colaboradores PCD</b> — <b>a meta já foi atingida</b> com a projeção atual!`
    )
  }

  if (bestUnit && bestUnit.pct >= 30) {
    parts.push(`\n\n<b>Destaque — ${bestUnit.unit.name}:</b> esta é a unidade <b>mais próxima de concluir a meta PCD</b>, já em ${bestUnit.atual} de ${bestUnit.minimo} colaboradores exigidos (${bestUnit.pct.toFixed(1)}%).`)
    if (bestUnit.pct >= 100) {
      parts.push(` A unidade <b>atingiu a meta</b>.`)
    } else if (bestUnit.pct >= 85) {
      parts.push(` A unidade está em status <b>"Atenção"</b> — muito próxima de atingir o mínimo legal.`)
    }
    const outroAtencao = atencaoUnits.find(a => a.unit.id !== bestUnit.unit.id)
    if (outroAtencao) {
      parts.push(
        ` Vale destacar também <b>${outroAtencao.unit.name}</b> (${outroAtencao.atual}/${outroAtencao.minimo}, ${outroAtencao.pct.toFixed(1)}%), em status "Atenção".`
      )
    }
  }

  return parts.join('')
}

type SortKey = 'unidade' | 'colaboradores' | 'minimo' | 'atual' | 'projetado' | 'progresso' | 'faltam' | 'status'
type SortDir = 'asc' | 'desc'

const METAS_MPT = [
  { label: '1ª Meta', pct: 50, prazo: '30/09/2026', color: '#15AFA4' },
  { label: '2ª Meta', pct: 75, prazo: '31/12/2026', color: '#3B82F6' },
  { label: '3ª Meta', pct: 100, prazo: '31/03/2027', color: '#EF4444' },
]

const TABLE_COLUMNS: { label: string; key: SortKey | null }[] = [
  { label: 'Unidade', key: 'unidade' },
  { label: 'Colaboradores', key: 'colaboradores' },
  { label: 'Mínimo Calc.', key: 'minimo' },
  { label: 'Atual', key: 'atual' },
  { label: 'Andamento', key: null },
  { label: 'Projetado', key: 'projetado' },
  { label: 'Progresso (Projetado)', key: 'progresso' },
  { label: 'Faltam', key: 'faltam' },
  { label: 'Status', key: 'status' },
]

function narrativaStorageKey(year: number, month: number) {
  return `pcd-narrativa-custom-${year}-${month}`
}

export function PCDRelatorioExecutivo({ data, weeklyData, units, filterYear, filterMonth, onClose }: Props) {
  const [emAndamento, setEmAndamento] = useState(0)
  const [narrativaCustom, setNarrativaCustomState] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Carrega texto editado salvo (sobrevive a fechar/reabrir o relatório)
  useEffect(() => {
    const saved = window.localStorage.getItem(narrativaStorageKey(filterYear, filterMonth))
    setNarrativaCustomState(saved)
  }, [filterYear, filterMonth])

  function setNarrativaCustom(value: string | null) {
    setNarrativaCustomState(value)
    const key = narrativaStorageKey(filterYear, filterMonth)
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  useEffect(() => { setMounted(true) }, [])

  // Print CSS
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'pcd-rel-print-css'
    el.textContent = `
      @media print {
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        /* Esconde todo o app (fora do portal do relatório) sem deixar espaço em branco */
        body > *:not(#pcd-rel-print-portal) { display: none !important; }
        #pcd-rel-print-portal {
          position: static !important;
          display: block !important;
        }
        #pcd-rel-scroll-wrapper, #pcd-rel-center-wrapper {
          position: static !important;
          inset: auto !important;
          display: block !important;
          height: auto !important;
          min-height: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
        }
        #pcd-rel-root {
          position: static !important;
          background: white !important;
          padding: 0 !important;
          margin: 0 !important;
          max-width: none !important;
          width: 100% !important;
          overflow: visible !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        .print-hide { display: none !important; }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `
    document.head.appendChild(el)
    return () => { document.getElementById('pcd-rel-print-css')?.remove() }
  }, [])

  const monthData = useMemo(() =>
    units.map(u => {
      const item = data.find(d => d.unitId === u.id && d.month === filterMonth && d.year === filterYear)
      const minimo = item ? calculatePCDMinimum(item.totalEmployees, item.metaPercentage) : 0
      return { unit: u, item, minimo, atual: item?.currentPcd ?? 0 }
    }).filter(r => r.item !== undefined),
    [data, units, filterMonth, filterYear]
  )

  const stats = useMemo(() => {
    const totalColabs = monthData.reduce((s, r) => s + r.item!.totalEmployees, 0)
    const totalMinimo = monthData.reduce((s, r) => s + r.minimo, 0)
    const totalAtual = monthData.reduce((s, r) => s + r.atual, 0)
    const totalProjetado = totalAtual + emAndamento
    const pctMeta = totalMinimo > 0 ? (totalProjetado / totalMinimo) * 100 : 0
    const faltam = Math.max(0, totalMinimo - totalProjetado)
    const metaPercentage = monthData[0]?.item?.metaPercentage ?? 5.5
    const unitsWithPcd = monthData.filter(r => r.atual > 0).length
    return { totalColabs, totalMinimo, totalAtual, totalProjetado, pctMeta, faltam, metaPercentage, unitsWithPcd }
  }, [monthData, emAndamento])

  const weekDates = useMemo(() =>
    Array.from(new Set(weeklyData.map(s => s.weekDate))).sort(),
    [weeklyData]
  )

  const weekTotals = useMemo(() =>
    weekDates.map(wd => ({
      label: fmtChartDate(wd),
      total: units.reduce((s, u) => {
        const snap = weeklyData.find(ws => ws.unitId === u.id && ws.weekDate === wd)
        return s + (snap?.currentPcd ?? 0)
      }, 0),
    })),
    [weekDates, weeklyData, units]
  )

  const rankedUnits = useMemo(() =>
    monthData
      .filter(r => r.minimo > 0)
      .map(r => ({ ...r, pct: (r.atual / r.minimo) * 100 }))
      .sort((a, b) => b.pct - a.pct),
    [monthData]
  )

  const bestUnit = rankedUnits[0] ?? null
  const atencaoUnits = rankedUnits.filter(r => r.pct >= 85 && r.pct < 100)

  const narrativaAuto = useMemo(() =>
    gerarNarrativa({
      weekTotals, totalAtual: stats.totalAtual, totalMinimo: stats.totalMinimo,
      totalProjetado: stats.totalProjetado, emAndamento, pctMeta: stats.pctMeta,
      faltam: stats.faltam, unitsWithPcd: stats.unitsWithPcd, totalUnits: monthData.length,
      metaPercentage: stats.metaPercentage, bestUnit, atencaoUnits,
    }),
    [weekTotals, stats, emAndamento, bestUnit, atencaoUnits, monthData.length]
  )

  const narrativaHtml = narrativaCustom ?? narrativaAuto
  const showChart = weekTotals.length > 0

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const monthName = MONTHS_PT[filterMonth - 1]

  const tableRows = monthData.map(r => {
    const progresso = r.minimo > 0 ? (r.atual / r.minimo) * 100 : 0
    const faltamUnit = Math.max(0, r.minimo - r.atual)
    let statusLabel = '—'
    let statusColor = '#94A3B8'
    if (r.minimo > 0) {
      if (progresso >= 100) { statusLabel = 'Meta atingida'; statusColor = '#10B981' }
      else if (progresso >= 85) { statusLabel = 'Atenção'; statusColor = '#F59E0B' }
      else { statusLabel = 'Abaixo da meta'; statusColor = '#EF4444' }
    }
    return { ...r, progresso, faltamUnit, statusLabel, statusColor }
  })

  const metaCards = useMemo(() =>
    METAS_MPT.map(m => {
      const alvo = Math.round(stats.totalMinimo * m.pct / 100)
      const atualPct = alvo > 0 ? (stats.totalAtual / alvo) * 100 : 0
      const projetadoPct = alvo > 0 ? (stats.totalProjetado / alvo) * 100 : 0
      const faltam = Math.max(0, alvo - stats.totalProjetado)
      return { ...m, alvo, atualPct, projetadoPct, faltam }
    }),
    [stats]
  )

  const sortedTableRows = useMemo(() => {
    if (!sortKey) return tableRows
    const sorted = [...tableRows].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'unidade': cmp = a.unit.name.localeCompare(b.unit.name); break
        case 'colaboradores': cmp = a.item!.totalEmployees - b.item!.totalEmployees; break
        case 'minimo': cmp = a.minimo - b.minimo; break
        case 'atual': cmp = a.atual - b.atual; break
        case 'projetado': cmp = a.atual - b.atual; break
        case 'progresso': cmp = a.progresso - b.progresso; break
        case 'faltam': cmp = a.faltamUnit - b.faltamUnit; break
        case 'status': cmp = a.progresso - b.progresso; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [tableRows, sortKey, sortDir])

  function handleEmAndamentoChange(val: number) {
    setEmAndamento(val)
    setNarrativaCustom(null)
  }

  function handleRestaurar() {
    setNarrativaCustom(null)
    setEditando(false)
  }

  function handleSalvarEdicao() {
    if (textareaRef.current) {
      const plain = textareaRef.current.value.trim()
      setNarrativaCustom(plain ? plain : null)
    }
    setEditando(false)
  }

  function handleEditar() {
    setEditando(true)
    setTimeout(() => {
      if (textareaRef.current) {
        const tmp = document.createElement('div')
        tmp.innerHTML = narrativaHtml
        textareaRef.current.value = tmp.textContent ?? ''
        textareaRef.current.focus()
      }
    }, 0)
  }

  if (!mounted) return null

  return createPortal(
    <div id="pcd-rel-print-portal">
      {/* Print overlay background (print-hidden) */}
      <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto print-hide" />

      {/* Toolbar (print-hidden) */}
      <div className="fixed top-0 left-0 right-0 z-[60] flex justify-center print-hide">
        <div className="w-full max-w-5xl bg-white border-b border-gray-200 shadow-sm px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">
              Relatório Executivo PCD · {monthName}/{filterYear}
            </span>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <span>Em Andamento (pipeline):</span>
              <input
                type="number"
                min={0}
                value={emAndamento}
                onChange={(e) => handleEmAndamentoChange(Number(e.target.value))}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#15AFA4]"
              />
            </label>
            {narrativaCustom !== null && (
              <button
                onClick={handleRestaurar}
                className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Restaurar texto automático
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-[#15AFA4] text-white text-sm rounded-lg hover:bg-[#12a090] transition-colors"
            >
              <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report content */}
      <div id="pcd-rel-scroll-wrapper" className="fixed inset-0 z-[55] overflow-y-auto">
        <div id="pcd-rel-center-wrapper" className="min-h-full flex justify-center py-[68px] px-4">
          <div
            id="pcd-rel-root"
            className="w-full max-w-5xl bg-white shadow-2xl rounded-2xl p-8 print:p-3 self-start"
          >
            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-5 print:mb-2">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 print:text-lg">Registros de PCD — {filterYear}</h1>
                <p className="text-sm text-gray-500 mt-0.5 print:text-[10px]">
                  Acompanhamento mensal por unidade · meta legal de {stats.metaPercentage}% sobre o quadro de colaboradores
                </p>
              </div>
              <div className="flex items-center gap-0.5 text-[11px] flex-shrink-0">
                <span className="px-2 py-1 rounded-md bg-[#15AFA4] text-white font-semibold">Atual</span>
                <span className="px-2 py-1 text-gray-400">Semanal</span>
                <span className="mx-1 text-gray-300">|</span>
                {MONTH_ABBR.map((m, i) => (
                  <span
                    key={i}
                    className={`px-1 ${i + 1 === filterMonth ? 'font-bold text-gray-800 underline underline-offset-2' : 'text-gray-400'}`}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* ── KPI cards ── */}
            <div className="grid grid-cols-5 gap-3 mb-5 print:gap-2 print:mb-2">
              <div className="border border-gray-200 rounded-xl p-4 print:p-2">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-tight">Total de Colaboradores</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 print:text-xl print:mt-0.5">{stats.totalColabs.toLocaleString('pt-BR')}</p>
                <p className="text-[9px] text-gray-400 mt-1 print:mt-0.5">base de cálculo da cota ({monthData.length} unidades)</p>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 print:p-2">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-tight">Mínimo Legal ({stats.metaPercentage}%)</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 print:text-xl print:mt-0.5">{stats.totalMinimo}</p>
                <p className="text-[9px] text-gray-400 mt-1 print:mt-0.5">colaboradores PCD exigidos por lei</p>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 print:p-2">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-tight">Atual</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 print:text-xl print:mt-0.5">{stats.totalAtual}</p>
                <p className="text-[9px] text-gray-400 mt-1 print:mt-0.5">colaboradores PCD ativos hoje</p>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 print:p-2">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-tight">Em Andamento</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 print:text-xl print:mt-0.5">+{emAndamento}</p>
                <p className="text-[9px] text-gray-400 mt-1 print:mt-0.5">enquadramentos e novas admissões em curso</p>
              </div>
              <div className="rounded-xl p-4 print:p-2" style={{ background: '#15AFA4' }}>
                <p className="text-[9px] font-bold text-white/80 uppercase tracking-wide leading-tight">
                  % da Meta Projetada ({stats.totalProjetado} colab.)
                </p>
                <p className="text-3xl font-bold text-white mt-1 print:text-xl print:mt-0.5">{stats.pctMeta.toFixed(1)}%</p>
                <div className="h-1.5 bg-white/30 rounded-full mt-2 print:mt-1 overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(stats.pctMeta, 100)}%` }} />
                </div>
                <p className="text-[9px] text-white/80 mt-1 print:mt-0.5">
                  faltam {stats.faltam} colaboradores mesmo com o pipeline
                </p>
              </div>
            </div>

            {/* ── Table ── */}
            {monthData.length > 0 && (
              <table className="w-full text-sm border-collapse mb-2 print:text-xs">
                <thead>
                  <tr className="border-y border-gray-200 bg-gray-50">
                    {TABLE_COLUMNS.map(col => (
                      <th key={col.label} className="px-3 py-2 print:py-1 text-left text-[9px] font-bold text-gray-500 uppercase tracking-wide">
                        {col.key ? (
                          <button
                            onClick={() => handleSort(col.key!)}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            {col.label}
                            {sortKey === col.key ? (
                              sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 opacity-30" />
                            )}
                          </button>
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTableRows.map(r => (
                    <tr key={r.unit.id} className="border-b border-gray-100">
                      <td className="px-3 py-2.5 print:py-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.unit.color }} />
                          <span className="font-medium text-gray-800 text-xs">{r.unit.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 print:py-1 text-xs text-gray-600">{r.item!.totalEmployees}</td>
                      <td className="px-3 py-2.5 print:py-1 text-xs font-semibold text-gray-800">{r.minimo}</td>
                      <td className="px-3 py-2.5 print:py-1 text-xs font-bold text-gray-900">{r.atual}</td>
                      <td className="px-3 py-2.5 print:py-1 text-xs text-gray-400">—</td>
                      <td className="px-3 py-2.5 print:py-1 text-xs font-bold text-gray-900">{r.atual}</td>
                      <td className="px-3 py-2.5 print:py-1">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-20">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(r.progresso, 100)}%`,
                                background: r.progresso >= 100 ? '#10B981' : r.progresso >= 85 ? '#F59E0B' : '#EF4444',
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{r.progresso.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 print:py-1">
                        <span
                          className="text-xs font-bold"
                          style={{ color: r.faltamUnit > 0 ? '#EF4444' : '#10B981' }}
                        >
                          {r.faltamUnit}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 print:py-1">
                        <span className="text-xs font-semibold" style={{ color: r.statusColor }}>
                          {r.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Legend */}
            <div className="flex gap-6 text-[9px] text-gray-400 mb-5 print:mb-2">
              <span>Em andamento (—) = total de {emAndamento} enquadramentos/admissões ainda não detalhado por unidade</span>
              <span>● Projetado = atual por unidade (sem o pipeline, até detalhamento)</span>
            </div>

            {/* ── Metas do acordo MPT ── */}
            <div className="mb-5 print:mb-2">
              <div className="flex items-center gap-1.5 mb-3 print:mb-1">
                <Target className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Metas do Núcleo de Alphaville conforme acordo MPT — onde estamos em cada prazo
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 print:gap-2">
                {metaCards.map(m => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-gray-200 p-4 print:p-2"
                    style={{ borderLeft: `4px solid ${m.color}` }}
                  >
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{m.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.pct}% da cota · prazo {m.prazo}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1.5 print:text-lg print:mt-0.5">{m.alvo}</p>
                    <p className="text-[9px] text-gray-400 mb-2 print:mb-1">colaboradores PCD exigidos</p>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2 print:mb-1">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(m.projetadoPct, 100)}%`, background: m.color }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-emerald-600 font-semibold whitespace-nowrap">
                        ✓ Atual: {stats.totalAtual} ({m.atualPct.toFixed(1)}%)
                      </span>
                      <span className="text-gray-500 font-semibold whitespace-nowrap">
                        ◐ Projetado: {stats.totalProjetado} ({m.projetadoPct.toFixed(1)}%)
                      </span>
                      <span
                        className="font-bold whitespace-nowrap"
                        style={{ color: m.faltam > 0 ? '#EF4444' : '#10B981' }}
                      >
                        Faltam: {m.faltam}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Bottom section: chart + narrative ── */}
            {(showChart || monthData.length > 0) && (
              <div className={`grid gap-5 print:gap-3 ${showChart ? 'grid-cols-2' : 'grid-cols-1'}`}>

                {/* Line chart — only when weekly data exists */}
                {showChart && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-3 print:mb-1">
                      Evolução do total de colaboradores PCD (todas as unidades)
                    </p>
                    <div className="h-[200px] print:h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weekTotals} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                          formatter={(v: number) => [v, 'Total PCD']}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="#15AFA4"
                          strokeWidth={2.5}
                          isAnimationActive={false}
                          dot={{ fill: '#15AFA4', r: 5, strokeWidth: 2, stroke: 'white' }}
                          activeDot={{ r: 7 }}
                          label={{ position: 'top', fontSize: 11, fill: '#15AFA4', fontWeight: 700 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Narrative text box */}
                <div className="relative">
                  {/* Edit controls — print-hidden */}
                  <div className="flex items-center justify-between mb-2 print-hide">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Leitura do Indicador</p>
                    <div className="flex gap-1">
                      {editando ? (
                        <>
                          <button
                            onClick={handleRestaurar}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg border border-gray-200"
                          >
                            <RotateCcw className="w-3 h-3" /> Restaurar
                          </button>
                          <button
                            onClick={handleSalvarEdicao}
                            className="flex items-center gap-1 text-xs text-white bg-[#15AFA4] px-2 py-1 rounded-lg"
                          >
                            <Check className="w-3 h-3" /> Salvar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleEditar}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg border border-gray-200"
                        >
                          <Pencil className="w-3 h-3" /> Editar texto
                        </button>
                      )}
                    </div>
                  </div>

                  {editando ? (
                    <textarea
                      ref={textareaRef}
                      rows={10}
                      className="w-full border border-amber-200 bg-amber-50/60 rounded-xl p-4 text-sm text-gray-700 leading-relaxed outline-none focus:ring-2 focus:ring-amber-300 resize-none print-hide"
                    />
                  ) : (
                    <div
                      className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 print:p-2 text-sm text-gray-700 leading-relaxed print:text-[10px] print:leading-snug"
                      style={{ whiteSpace: 'pre-line' }}
                      dangerouslySetInnerHTML={{ __html: narrativaHtml }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── Footer ── */}
            <div className="mt-5 pt-3 border-t border-gray-100 text-[10px] text-gray-400 text-right print:mt-2 print:pt-1">
              Dados de {today} · Núcleo de Gestão de Pessoas BHCL
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
