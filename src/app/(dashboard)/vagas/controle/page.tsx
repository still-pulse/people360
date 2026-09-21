'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileSpreadsheet, RefreshCw, Lock, CheckCircle2, XCircle, Clock,
  Search, Plus,
} from 'lucide-react'
import {
  VagaData, VAGA_STATUS_LABELS, TIPO_REQUISICAO_LABELS, TIPO_CONTRATO_LABELS,
  TIPO_RECRUTAMENTO_LABELS, TIPO_VAGA_LABELS, PERIODO_LABELS,
} from '@/types'
import { formatDate } from '@/lib/utils'
import { MONTHS_PT } from '@/types'
import { VagaModal } from '@/components/vagas/VagaModal'

const TABS = [
  { label: 'Dashboard',  href: '/vagas' },
  { label: 'Lista',      href: '/vagas/lista' },
  { label: 'Controle',   href: '/vagas/controle' },
]

function Cell({ value, placeholder }: { value?: string | null; placeholder?: string }) {
  if (!value) return <span className="text-gray-300 text-xs">{placeholder ?? '—'}</span>
  return <span>{value}</span>
}

function BoolCell({ value }: { value?: boolean }) {
  return value
    ? <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Sim</span>
    : <span className="text-gray-300 text-xs">—</span>
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    ABERTA: '#15AFA4', DIVULGACAO: '#3B82F6', TRIAGEM: '#8B5CF6',
    ENTREVISTAS: '#F59E0B', ENCAMINHADA_GESTOR: '#F97316',
    APROVADA_CONTRATACAO: '#06B6D4', ADMISSAO_EM_ANDAMENTO: '#6366F1', CONTRATADA: '#10B981',
    FECHADA: '#6B7280', CANCELADA: '#EF4444',
  }
  const color = map[status] ?? '#94A3B8'
  const label = VAGA_STATUS_LABELS[status as keyof typeof VAGA_STATUS_LABELS] ?? status
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '18', color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  )
}

