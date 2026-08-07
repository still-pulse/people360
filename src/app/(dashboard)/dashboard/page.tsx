'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { LineChartCard } from '@/components/dashboard/LineChartCard'
import { DonutChartCard } from '@/components/dashboard/DonutChartCard'
import { HorizontalBarCard } from '@/components/dashboard/HorizontalBarCard'
import { MetricWithChartCard } from '@/components/dashboard/MetricWithChartCard'
import { TrainingCard } from '@/components/dashboard/TrainingCard'
import { DashboardFilters, PeriodKey } from '@/components/dashboard/DashboardFilters'
import {
  Users, RefreshCcw, CalendarOff, Smile, Star, DollarSign,
  Clock, UserCheck, Briefcase, Accessibility, GraduationCap, Building2,
} from 'lucide-react'

interface ExecutiveDashData {
  previousLabel: string
  summary: { totalColaboradores: number; totalPcd: number; totalAprendizes: number; totalUnidades: number }
  headcount: { current: number; previous: number; change: number; sparkline: { month: string; value: number }[] }
  turnover: {
    rate: number; previous: number; change: number
    sparkline: { month: string; value: number }[]
    last12Months: { month: string; value: number }[]
    byGender: { label: string; value: number; color: string }[]
    byAge: { label: string; value: number }[]
  }
  absenteeism: { rate: number; previous: number; change: number; sparkline: { month: string; value: number }[] }
  engagement: { rate: number; previous: number; change: number; sparkline: { month: string; value: number }[] }
  nps: { value: number; previous: number; change: number; sparkline: { month: string; value: number }[] }
  costPerEmployee: { value: number; previous: number; change: number; sparkline: { month: string; value: number }[] }
  vacancyClosingTime: { days: number; target: number; change: number; trend: { month: string; value: number }[] }
  retentionRate: { rate: number; target: number; change: number; trend: { month: string; value: number }[] }
  hiringCost: { value: number; previous: number; change: number; trend: { month: string; value: number }[] }
  collaboratorsByArea: { label: string; value: number; color: string; percentage: number }[]
  distributionByTenure: { label: string; value: number }[]
  training: { totalHours: number; avgHoursPerEmployee: number; participationRate: number; hrsChange: number; avgChange: number; rateChange: number }
  lastUpdated: string
}

const TURNOVER_AGE_FALLBACK = [
  { label: 'Até 25 anos', value: 0 },
  { label: '26 a 35 anos', value: 0 },
  { label: '36 a 45 anos', value: 0 },
  { label: '46 a 55 anos', value: 0 },
  { label: 'Acima de 55 anos', value: 0 },
]

