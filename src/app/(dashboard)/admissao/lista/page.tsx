'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Search, RefreshCw, FileSpreadsheet, ExternalLink, ArrowUp, ArrowDown,
  ArrowUpDown, UserCheck, CalendarDays,
} from 'lucide-react'
import {
  AdmissaoItem, MONTHS_PT, TIPO_VAGA_LABELS, TIPO_REQUISICAO_LABELS,
  VAGA_STATUS_LABELS, VAGA_STATUS_COLORS,
} from '@/types'
import { formatDate } from '@/lib/utils'

const TABS = [
  { label: 'Dashboard', href: '/admissao' },
  { label: 'Lista de Admitidos', href: '/admissao/lista' },
]

type SortCol = 'inicio' | 'nome' | 'cargo' | 'abertura' | 'dias' | ''

function ListaContent() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const canFilterAllUnits = ['ADMIN', 'SUPERINTENDENT', 'GERENTE'].includes(session?.user?.role ?? '')

  const now = new Date()
  const [year, setYear] = useState(
    searchParams.get('year') ? parseInt(searchParams.get('year')!) : now.getFullYear()
  )
  const [month, setMonth] = useState(
    searchParams.get('month') ? parseInt(searchParams.get('month')!) : 0 // 0 = ano todo
  )
  const [day, setDay] = useState(
    searchParams.get('day') ? parseInt(searchParams.get('day')!) : 0
  )
  const [unitId, setUnitId] = useState(searchParams.get('unitId') ?? '')
  const [status, setStatus] = useState<'todos' | 'contratados' | 'em_andamento'>(
    (searchParams.get('status') as any) || 'contratados'
  )
  const [tipoVaga, setTipoVaga] = useState('')
  const [search, setSearch] = useState('')
  const [dateField, setDateField] = useState<'inicio' | 'fechamento' | 'abertura'>('inicio')

  const [items, setItems] = useState<AdmissaoItem[]>([])
  const [units, setUnits] = useState<{ id: string; name: string; color: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortCol, setSortCol] = useState<SortCol>('inicio')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  async function load() {
    setIsLoading(true)
    const params = new URLSearchParams()
    params.set('status', status)
    params.set('dateField', dateField)
    if (year) params.set('year', String(year))
    if (month) params.set('month', String(month))
    if (day && month) params.set('day', String(day))
    if (unitId) params.set('unitId', unitId)
    if (tipoVaga) params.set('tipoVaga', tipoVaga)
    if (search.trim()) params.set('search', search.trim())

    const res = await fetch(`/api/admissao?${params}`)
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setIsLoading(false)
  }

  useEffect(() => {
    fetch('/api/units').then((r) => r.json()).then((d) => setUnits(Array.isArray(d) ? d : []))
  }, [])

  // debounce search + demais filtros
  useEffect(() => {
    const t = setTimeout(() => load(), search ? 300 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day, unitId, status, tipoVaga, dateField, search])

  const sorted = useMemo(() => {
    const list = [...items]
    if (!sortCol) return list
    const mul = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortCol === 'nome') return a.colaboradorNome.localeCompare(b.colaboradorNome, 'pt-BR') * mul
      if (sortCol === 'cargo') return a.cargo.localeCompare(b.cargo, 'pt-BR') * mul
      if (sortCol === 'dias') {
        return ((a.diasAberturaAteInicio ?? -1) - (b.diasAberturaAteInicio ?? -1)) * mul
      }
      if (sortCol === 'abertura') {
        return (new Date(a.dataAbertura).getTime() - new Date(b.dataAbertura).getTime()) * mul
      }
      // inicio
      const da = a.dataInicioEfetiva ? new Date(a.dataInicioEfetiva).getTime() : 0
      const db = b.dataInicioEfetiva ? new Date(b.dataInicioEfetiva).getTime() : 0
      return (da - db) * mul
    })
    return list
  }, [items, sortCol, sortDir])

  // Agrupamento por dia (resumo)
  const byDay = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number; items: AdmissaoItem[] }>()
    for (const it of sorted) {
      const key = it.dataInicioKey ?? 'sem-data'
      const label = it.dataInicioEfetiva
        ? formatDate(it.dataInicioEfetiva)
        : 'Sem data de início'
      if (!map.has(key)) map.set(key, { key, label, count: 0, items: [] })
      const g = map.get(key)!
      g.count++
      g.items.push(it)
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.key === 'sem-data') return 1
      if (b.key === 'sem-data') return -1
      return sortDir === 'asc' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key)
    })
  }, [sorted, sortDir])

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortCol(col)
      setSortDir(col === 'nome' || col === 'cargo' ? 'asc' : 'desc')
    }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-gray-300" />
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-[#15AFA4]" />
      : <ArrowDown className="w-3 h-3 text-[#15AFA4]" />
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const rows = sorted.map((a) => ({
      Colaborador: a.colaboradorNome,
      Cargo: a.cargo,
      Unidade: a.unit?.name ?? '',
      Município: a.municipio ?? '',
      Setor: a.setor ?? '',
      Status: VAGA_STATUS_LABELS[a.status] ?? a.status,
      'Data Início': a.dataInicioEfetiva ? formatDate(a.dataInicioEfetiva) : '',
      'Data Fechamento': a.dataFechamento ? formatDate(a.dataFechamento) : '',
      'Data Abertura': formatDate(a.dataAbertura),
      'Dias até início': a.diasAberturaAteInicio ?? '',
      Tipo: TIPO_VAGA_LABELS[a.tipoVaga] ?? a.tipoVaga,
      Requisição: a.tipoRequisicao
        ? TIPO_REQUISICAO_LABELS[a.tipoRequisicao]
        : '',
      PCD: a.vagaPcd ? 'Sim' : 'Não',
      'Processo Admissão': a.numProcessoAdmissao ?? '',
      'Protocolo Onvio': a.numProtocoloOnvio ?? '',
      Gestor: a.gestorRequisitante ?? '',
      'Substituindo': a.nomeColaboradorSaiu ?? '',
      Analistas: (a.analistas ?? []).map((x) => x.name).join(', '),
      Telefone: a.telefone ?? '',
      'E-mail': a.email ?? '',
      'Título': a.titulo,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Admitidos')

    // Aba resumo por dia
    const resumo = byDay.map((g) => ({
      Data: g.label,
      Quantidade: g.count,
      Colaboradores: g.items.map((i) => i.colaboradorNome).join('; '),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Por Dia')

    XLSX.writeFile(
      wb,
      `admitidos_${year}${month ? `_${String(month).padStart(2, '0')}` : ''}${day ? `_${String(day).padStart(2, '0')}` : ''}.xlsx`
    )
  }

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i)
  const daysInMonth = month ? new Date(year, month, 0).getDate() : 0

  return (
    <>
      <Header
        title="Controle de Admissão"
        subtitle="Lista de colaboradores contratados e em admissão"
      />
      <div className="p-6 flex flex-col gap-5">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.href}
              onClick={() => router.push(t.href)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                t.href === '/admissao/lista'
                  ? 'bg-white text-[#15AFA4] shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setDay(0) }}
            className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => { setMonth(Number(e.target.value)); setDay(0) }}
            className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white"
          >
            <option value={0}>Ano inteiro</option>
            {MONTHS_PT.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          {month > 0 && (
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white"
            >
              <option value={0}>Todos os dias</option>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Dia {String(d).padStart(2, '0')}
                </option>
              ))}
            </select>
          )}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white"
          >
            <option value="contratados">Contratados / Fechadas</option>
            <option value="em_andamento">Em admissão</option>
            <option value="todos">Todos (pipeline)</option>
          </select>
          <select
            value={dateField}
            onChange={(e) => setDateField(e.target.value as any)}
            className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white"
            title="Campo de data usado no filtro de período"
          >
            <option value="inicio">Filtrar por data de início</option>
            <option value="fechamento">Filtrar por fechamento</option>
            <option value="abertura">Filtrar por abertura</option>
          </select>
          {canFilterAllUnits && (
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white min-w-[140px]"
            >
              <option value="">Todas unidades</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          <select
            value={tipoVaga}
            onChange={(e) => setTipoVaga(e.target.value)}
            className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white"
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TIPO_VAGA_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar colaborador, cargo, processo…"
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-sm bg-white"
            />
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            disabled={!sorted.length}
            className="gap-1.5 ml-auto"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </Button>
        </div>

        {/* Resumo por dia (chips) */}
        {!isLoading && byDay.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {byDay.slice(0, 20).map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => {
                  if (g.key === 'sem-data') return
                  const [y, m, d] = g.key.split('-').map(Number)
                  setYear(y)
                  setMonth(m)
                  setDay(d)
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  day && g.key === `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    ? 'bg-[#15AFA4] text-white border-[#15AFA4]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#15AFA4]/40'
                }`}
              >
                <CalendarDays className="w-3 h-3" />
                {g.label}
                <span
                  className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    day && g.key === `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      ? 'bg-white/25 text-white'
                      : 'bg-[#15AFA4]/15 text-[#0d8c83]'
                  }`}
                >
                  {g.count}
                </span>
              </button>
            ))}
            {day > 0 && (
              <button
                type="button"
                onClick={() => setDay(0)}
                className="text-xs font-semibold text-gray-500 hover:text-[#15AFA4] px-2"
              >
                Limpar dia
              </button>
            )}
          </div>
        )}

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#15AFA4]" />
                {isLoading ? 'Carregando…' : `${sorted.length} registro(s)`}
              </CardTitle>
              {day > 0 && month > 0 && (
                <span className="text-xs text-gray-500">
                  Filtrado: {String(day).padStart(2, '0')}/{String(month).padStart(2, '0')}/{year}
                </span>
              )}
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-gray-400 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-2.5 font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('nome')}>
                      Colaborador <SortIcon col="nome" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('cargo')}>
                      Cargo <SortIcon col="cargo" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">Unidade</th>
                  <th className="px-3 py-2.5 font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('inicio')}>
                      Data início <SortIcon col="inicio" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('abertura')}>
                      Abertura <SortIcon col="abertura" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('dias')}>
                      Dias <SortIcon col="dias" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">Tipo</th>
                  <th className="px-3 py-2.5 font-medium">Processo</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Analistas</th>
                  <th className="px-3 py-2.5 font-medium w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td colSpan={11} className="px-4 py-3">
                        <div className="h-8 bg-gray-50 animate-pulse rounded-lg" />
                      </td>
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-400 text-sm">
                      Nenhum registro encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  sorted.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-gray-50 hover:bg-[#15AFA4]/5 cursor-pointer transition-colors"
                      onClick={() => router.push(`/vagas/${a.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{a.colaboradorNome}</div>
                        {a.telefone && (
                          <div className="text-[11px] text-gray-400">{a.telefone}</div>
                        )}
                        {a.vagaPcd && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            PCD
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-700 text-xs max-w-[160px]">
                        <span className="line-clamp-2">{a.cargo}</span>
                      </td>
                      <td className="px-3 py-3">
                        {a.unit ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.unit.color }} />
                            {a.unit.name}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-gray-800 whitespace-nowrap">
                        {a.dataInicioEfetiva ? formatDate(a.dataInicioEfetiva) : (
                          <span className="text-amber-500 font-medium">Sem data</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(a.dataAbertura)}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600">
                        {a.diasAberturaAteInicio != null ? (
                          <span className="font-medium">{a.diasAberturaAteInicio}d</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {TIPO_VAGA_LABELS[a.tipoVaga] ?? a.tipoVaga}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {a.numProcessoAdmissao || a.numProtocoloOnvio ? (
                          <div>
                            {a.numProcessoAdmissao && <div title="Processo">{a.numProcessoAdmissao}</div>}
                            {a.numProtocoloOnvio && (
                              <div className="text-[10px] text-gray-400" title="Onvio">{a.numProtocoloOnvio}</div>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            background: (VAGA_STATUS_COLORS[a.status] ?? '#94A3B8') + '18',
                            color: VAGA_STATUS_COLORS[a.status] ?? '#94A3B8',
                          }}
                        >
                          {VAGA_STATUS_LABELS[a.status] ?? a.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 max-w-[120px]">
                        <span className="line-clamp-2">
                          {(a.analistas ?? []).map((x) => x.name).join(', ') || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}

export default function AdmissaoListaPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="h-40 animate-pulse bg-gray-50 rounded-2xl" />
      </div>
    }>
      <ListaContent />
    </Suspense>
  )
}
