'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  UserCheck, Clock, CalendarDays, Building2, Briefcase, TrendingUp,
  Users, Accessibility, RefreshCw, FileSpreadsheet, ExternalLink,
  ArrowRight, PartyPopper, Timer, BarChart3,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import {
  AdmissaoDashboardData, MONTHS_PT, TIPO_VAGA_LABELS, TIPO_REQUISICAO_LABELS,
  VAGA_STATUS_LABELS, VAGA_STATUS_COLORS,
} from '@/types'
import { formatDate } from '@/lib/utils'
import { useSettings } from '@/components/providers/SettingsProvider'

const TABS = [
  { label: 'Dashboard', href: '/admissao' },
  { label: 'Lista de Admitidos', href: '/admissao/lista' },
]

const PIE_COLORS = ['#15AFA4', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#10B981', '#F97316']

function KpiMini({
  title, value, subtitle, icon: Icon, color, onClick,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  color: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left transition-all hover:shadow-md ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-xs text-gray-500 font-medium leading-tight">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      {subtitle && <p className="text-[11px] text-gray-400 mt-1">{subtitle}</p>}
    </button>
  )
}

function DayHeatCell({
  day, count, max, names, isToday, selected, onClick,
}: {
  day: number
  count: number
  max: number
  names: string[]
  isToday: boolean
  selected: boolean
  onClick: () => void
}) {
  const intensity = max > 0 ? count / max : 0
  const bg =
    count === 0
      ? '#F8FAFC'
      : `rgba(21, 175, 164, ${0.15 + intensity * 0.75})`
  const textColor = intensity > 0.55 ? '#fff' : count > 0 ? '#0d8c83' : '#94A3B8'

  return (
    <button
      type="button"
      title={count > 0 ? `${count} admissão(ões): ${names.join(', ')}` : `Dia ${day} — nenhuma admissão`}
      onClick={onClick}
      className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition-all border ${
        selected ? 'ring-2 ring-[#15AFA4] border-[#15AFA4]' : isToday ? 'border-[#15AFA4]/60' : 'border-transparent'
      } hover:scale-105`}
      style={{ background: bg, color: textColor }}
    >
      <span className="leading-none">{day}</span>
      {count > 0 && <span className="text-[10px] font-bold mt-0.5 leading-none">{count}</span>}
    </button>
  )
}

export default function AdmissaoDashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { settings } = useSettings()
  const canFilterAllUnits = ['ADMIN', 'SUPERINTENDENT', 'GERENTE'].includes(session?.user?.role ?? '')

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [unitId, setUnitId] = useState('')
  const [units, setUnits] = useState<{ id: string; name: string; color: string }[]>([])
  const [data, setData] = useState<AdmissaoDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  async function load() {
    setIsLoading(true)
    setSelectedDay(null)
    const params = new URLSearchParams({ year: String(year), month: String(month) })
    if (unitId) params.set('unitId', unitId)
    const res = await fetch(`/api/admissao/dashboard?${params}`)
    const json = await res.json()
    setData(json)
    setIsLoading(false)
  }

  useEffect(() => { load() }, [year, month, unitId])
  useEffect(() => {
    fetch('/api/units').then((r) => r.json()).then((d) => setUnits(Array.isArray(d) ? d : []))
  }, [])

  const maxDay = useMemo(
    () => Math.max(1, ...(data?.porDia.map((d) => d.count) ?? [0])),
    [data]
  )

  const today = now.getDate()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const selectedDayData = selectedDay
    ? data?.porDia.find((d) => d.day === selectedDay)
    : null

  async function exportExcel() {
    if (!data) return
    setExporting(true)
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        status: 'contratados',
        dateField: 'inicio',
      })
      if (unitId) params.set('unitId', unitId)
      const lista = await fetch(`/api/admissao?${params}`).then((r) => r.json())

      const xlsxMod = await import('xlsx')
      const XLSX = (xlsxMod as any).default ?? xlsxMod
      const wb = XLSX.utils.book_new()
      const company = settings?.companyName || 'BHCL'
      const geradoEm = new Date().toLocaleDateString('pt-BR')

      const kpis = [
        ['Indicador', 'Valor'],
        ['Contratados no mês', data.kpis.totalContratados],
        ['Total no ano', data.kpis.totalAno],
        ['Em admissão (pipeline)', data.kpis.emAdmissao],
        ['Média dias até início', data.kpis.mediaDiasAteInicio ?? '—'],
        ['PCD', data.kpis.pcd],
        ['Inícios hoje', data.kpis.inicioHoje],
        ['Inícios próximos 7 dias', data.kpis.inicioProximos7],
        ['Inícios próximos 30 dias', data.kpis.inicioProximos30],
        ['Vs. mês anterior', data.kpis.vsMesAnterior],
      ]
      const wsKpi = XLSX.utils.aoa_to_sheet([
        [`${company} — Controle de Admissão — ${MONTHS_PT[month - 1]}/${year}`],
        [`Gerado em: ${geradoEm}`],
        [],
        ...kpis,
      ])
      XLSX.utils.book_append_sheet(wb, wsKpi, 'KPIs')

      const porDiaRows = [
        ['Dia', 'Qtd', 'Colaboradores'],
        ...data.porDia.filter((d) => d.count > 0).map((d) => [
          d.label,
          d.count,
          d.names.join('; '),
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(porDiaRows), 'Por Dia')

      const listaRows = (Array.isArray(lista) ? lista : []).map((a: any) => ({
        Colaborador: a.colaboradorNome,
        Cargo: a.cargo,
        Unidade: a.unit?.name ?? '',
        Município: a.municipio ?? '',
        Status: VAGA_STATUS_LABELS[a.status] ?? a.status,
        'Data Início': a.dataInicioEfetiva ? formatDate(a.dataInicioEfetiva) : '',
        'Data Fechamento': a.dataFechamento ? formatDate(a.dataFechamento) : '',
        'Data Abertura': a.dataAbertura ? formatDate(a.dataAbertura) : '',
        'Dias até início': a.diasAberturaAteInicio ?? '',
        Tipo: TIPO_VAGA_LABELS[a.tipoVaga as keyof typeof TIPO_VAGA_LABELS] ?? a.tipoVaga,
        PCD: a.vagaPcd ? 'Sim' : 'Não',
        'Processo Admissão': a.numProcessoAdmissao ?? '',
        'Protocolo Onvio': a.numProtocoloOnvio ?? '',
        Analistas: (a.analistas ?? []).map((x: any) => x.name).join(', '),
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(listaRows), 'Admitidos')

      XLSX.writeFile(wb, `controle_admissao_${year}_${String(month).padStart(2, '0')}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i)

  return (
    <>
      <Header
        title="Controle de Admissão"
        subtitle="Colaboradores contratados e agenda de inícios"
      />
      <div className="p-6 flex flex-col gap-5">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.href}
              onClick={() => router.push(t.href)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                t.href === '/admissao'
                  ? 'bg-white text-[#15AFA4] shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white"
          >
            {MONTHS_PT.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          {canFilterAllUnits && (
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white min-w-[160px]"
            >
              <option value="">Todas as unidades</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            disabled={exporting || !data}
            className="gap-1.5 ml-auto"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiMini
            title={`Contratados · ${MONTHS_PT[month - 1].slice(0, 3)}`}
            value={isLoading ? '…' : data?.kpis.totalContratados ?? 0}
            subtitle={
              data
                ? `${data.kpis.vsMesAnterior >= 0 ? '+' : ''}${data.kpis.vsMesAnterior} vs. mês ant. · ${data.kpis.totalAno} no ano`
                : undefined
            }
            icon={UserCheck}
            color="#15AFA4"
            onClick={() => router.push('/admissao/lista')}
          />
          <KpiMini
            title="Em admissão"
            value={isLoading ? '…' : data?.kpis.emAdmissao ?? 0}
            subtitle="Pipeline em andamento"
            icon={Clock}
            color="#6366F1"
            onClick={() => router.push('/admissao/lista?status=em_andamento')}
          />
          <KpiMini
            title="Inícios hoje"
            value={isLoading ? '…' : data?.kpis.inicioHoje ?? 0}
            subtitle="Começam a trabalhar hoje"
            icon={PartyPopper}
            color="#F59E0B"
          />
          <KpiMini
            title="Próximos 7 dias"
            value={isLoading ? '…' : data?.kpis.inicioProximos7 ?? 0}
            subtitle="Agenda de integração"
            icon={CalendarDays}
            color="#3B82F6"
          />
          <KpiMini
            title="Média até o início"
            value={isLoading ? '…' : data?.kpis.mediaDiasAteInicio != null ? `${data.kpis.mediaDiasAteInicio}d` : '—'}
            subtitle="Abertura → data de início"
            icon={Timer}
            color="#8B5CF6"
          />
          <KpiMini
            title="PCD no mês"
            value={isLoading ? '…' : data?.kpis.pcd ?? 0}
            subtitle="Vagas PCD contratadas"
            icon={Accessibility}
            color="#10B981"
          />
        </div>

        {/* Calendário por dia + ranking */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-[#15AFA4]" />
                    Admissões por dia — {MONTHS_PT[month - 1]}/{year}
                  </CardTitle>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Clique em um dia para ver quem começou. Intensidade = quantidade de inícios.
                  </p>
                </div>
                {selectedDay && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedDay(null)}>
                    Limpar dia
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 animate-pulse bg-gray-50 rounded-xl" />
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-1.5 mb-4">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((w, i) => (
                      <div key={i} className="text-center text-[10px] font-bold text-gray-400 py-1">
                        {w}
                      </div>
                    ))}
                    {/* offset do 1º dia da semana */}
                    {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
                      <div key={`pad-${i}`} />
                    ))}
                    {data?.porDia.map((d) => (
                      <DayHeatCell
                        key={d.day}
                        day={d.day}
                        count={d.count}
                        max={maxDay}
                        names={d.names}
                        isToday={isCurrentMonth && d.day === today}
                        selected={selectedDay === d.day}
                        onClick={() => setSelectedDay(selectedDay === d.day ? null : d.day)}
                      />
                    ))}
                  </div>

                  {/* Bar chart diário */}
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.porDia ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94A3B8' }} interval={2} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                        <Tooltip
                          formatter={(v: number, _n, p: any) => {
                            const names = p?.payload?.names ?? []
                            return [
                              `${v} colaborador(es)${names.length ? `: ${names.join(', ')}` : ''}`,
                              'Inícios',
                            ]
                          }}
                          labelFormatter={(l) => `Dia ${l}/${String(month).padStart(2, '0')}`}
                          contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#15AFA4"
                          radius={[4, 4, 0, 0]}
                          cursor="pointer"
                          onClick={(entry: any) => {
                            if (entry?.day) setSelectedDay(entry.day)
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {selectedDayData && selectedDayData.count > 0 && (
                    <div className="mt-4 p-3 rounded-xl bg-[#15AFA4]/8 border border-[#15AFA4]/20">
                      <p className="text-xs font-semibold text-[#0d8c83] mb-2">
                        {selectedDayData.count} colaborador(es) em {String(selectedDay).padStart(2, '0')}/
                        {String(month).padStart(2, '0')}/{year}
                      </p>
                      <ul className="flex flex-wrap gap-2">
                        {selectedDayData.names.map((n, i) => (
                          <li
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-white text-xs font-medium text-gray-700 border border-gray-100"
                          >
                            {n}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-[#15AFA4] flex items-center gap-1 hover:underline"
                        onClick={() =>
                          router.push(
                            `/admissao/lista?year=${year}&month=${month}&day=${selectedDay}&status=contratados`
                          )
                        }
                      >
                        Ver na lista <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Ranking de dias */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#15AFA4]" />
                Dias com mais inícios
              </CardTitle>
              <p className="text-xs text-gray-400">Ranking do mês selecionado</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-10 bg-gray-50 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : !data?.rankingDias.length ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  Nenhuma admissão com data de início neste mês.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.rankingDias.slice(0, 8).map((d, idx) => (
                    <li key={d.dateKey}>
                      <button
                        type="button"
                        onClick={() => setSelectedDay(d.day)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-700'
                              : idx === 1
                                ? 'bg-gray-200 text-gray-600'
                                : idx === 2
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{d.label}</p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {d.names.slice(0, 2).join(', ')}
                            {d.names.length > 2 ? ` +${d.names.length - 2}` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-[#15AFA4]">{d.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tendência anual + por unidade */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#15AFA4]" />
                Tendência de admissões — {year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-56 animate-pulse bg-gray-50 rounded-xl" />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.porMes ?? []} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <Tooltip
                        formatter={(v: number) => [`${v} contratado(s)`, 'Admissões']}
                        labelFormatter={(_, p) => (p?.[0]?.payload as any)?.labelFull ?? ''}
                        contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#15AFA4"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#15AFA4' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#15AFA4]" />
                Por unidade (mês)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-56 animate-pulse bg-gray-50 rounded-xl" />
              ) : !data?.porUnidade.length ? (
                <p className="text-sm text-gray-400 text-center py-16">Sem dados no período</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.porUnidade}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 10, fill: '#64748B' }}
                      />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                      <Bar dataKey="value" name="Contratados" radius={[0, 6, 6, 0]}>
                        {data.porUnidade.map((u, i) => (
                          <Cell key={i} fill={u.color || PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cargo / Tipo / Analista */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#15AFA4]" />
                Top cargos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                [1, 2, 3, 4].map((i) => <div key={i} className="h-8 bg-gray-50 animate-pulse rounded-lg" />)
              ) : !data?.porCargo.length ? (
                <p className="text-xs text-gray-400 text-center py-6">—</p>
              ) : (
                data.porCargo.map((c) => {
                  const max = data.porCargo[0]?.count || 1
                  return (
                    <div key={c.cargo}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 truncate pr-2">{c.cargo}</span>
                        <span className="font-bold text-gray-900">{c.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#15AFA4]"
                          style={{ width: `${(c.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tipo de vaga</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-44 animate-pulse bg-gray-50 rounded-xl" />
              ) : !data?.porTipoVaga.length ? (
                <p className="text-xs text-gray-400 text-center py-16">—</p>
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.porTipoVaga.map((t) => ({
                          name: TIPO_VAGA_LABELS[t.tipo as keyof typeof TIPO_VAGA_LABELS] ?? t.tipo,
                          value: t.count,
                        }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                        paddingAngle={2}
                      >
                        {data.porTipoVaga.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {data?.porTipoVaga.map((t, i) => (
                  <span key={t.tipo} className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                    <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {TIPO_VAGA_LABELS[t.tipo as keyof typeof TIPO_VAGA_LABELS] ?? t.tipo} ({t.count})
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-[#15AFA4]" />
                Por analista
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                [1, 2, 3, 4].map((i) => <div key={i} className="h-8 bg-gray-50 animate-pulse rounded-lg" />)
              ) : !data?.porAnalista.length ? (
                <p className="text-xs text-gray-400 text-center py-6">—</p>
              ) : (
                data.porAnalista.map((a) => {
                  const max = data.porAnalista[0]?.count || 1
                  return (
                    <div key={a.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 truncate pr-2">{a.name}</span>
                        <span className="font-bold text-gray-900">{a.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${(a.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
              {!!data?.porTipoRequisicao?.length && (
                <div className="pt-3 mt-3 border-t border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500 mb-2">Tipo de requisição</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.porTipoRequisicao.map((t) => (
                      <span
                        key={t.tipo}
                        className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] font-medium text-gray-600"
                      >
                        {TIPO_REQUISICAO_LABELS[t.tipo as keyof typeof TIPO_REQUISICAO_LABELS] ?? t.tipo}: {t.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Próximos inícios + recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#15AFA4]" />
                  Próximos inícios
                </CardTitle>
                <p className="text-xs text-gray-400">Agenda de quem ainda vai começar</p>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-50 animate-pulse rounded-xl" />)}
                </div>
              ) : !data?.proximosInicios.length ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum início agendado à frente.</p>
              ) : (
                <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {data.proximosInicios.map((p) => {
                    const isHoje = p.dataInicioKey === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#15AFA4]/30 hover:bg-[#15AFA4]/5 transition-colors cursor-pointer"
                        onClick={() => router.push(`/vagas/${p.id}`)}
                      >
                        <div
                          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                            isHoje ? 'bg-amber-100 text-amber-700' : 'bg-[#15AFA4]/10 text-[#0d8c83]'
                          }`}
                        >
                          <span className="text-[10px] font-medium leading-none">
                            {p.dataInicio ? formatDate(p.dataInicio).slice(3, 5) : '—'}
                          </span>
                          <span className="text-sm font-bold leading-tight">
                            {p.dataInicio ? formatDate(p.dataInicio).slice(0, 2) : '—'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{p.colaboradorNome}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {p.cargo}
                            {p.unit ? ` · ${p.unit.name}` : ''}
                          </p>
                        </div>
                        {isHoje && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            Hoje
                          </span>
                        )}
                        <ExternalLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#15AFA4]" />
                  Contratados recentes
                </CardTitle>
                <p className="text-xs text-gray-400">{MONTHS_PT[month - 1]}/{year}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={() => router.push('/admissao/lista')}
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-50 animate-pulse rounded-xl" />)}
                </div>
              ) : !data?.recentes.length ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum contratado no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-gray-400 border-b border-gray-100">
                        <th className="pb-2 font-medium">Colaborador</th>
                        <th className="pb-2 font-medium">Cargo</th>
                        <th className="pb-2 font-medium">Início</th>
                        <th className="pb-2 font-medium">Unidade</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentes.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-gray-50 hover:bg-gray-50/80 cursor-pointer"
                          onClick={() => router.push(`/vagas/${r.id}`)}
                        >
                          <td className="py-2.5 pr-2">
                            <span className="font-semibold text-gray-800">{r.colaboradorNome}</span>
                            {r.vagaPcd && (
                              <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                PCD
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-2 text-gray-600 text-xs">{r.cargo}</td>
                          <td className="py-2.5 pr-2 text-gray-600 text-xs whitespace-nowrap">
                            {r.dataInicio ? formatDate(r.dataInicio) : '—'}
                          </td>
                          <td className="py-2.5 pr-2">
                            {r.unit ? (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.unit.color }} />
                                {r.unit.name}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5">
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                background: (VAGA_STATUS_COLORS[r.status] ?? '#94A3B8') + '18',
                                color: VAGA_STATUS_COLORS[r.status] ?? '#94A3B8',
                              }}
                            >
                              {VAGA_STATUS_LABELS[r.status] ?? r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