export default function VagasControlePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === 'ADMIN'
  const canEdit = session?.user?.role !== 'JURIDICO'
  const canFilterAllUnits = ['ADMIN', 'JURIDICO', 'SUPERINTENDENT', 'GERENTE'].includes(session?.user?.role ?? '')
  const analystUnitIds: string[] = (session?.user as any)?.unitIds?.length
    ? (session?.user as any).unitIds
    : (session?.user?.unitId ? [session?.user?.unitId] : [])
  const analystUnitId = analystUnitIds[0] ?? null

  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [vagas, setVagas]     = useState<VagaData[]>([])
  const [units, setUnits]     = useState<{ id: string; name: string; color: string }[]>([])
  const [users, setUsers]     = useState<{ id: string; name: string; unitId?: string | null; managedUnits?: { unitId: string }[] }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editVaga, setEditVaga]   = useState<VagaData | null>(null)

  const [filterYear,   setFilterYear]   = useState(currentYear)
  const [filterMonth,  setFilterMonth]  = useState(0)
  const [filterUnit,   setFilterUnit]   = useState('')
  const [filterStatus, setFilterStatus] = useState<'todas' | 'abertas' | 'admissao' | 'fechadas' | 'canceladas'>('todas')
  const [search,       setSearch]       = useState('')

  const CLOSED_STATUSES  = ['CONTRATADA', 'FECHADA']
  const TERMINAL_STATUSES = ['CONTRATADA', 'FECHADA', 'CANCELADA']
  const ABERTA_STATUSES  = ['ABERTA', 'DIVULGACAO', 'TRIAGEM', 'ENTREVISTAS', 'ENCAMINHADA_GESTOR', 'APROVADA_CONTRATACAO']

  // Início do período filtrado — vagas abertas antes disso e ainda não concluídas são "atrasadas"
  const periodStart = filterMonth
    ? new Date(filterYear, filterMonth - 1, 1)
    : new Date(filterYear, 0, 1)

  function isAtrasada(v: VagaData) {
    return new Date(v.dataAbertura) < periodStart && !TERMINAL_STATUSES.includes(v.status)
  }

  async function load() {
    setIsLoading(true)
    const params = new URLSearchParams()
    params.set('year', String(filterYear))
    if (filterMonth) params.set('month', String(filterMonth))
    if (filterUnit) params.set('unitId', filterUnit)
    const res = await fetch(`/api/vagas/controle?${params}`)
    setVagas(await res.json())
    setIsLoading(false)
  }

  useEffect(() => { load() }, [filterYear, filterMonth, filterUnit, canFilterAllUnits])
  useEffect(() => {
    fetch('/api/units').then((r) => r.json()).then(setUnits)
    fetch('/api/users').then((r) => r.json()).then(setUsers)
  }, [])

  const filtered = useMemo(() => {
    let result = vagas
    if (filterStatus === 'abertas') result = result.filter((v) => ABERTA_STATUSES.includes(v.status))
    if (filterStatus === 'admissao') result = result.filter((v) => v.status === 'ADMISSAO_EM_ANDAMENTO')
    if (filterStatus === 'fechadas') result = result.filter((v) => CLOSED_STATUSES.includes(v.status))
    if (filterStatus === 'canceladas') result = result.filter((v) => v.status === 'CANCELADA')
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((v) =>
        v.cargo.toLowerCase().includes(q) ||
        ((v as any).analistas?.map((a: any) => a.name).join(' ') ?? '').toLowerCase().includes(q) ||
        (v.gestorRequisitante ?? '').toLowerCase().includes(q) ||
        (v.requisicaoNextId ?? '').toLowerCase().includes(q) ||
        (v.nomeColaboradorSaiu ?? '').toLowerCase().includes(q) ||
        (v.nomeColaborador ?? '').toLowerCase().includes(q) ||
        (v.controleCandidato?.nome ?? '').toLowerCase().includes(q)
      )
    }
    // Vagas atrasadas (de períodos anteriores, ainda abertas) aparecem primeiro, das mais antigas para as mais recentes
    return [...result].sort((a, b) => {
      const aAtrasada = isAtrasada(a)
      const bAtrasada = isAtrasada(b)
      if (aAtrasada && !bAtrasada) return -1
      if (!aAtrasada && bAtrasada) return 1
      if (aAtrasada && bAtrasada) return new Date(a.dataAbertura).getTime() - new Date(b.dataAbertura).getTime()
      return 0
    })
  }, [vagas, search, filterStatus, periodStart.getTime()])

  const analystUnit = units.find((u) => u.id === analystUnitId)

  async function exportExcel() {
    const XLSX = await import('@/lib/xlsxSafe')

    const rows = filtered.map((v) => {
      const candidatoAtivo = v.controleCandidato?.nome ?? (v as any).candidatos?.[0]?.nome ?? null
      return {
        'Next (ID RP)':               v.requisicaoNextId ?? '',
        'Analistas':                  (v as any).analistas?.map((a: any) => a.name).join(', ') ?? '',
        'Período':                    v.periodoTrabalho ? PERIODO_LABELS[v.periodoTrabalho] : '',
        'Município':                  v.municipio ?? '',
        'Unidade':                    v.unit?.name ?? '',
        'Cargo':                      v.cargo,
        'Setor':                      v.setor ?? '',
        'Carga Horária Mensal':       v.cargaHoraria ?? '',
        'Horário de Trabalho':        v.horarioTrabalho ?? '',
        'Escala':                     v.escala ?? '',
        'Plantão Colaborador Saiu':   v.plantaoColaboradorSaiu ?? '',
        'Salário':                    v.salarioMin != null ? v.salarioMin.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }) : '',
        'Tipo de Requisição':         v.tipoRequisicao ? TIPO_REQUISICAO_LABELS[v.tipoRequisicao] : '',
        'Contrato':                   v.tipoContrato ? TIPO_CONTRATO_LABELS[v.tipoContrato] : '',
        'Nome (em substituição)':     v.nomeColaboradorSaiu ?? '',
        'Abertura da Vaga':           formatDate(v.dataAbertura),
        'Gestor Requisitante':        v.gestorRequisitante ?? '',
        'Setor Requisitante':         v.setorRequisitante ?? '',
        'Tipo de Recrutamento':       v.tipoRecrutamento ? TIPO_RECRUTAMENTO_LABELS[v.tipoRecrutamento] : '',
        'Tipo de Contratação':        TIPO_VAGA_LABELS[v.tipoVaga],
        'Candidato Aprovado / Ativo': candidatoAtivo ?? v.nomeColaborador ?? '',
        'Disponibilidade Novo':       v.disponibilidadeHorario ?? '',
        '1Doc Admissão':              v.numProcessoAdmissao ?? '',
        'Vaga PCD':                   v.vagaPcd ? 'Sim' : 'Não',
        'Onvio':                      v.numProtocoloOnvio ?? '',
        'Data de Fechamento':         v.dataFechamento ? formatDate(v.dataFechamento) : '',
        'Data Início/Integração':     v.dataInicioIntegracao ? formatDate(v.dataInicioIntegracao) : '',
        'Status':                     VAGA_STATUS_LABELS[v.status],
        'Atrasada (período anterior)':isAtrasada(v) ? 'Sim' : 'Não',
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    const sheetName = filterMonth
      ? `${MONTHS_PT[filterMonth - 1]} ${filterYear}`
      : `Ano ${filterYear}`
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `controle_vagas_${filterYear}${filterMonth ? `_${String(filterMonth).padStart(2, '0')}` : ''}.xlsx`)
  }

  const yearOptions = currentMonth === 12
    ? [currentYear, currentYear + 1]
    : [currentYear]

  const columns = [
    { key: 'nextId',         label: 'Next (RP)',        w: 'min-w-[110px]' },
    { key: 'analista',       label: 'Analista',         w: 'min-w-[130px]' },
    { key: 'unidade',        label: 'Unidade',          w: 'min-w-[130px]' },
    { key: 'cargo',          label: 'Cargo',            w: 'min-w-[160px]' },
    { key: 'setor',          label: 'Setor',            w: 'min-w-[120px]' },
    { key: 'tipoReq',        label: 'Tipo Requisição',  w: 'min-w-[130px]' },
    { key: 'tipoContrato',   label: 'Contrato',         w: 'min-w-[110px]' },
    { key: 'nomeSubst',      label: 'Em Substituição',  w: 'min-w-[150px]' },
    { key: 'plantao',        label: 'Plantão (Saiu)',   w: 'min-w-[110px]' },
    { key: 'horario',        label: 'Horário',          w: 'min-w-[130px]' },
    { key: 'escala',         label: 'Escala',           w: 'min-w-[90px]' },
    { key: 'cargaH',         label: 'C.H. Mensal',      w: 'min-w-[90px]' },
    { key: 'salario',        label: 'Salário',          w: 'min-w-[100px]' },
    { key: 'tipoRecr',       label: 'Recrutamento',     w: 'min-w-[110px]' },
    { key: 'gestor',         label: 'Gestor',           w: 'min-w-[140px]' },
    { key: 'candidato',      label: 'Candidato Ativo',  w: 'min-w-[150px]' },
    { key: 'disponib',       label: 'Disponibilidade',  w: 'min-w-[130px]' },
    { key: 'pcd',            label: 'PCD',              w: 'min-w-[60px]' },
    { key: 'onedoc',         label: '1Doc',             w: 'min-w-[110px]' },
    { key: 'onvio',          label: 'Onvio',            w: 'min-w-[100px]' },
    { key: 'abertura',       label: 'Abertura',         w: 'min-w-[90px]' },
    { key: 'fechamento',     label: 'Fechamento',       w: 'min-w-[90px]' },
    { key: 'inicio',         label: 'Início/Integr.',   w: 'min-w-[100px]' },
    { key: 'status',         label: 'Status',           w: 'min-w-[130px]' },
  ]

  return (
    <>
      <Header title="Controle de Vagas" subtitle="Acompanhamento semanal — visão fim a fim" />
      <div className="p-6 flex flex-col gap-5">

        {/* Tabs */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {TABS.map((tab) => (
              <button key={tab.href} onClick={() => router.push(tab.href)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab.href === '/vagas/controle' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>{tab.label}</button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm"
              icon={<FileSpreadsheet className="w-4 h-4 text-green-600" />}
              onClick={exportExcel} disabled={filtered.length === 0}>
              Exportar Excel
            </Button>
            {canEdit && (
              <Button icon={<Plus className="w-4 h-4" />}
                onClick={() => { setEditVaga(null); setModalOpen(true) }}>
                Nova Vaga
              </Button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
          {/* Ano */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ano</label>
            <div className="flex gap-1">
              {yearOptions.map((y) => (
                <button key={y} onClick={() => setFilterYear(y)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    filterYear === y
                      ? 'bg-[#15AFA4] text-white border-[#15AFA4]'
                      : 'border-gray-200 text-gray-600 hover:border-[#15AFA4]/40 hover:text-[#15AFA4]'
                  }`}>
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Mês */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mês</label>
            <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white min-w-[140px]">
              <option value={0}>Todos</option>
              {MONTHS_PT.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          {/* Unidade (visão global) */}
          {canFilterAllUnits && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidade</label>
              <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white min-w-[180px]">
                <option value="">Todas as unidades</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}

          {/* Situação */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Situação</label>
            <div className="flex gap-1">
              {([
                { value: 'todas',   label: 'Todas' },
                { value: 'abertas', label: 'Abertas' },
                { value: 'admissao', label: 'Admissão em Andamento' },
                { value: 'fechadas', label: 'Fechadas' },
                { value: 'canceladas', label: 'Canceladas' },
              ] as const).map(({ value, label }) => (
                <button key={value} onClick={() => setFilterStatus(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    filterStatus === value
                      ? 'bg-[#15AFA4] text-white border-[#15AFA4]'
                      : 'border-gray-200 text-gray-600 hover:border-[#15AFA4]/40 hover:text-[#15AFA4]'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Busca */}
          <div className="flex-1 min-w-48 space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Cargo, analista, gestor, RP..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4]" />
            </div>
          </div>

          <button onClick={load} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 self-end">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>
                {filterMonth ? `${MONTHS_PT[filterMonth - 1]} ${filterYear}` : `Ano ${filterYear}`}
                <span className="ml-2 text-sm font-normal text-gray-400">— {filtered.length} vaga{filtered.length !== 1 ? 's' : ''}</span>
                {filtered.some(isAtrasada) && (
                  <span className="ml-2 text-sm font-normal text-amber-600">
                    ({filtered.filter(isAtrasada).length} atrasada{filtered.filter(isAtrasada).length !== 1 ? 's' : ''} de períodos anteriores)
                  </span>
                )}
              </CardTitle>
              {!canFilterAllUnits && (
                analystUnitIds.length > 1 ? (
                  <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-600 outline-none focus:border-[#15AFA4]">
                    <option value="">Todas as minhas unidades</option>
                    {units.filter(u => analystUnitIds.includes(u.id)).map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                ) : analystUnit && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: analystUnit.color }} />
                    {analystUnit.name}
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                )
              )}
            </div>
          </CardHeader>

          <div className="overflow-auto max-h-[65vh]">
            {isLoading ? (
              <div className="p-8 space-y-3">
                {[1,2,3,4,5].map(i=><div key={i} className="h-10 animate-pulse bg-gray-50 rounded-xl"/>)}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-y border-gray-100 sticky top-0 z-10">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className={`px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${col.w}`}>
                        {col.label}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 1} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Clock className="w-8 h-8 text-gray-200" />
                          <p className="text-gray-400">Nenhuma vaga encontrada para o período selecionado</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {filtered.map((v) => {
                    const candidatoAtivo = v.controleCandidato?.nome ?? (v as any).candidatos?.[0]?.nome ?? v.nomeColaborador
                    const atrasada = isAtrasada(v)
                    return (
                      <tr key={v.id}
                        className={`transition-colors cursor-pointer ${
                          atrasada ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-[#15AFA4]/5'
                        }`}
                        onClick={() => router.push(`/vagas/${v.id}`)}>
                        {/* Next (RP) */}
                        <td className="px-3 py-2.5">
                          {v.requisicaoNextId
                            ? <span className="font-mono font-semibold text-[#15AFA4] bg-[#15AFA4]/10 px-1.5 py-0.5 rounded">{v.requisicaoNextId}</span>
                            : <span className="text-amber-500 text-xs flex items-center gap-1"><XCircle className="w-3 h-3" />Pendente</span>
                          }
                        </td>
                        {/* Analista */}
                        <td className="px-3 py-2.5 font-medium text-gray-700">
                          <Cell value={(v as any).analistas?.map((a: any) => a.name).join(', ') || undefined} />
                        </td>
                        {/* Unidade */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {v.unit && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.unit.color }} />}
                            <Cell value={v.unit?.name} />
                          </div>
                        </td>
                        {/* Cargo */}
                        <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {v.cargo}
                            {atrasada && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 flex-shrink-0"
                                title={`Aberta desde ${formatDate(v.dataAbertura)} — ainda não fechada`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                {MONTHS_PT[new Date(v.dataAbertura).getMonth()].slice(0, 3)}/{String(new Date(v.dataAbertura).getFullYear()).slice(2)}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Setor */}
                        <td className="px-3 py-2.5"><Cell value={v.setor} /></td>
                        {/* Tipo Requisição */}
                        <td className="px-3 py-2.5">
                          {v.tipoRequisicao
                            ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                v.tipoRequisicao === 'SUBSTITUICAO'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-purple-50 text-purple-700'
                              }`}>{TIPO_REQUISICAO_LABELS[v.tipoRequisicao]}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        {/* Contrato */}
                        <td className="px-3 py-2.5">
                          {v.tipoContrato
                            ? <Cell value={TIPO_CONTRATO_LABELS[v.tipoContrato]} />
                            : <Cell value={null} />
                          }
                        </td>
                        {/* Nome Substituído */}
                        <td className="px-3 py-2.5 uppercase"><Cell value={v.nomeColaboradorSaiu} /></td>
                        {/* Plantão */}
                        <td className="px-3 py-2.5"><Cell value={v.plantaoColaboradorSaiu} /></td>
                        {/* Horário */}
                        <td className="px-3 py-2.5"><Cell value={v.horarioTrabalho} /></td>
                        {/* Escala */}
                        <td className="px-3 py-2.5"><Cell value={v.escala} /></td>
                        {/* C.H. Mensal */}
                        <td className="px-3 py-2.5"><Cell value={v.cargaHoraria} /></td>
                        {/* Salário */}
                        <td className="px-3 py-2.5">
                          {v.salarioMin
                            ? <span className="font-medium text-gray-700">{v.salarioMin.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        {/* Recrutamento */}
                        <td className="px-3 py-2.5">
                          {v.tipoRecrutamento
                            ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                v.tipoRecrutamento === 'INTERNO'
                                  ? 'bg-teal-50 text-teal-700'
                                  : 'bg-orange-50 text-orange-700'
                              }`}>{TIPO_RECRUTAMENTO_LABELS[v.tipoRecrutamento]}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        {/* Gestor */}
                        <td className="px-3 py-2.5 uppercase"><Cell value={v.gestorRequisitante} /></td>
                        {/* Candidato */}
                        <td className="px-3 py-2.5 uppercase">
                          {candidatoAtivo
                            ? <span className="font-medium text-gray-800 bg-green-50 px-1.5 py-0.5 rounded">{candidatoAtivo}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        {/* Disponibilidade */}
                        <td className="px-3 py-2.5"><Cell value={v.disponibilidadeHorario} /></td>
                        {/* PCD */}
                        <td className="px-3 py-2.5"><BoolCell value={v.vagaPcd} /></td>
                        {/* 1Doc */}
                        <td className="px-3 py-2.5">
                          {v.numProcessoAdmissao
                            ? <span className="font-mono text-xs text-gray-700">{v.numProcessoAdmissao}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        {/* Onvio */}
                        <td className="px-3 py-2.5">
                          {v.numProtocoloOnvio
                            ? <span className="font-mono text-xs text-gray-700">{v.numProtocoloOnvio}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        {/* Abertura */}
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(v.dataAbertura)}</td>
                        {/* Fechamento */}
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                          {v.dataFechamento ? formatDate(v.dataFechamento) : <span className="text-gray-300">—</span>}
                        </td>
                        {/* Início */}
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                          {v.dataInicioIntegracao ? formatDate(v.dataInicioIntegracao) : <span className="text-gray-300">—</span>}
                        </td>
                        {/* Status */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <StatusDot status={v.status} />
                        </td>
                        {/* Ação */}
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <button
                              onClick={() => { setEditVaga(v); setModalOpen(true) }}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-[#15AFA4] hover:bg-[#15AFA4]/10 transition-colors"
                              title="Editar vaga"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Legenda / resumo */}
          {!isLoading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-50 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>
                <strong className="text-[#15AFA4]">{filtered.filter(v => v.requisicaoNextId).length}</strong> com RP no NextERP
              </span>
              <span>
                <strong className="text-green-600">{filtered.filter(v => v.status === 'CONTRATADA').length}</strong> contratadas
              </span>
              <span>
                <strong className="text-amber-600">{filtered.filter(v => !['CONTRATADA','FECHADA','CANCELADA'].includes(v.status)).length}</strong> em andamento
              </span>
              <span>
                <strong className="text-red-600">{filtered.filter(v => v.status === 'CANCELADA').length}</strong> canceladas
              </span>
              <span>
                <strong className="text-blue-600">{filtered.filter(v => v.vagaPcd).length}</strong> PCD
              </span>
              <span>
                <strong className="text-gray-700">{filtered.filter(v => v.tipoRequisicao === 'SUBSTITUICAO').length}</strong> substituições
                &nbsp;·&nbsp;
                <strong className="text-gray-700">{filtered.filter(v => v.tipoRequisicao === 'AUMENTO_QUADRO').length}</strong> aumento de quadro
              </span>
            </div>
          )}
        </Card>
      </div>

      {canEdit && (
        <VagaModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditVaga(null) }}
          onSaved={load}
          vaga={editVaga}
          units={units}
          users={users}
          isAdmin={isAdmin}
          analystUnitIds={analystUnitIds}
        />
      )}
    </>
  )
}