const TENURE_FALLBACK = [
  { label: 'Até 1 ano', value: 0 },
  { label: '1 a 3 anos', value: 0 },
  { label: '3 a 5 anos', value: 0 },
  { label: '5 a 10 anos', value: 0 },
  { label: 'Acima de 10 anos', value: 0 },
]

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const analystUnitIds: string[] = (session?.user as any)?.unitIds?.length
    ? (session?.user as any).unitIds
    : (session?.user?.unitId ? [session?.user?.unitId] : [])

  const [data, setData] = useState<ExecutiveDashData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodKey>('current_month')
  const [unitId, setUnitId] = useState<string | null>(null)
  const [units, setUnits] = useState<{ id: string; name: string }[]>([])

  const fetchData = useCallback(async (p: PeriodKey, u: string | null) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ period: p })
      if (u) params.set('unitId', u)
      const res = await fetch(`/api/dashboard/executive?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const json: ExecutiveDashData = await res.json()
      setData(json)
      const ts = new Date().toISOString()
      window.dispatchEvent(new CustomEvent('dashboard:refreshed', { detail: ts }))
    } catch {
      // silent - keep previous data
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === 'loading') return
    fetch('/api/units')
      .then(r => r.json())
      .then((list: { id: string; name: string }[]) => {
        const active = list.filter(u => (u as any).active !== false)
        setUnits(isAdmin ? active : active.filter(u => analystUnitIds.includes(u.id)))
      })
      .catch(() => {})
  }, [sessionStatus, isAdmin, analystUnitIds.join(',')])

  useEffect(() => {
    fetchData(period, unitId)
  }, [period, unitId, fetchData])

  useEffect(() => {
    const onRefresh = () => fetchData(period, unitId)
    window.addEventListener('dashboard:refresh', onRefresh)
    return () => window.removeEventListener('dashboard:refresh', onRefresh)
  }, [period, unitId, fetchData])

  const prev = data?.previousLabel ?? '—'
  const loading = isLoading

  const turnoverByGender = data?.turnover.byGender.length
    ? data.turnover.byGender
    : []

  const turnoverByAge = data?.turnover.byAge.length
    ? data.turnover.byAge
    : TURNOVER_AGE_FALLBACK

  const tenureData = data?.distributionByTenure.length
    ? data.distributionByTenure
    : TENURE_FALLBACK

  return (
    <>
      <Header
        title="Dashboard de Indicadores de RH"
        subtitle="Visão geral dos principais indicadores de gestão de pessoas"
      />

      <div className="p-6 space-y-6">

        {/* Filtros globais */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <DashboardFilters
            period={period}
            unitId={unitId}
            units={units}
            onPeriodChange={p => setPeriod(p)}
            onUnitChange={isAdmin || analystUnitIds.length > 1 ? u => setUnitId(u) : undefined}
          />
        </div>

        {/* ── Barra de resumo rápido ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total de Colaboradores', value: data?.summary.totalColaboradores ?? 0, icon: Users, color: '#15AFA4', bg: '#15AFA410' },
            { label: 'Profissionais PCD', value: data?.summary.totalPcd ?? 0, icon: Accessibility, color: '#8B5CF6', bg: '#8B5CF610' },
            { label: 'Aprendizes', value: data?.summary.totalAprendizes ?? 0, icon: GraduationCap, color: '#3B82F6', bg: '#3B82F610' },
            { label: 'Unidades Monitoradas', value: data?.summary.totalUnidades ?? 0, icon: Building2, color: '#F59E0B', bg: '#F59E0B10' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: item.bg }}>
                <item.icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <div>
                <p className="text-xs text-gray-500 leading-none mb-0.5">{item.label}</p>
                <p className="text-xl font-bold text-gray-900 leading-none">
                  {isLoading ? '—' : item.value.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Linha 1 — KPI Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard
            title="Headcount"
            value={data ? data.headcount.current.toLocaleString('pt-BR') : '—'}
            change={data?.headcount.change ?? 0}
            previousLabel={prev}
            changeType="percent"
            sparkline={data?.headcount.sparkline ?? []}
            icon={<Users className="w-5 h-5" />}
            color="#3B82F6"
            positiveIsGood={true}
            isLoading={loading}
          />
          <KPICard
            title="Turnover (12m)"
            value={data ? `${data.turnover.rate.toFixed(1).replace('.', ',')}%` : '—'}
            change={data?.turnover.change ?? 0}
            previousLabel={prev}
            changeType="pp"
            sparkline={data?.turnover.sparkline ?? []}
            icon={<RefreshCcw className="w-5 h-5" />}
            color="#8B5CF6"
            positiveIsGood={false}
            isLoading={loading}
          />
          <KPICard
            title="Absenteísmo"
            value={data ? `${data.absenteeism.rate.toFixed(1).replace('.', ',')}%` : '—'}
            change={data?.absenteeism.change ?? 0}
            previousLabel={prev}
            changeType="pp"
            sparkline={data?.absenteeism.sparkline ?? []}
            icon={<CalendarOff className="w-5 h-5" />}
            color="#15AFA4"
            positiveIsGood={false}
            isLoading={loading}
          />
          <KPICard
            title="Engajamento"
            value={data ? `${data.engagement.rate.toFixed(0)}%` : '—'}
            change={data?.engagement.change ?? 0}
            previousLabel={prev}
            changeType="pp"
            sparkline={data?.engagement.sparkline ?? []}
            icon={<Smile className="w-5 h-5" />}
            color="#22C55E"
            positiveIsGood={true}
            isLoading={loading}
          />
          <KPICard
            title="NPS eNPS"
            value={data ? (data.nps.value >= 0 ? `+${data.nps.value}` : String(data.nps.value)) : '—'}
            change={data?.nps.change ?? 0}
            previousLabel={prev}
            changeType="value"
            sparkline={data?.nps.sparkline ?? []}
            icon={<Star className="w-5 h-5" />}
            color="#F59E0B"
            positiveIsGood={true}
            isLoading={loading}
          />
          <KPICard
            title="Custo por Colaborador"
            value={data
              ? data.costPerEmployee.value > 0
                ? `R$ ${data.costPerEmployee.value.toLocaleString('pt-BR')}`
                : 'R$ —'
              : '—'}
            change={data?.costPerEmployee.change ?? 0}
            previousLabel={prev}
            changeType="percent"
            sparkline={data?.costPerEmployee.sparkline ?? []}
            icon={<DollarSign className="w-5 h-5" />}
            color="#EF4444"
            positiveIsGood={false}
            isLoading={loading}
          />
        </div>

        {/* ── Linha 2 — Turnover charts ───────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-6">
            <LineChartCard
              title="Turnover — últimos 12 meses"
              subtitle="Evolução mensal consolidada"
              data={data?.turnover.last12Months ?? []}
              color="#8B5CF6"
              unit="%"
              isLoading={loading}
              height={260}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3">
            <DonutChartCard
              title="Turnover por Gênero (12m)"
              data={turnoverByGender.length ? turnoverByGender.map(g => ({
                label: g.label, value: g.value, color: g.color,
              })) : []}
              unit="%"
              showPercentInLegend={true}
              isLoading={loading}
              height={180}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3">
            <HorizontalBarCard
              title="Turnover por Faixa Etária (12m)"
              data={turnoverByAge.length ? turnoverByAge : []}
              color="#8B5CF6"
              unit="%"
              isLoading={loading}
              height={220}
            />
          </div>
        </div>

        {/* ── Linha 3 — Métricas R&S ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricWithChartCard
            title="Tempo Médio de Fechamento de Vagas"
            icon={<Clock className="w-5 h-5" />}
            iconColor="#3B82F6"
            value={data ? (data.vacancyClosingTime.days > 0 ? `${data.vacancyClosingTime.days}` : '—') : '—'}
            valueLabel="dias"
            target={`≤ ${data?.vacancyClosingTime.target ?? 35} dias`}
            change={data?.vacancyClosingTime.change ?? 0}
            changeLabel={prev}
            changeType="days"
            positiveIsGood={false}
            chartData={data?.vacancyClosingTime.trend ?? []}
            chartType="bar"
            chartColor="#3B82F6"
            referenceValue={data?.vacancyClosingTime.target ?? 35}
            isLoading={loading}
          />
          <MetricWithChartCard
            title="Taxa de Retenção de Talentos"
            icon={<UserCheck className="w-5 h-5" />}
            iconColor="#22C55E"
            value={data ? (data.retentionRate.rate > 0 ? `${data.retentionRate.rate.toFixed(0)}%` : '—') : '—'}
            target={`≥ ${data?.retentionRate.target ?? 90}%`}
            change={data?.retentionRate.change ?? 0}
            changeLabel={prev}
            changeType="pp"
            positiveIsGood={true}
            chartData={data?.retentionRate.trend ?? []}
            chartType="line"
            chartColor="#22C55E"
            referenceValue={data?.retentionRate.target ?? 90}
            unit="%"
            isLoading={loading}
          />
          <MetricWithChartCard
            title="Custo de Contratação"
            icon={<Briefcase className="w-5 h-5" />}
            iconColor="#F59E0B"
            value={data
              ? data.hiringCost.value > 0
                ? `R$ ${data.hiringCost.value.toLocaleString('pt-BR')}`
                : 'R$ —'
              : '—'}
            valueLabel="por contratação"
            change={data?.hiringCost.change ?? 0}
            changeLabel={prev}
            changeType="percent"
            positiveIsGood={false}
            chartData={data?.hiringCost.trend ?? []}
            chartType="bar"
            chartColor="#F59E0B"
            isLoading={loading}
          />
        </div>

        {/* ── Linha 4 — Perfil da força de trabalho ──────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DonutChartCard
            title="Colaboradores por Área"
            subtitle="Distribuição por unidade"
            data={(data?.collaboratorsByArea ?? []).map(a => ({
              label: a.label, value: a.value, color: a.color,
            }))}
            unit=""
            showPercentInLegend={false}
            isLoading={loading}
            height={200}
          />
          <HorizontalBarCard
            title="Distribuição por Tempo de Empresa"
            data={tenureData}
            color="#15AFA4"
            unit="%"
            isLoading={loading}
            height={220}
          />
          <TrainingCard
            totalHours={data?.training.totalHours ?? 0}
            avgHoursPerEmployee={data?.training.avgHoursPerEmployee ?? 0}
            participationRate={data?.training.participationRate ?? 0}
            hrsChange={data?.training.hrsChange ?? 0}
            avgChange={data?.training.avgChange ?? 0}
            rateChange={data?.training.rateChange ?? 0}
            isLoading={loading}
          />
        </div>

        {/* Footer informativo */}
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 text-xs font-bold">i</span>
          </div>
          <p className="text-xs text-blue-700">
            Indicadores atualizados com base nos dados cadastrados no sistema. Utilize os filtros para refinar a visualização por período e unidade.
          </p>
        </div>

      </div>
    </>
  )
}
