'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Textarea } from '@/components/ui/input'
import {
  Plus, Search, MessageSquare, Clock, CheckCircle2,
  XCircle, AlertTriangle, ChevronRight, Circle,
  CalendarDays, Timer, Palmtree, UserX, ThumbsUp, ThumbsDown, Hourglass, Trash2,
  FileClock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Chamado {
  id: string
  titulo: string
  categoria: string
  status: string
  prioridade: string
  createdAt: string
  updatedAt: string
  naoLidas: number
  tipoSolicitacao?: string | null
  aprovacaoStatus?: string | null
  dataInicio?: string | null
  dataFim?: string | null
  horasSolicitadas?: number | null
  autor: { id: string; name: string; avatarUrl?: string | null }
  atribuido?: { id: string; name: string } | null
  unit?: { id: string; name: string; color: string } | null
  _count: { mensagens: number }
}

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string; dot: string }> = {
  ABERTO:       { label: 'Aberto',              icon: Circle,       color: 'text-blue-600 bg-blue-50',     dot: 'bg-blue-500' },
  EM_ANDAMENTO: { label: 'Em andamento',        icon: Clock,        color: 'text-amber-600 bg-amber-50',   dot: 'bg-amber-500' },
  PENDENTE:     { label: 'Pendente de documento', icon: FileClock,  color: 'text-orange-600 bg-orange-50', dot: 'bg-orange-500' },
  RESOLVIDO:    { label: 'Resolvido',           icon: CheckCircle2, color: 'text-green-600 bg-green-50',   dot: 'bg-green-500' },
  FECHADO:      { label: 'Fechado',             icon: XCircle,      color: 'text-gray-500 bg-gray-100',    dot: 'bg-gray-400' },
}

const PRIO_META: Record<string, { label: string; color: string }> = {
  BAIXA:   { label: 'Baixa',   color: 'text-gray-500 bg-gray-100' },
  NORMAL:  { label: 'Normal',  color: 'text-blue-600 bg-blue-50' },
  ALTA:    { label: 'Alta',    color: 'text-amber-600 bg-amber-50' },
  URGENTE: { label: 'Urgente', color: 'text-red-600 bg-red-50' },
}

const TIPO_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  HORAS_EXTRAS: { label: 'Horas extras',        icon: Clock,    color: 'text-indigo-600 bg-indigo-50' },
  BANCO_HORAS:  { label: 'Usar banco de horas',  icon: Timer,    color: 'text-purple-600 bg-purple-50' },
  FOLGA:        { label: 'Folga',               icon: Palmtree, color: 'text-teal-600 bg-teal-50' },
  AUSENCIA:     { label: 'Ausência',            icon: UserX,    color: 'text-orange-600 bg-orange-50' },
}

const APROV_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  PENDENTE:  { label: 'Aguardando aprovação', icon: Hourglass,   color: 'text-amber-600 bg-amber-50' },
  APROVADO:  { label: 'Aprovado',             icon: ThumbsUp,    color: 'text-green-600 bg-green-50' },
  REJEITADO: { label: 'Rejeitado',            icon: ThumbsDown,  color: 'text-red-600 bg-red-50' },
}

const CATEGORIAS = ['Dúvida', 'Problema', 'Solicitação', 'Outros']

type TipoAbertura = '' | 'HORAS_EXTRAS' | 'BANCO_HORAS' | 'FOLGA' | 'AUSENCIA'

const TIPOS_COM_HORAS: TipoAbertura[] = ['HORAS_EXTRAS', 'BANCO_HORAS']

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function formatDateBR(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Avatar({ src, name, size = 8 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const cls = `rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`
  const px  = size * 4
  if (src) return <img src={src} alt={name} className={`${cls} object-cover`} style={{ width: px, height: px }} />
  return <div className={cls} style={{ background: 'linear-gradient(135deg,#15AFA4,#0d8c83)', width: px, height: px }}>{initials}</div>
}

export default function ChamadosPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [chamados, setChamados]   = useState<Chamado[]>([])
  const [total, setTotal]         = useState(0)
  const [pages, setPages]         = useState(1)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)

  const [search, setSearch]           = useState('')
  const [filterStatus, setStatus]     = useState('')
  const [filterPrio, setPrio]         = useState('')
  const [filterTipo, setFilterTipo]   = useState('')

  const [newOpen, setNewOpen]         = useState(false)
  const [tipoAbertura, setTipoAbertura] = useState<TipoAbertura>('')
  const [form, setForm] = useState({
    titulo: '', descricao: '', categoria: 'Dúvida', prioridade: 'NORMAL',
    dataInicio: '', dataFim: '', horasSolicitadas: '', atribuidoId: '', criarTarefa: false,
  })
  const [submitting, setSubmit] = useState(false)
  const [analistas, setAnalistas] = useState<{ id: string; name: string }[]>([])

  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/users').then((r) => r.json()).then((data) =>
      setAnalistas(data.filter((u: any) => u.role === 'ANALYST' || u.role === 'GERENTE'))
    )
  }, [isAdmin])

  const fetchChamados = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (filterStatus) params.set('status', filterStatus)
    if (filterPrio)   params.set('prioridade', filterPrio)
    if (filterTipo)   params.set('tipoSolicitacao', filterTipo)
    const res = await fetch(`/api/chamados?${params}`)
    if (res.ok) {
      const data = await res.json()
      let list = data.chamados as Chamado[]
      if (search.trim()) {
        const q = search.toLowerCase()
        list = list.filter((c) =>
          c.titulo.toLowerCase().includes(q) ||
          c.autor.name.toLowerCase().includes(q),
        )
      }
      setChamados(list)
      setTotal(data.total)
      setPages(data.pages)
    }
    setLoading(false)
  }, [page, filterStatus, filterPrio, filterTipo, search])

  useEffect(() => { fetchChamados() }, [fetchChamados])

  function resetForm() {
    setTipoAbertura('')
    setForm({
      titulo: '', descricao: '', categoria: 'Dúvida', prioridade: 'NORMAL',
      dataInicio: '', dataFim: '', horasSolicitadas: '', atribuidoId: '', criarTarefa: false,
    })
  }

  async function handleDelete(e: React.MouseEvent, id: string, titulo: string) {
    e.stopPropagation()
    if (!confirm(`Excluir o chamado "${titulo}"? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/chamados/${id}`, { method: 'DELETE' })
    if (res.ok) fetchChamados()
    else alert('Não foi possível excluir o chamado.')
  }

  async function submit() {
    setSubmit(true)
    const body: any = tipoAbertura
      ? {
          tipoSolicitacao: tipoAbertura,
          descricao: form.descricao,
          prioridade: 'NORMAL',
          dataInicio: form.dataInicio,
          dataFim: form.dataFim || undefined,
          horasSolicitadas: TIPOS_COM_HORAS.includes(tipoAbertura) && form.horasSolicitadas
            ? parseFloat(form.horasSolicitadas)
            : undefined,
          // Admin pode atribuir analista também em solicitações de jornada
          atribuidoId: form.atribuidoId || undefined,
          criarTarefa: form.atribuidoId ? form.criarTarefa : false,
        }
      : {
          titulo: form.titulo,
          descricao: form.descricao,
          categoria: form.categoria,
          prioridade: form.prioridade,
          atribuidoId: form.atribuidoId || undefined,
          criarTarefa: form.atribuidoId ? form.criarTarefa : false,
        }

    const res = await fetch('/api/chamados', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) {
      setNewOpen(false)
      resetForm()
      fetchChamados()
    } else {
      const data = await res.json().catch(() => null)
      alert(data?.error || 'Não foi possível abrir o chamado.')
    }
    setSubmit(false)
  }

  const TIPO_BUTTONS: { value: TipoAbertura; label: string; icon: React.ElementType; desc: string }[] = [
    { value: '',             label: 'Chamado',              icon: MessageSquare, desc: 'Dúvida, problema ou solicitação geral' },
    { value: 'HORAS_EXTRAS', label: 'Horas extras',         icon: Clock,         desc: 'Ficar até mais tarde / registrar crédito no banco' },
    { value: 'BANCO_HORAS',  label: 'Usar banco de horas',   icon: Timer,         desc: 'Sair mais cedo ou compensar com o saldo do banco' },
    { value: 'FOLGA',        label: 'Folga',                icon: Palmtree,      desc: 'Solicitar dia(s) de folga' },
    { value: 'AUSENCIA',     label: 'Ausência',             icon: UserX,         desc: 'Registrar ausência ou falta' },
  ]

  const solicitacoesPendentes = chamados.filter(
    (c) => c.tipoSolicitacao && c.aprovacaoStatus === 'PENDENTE',
  ).length

  return (
    <>
      <Header title="Chamados" subtitle={`${total} chamado${total !== 1 ? 's' : ''}`} />

      <div className="p-6 space-y-4">
        {/* Botão novo chamado */}
        <div className="flex justify-end">
          <Button onClick={() => { resetForm(); setNewOpen(true) }} icon={<Plus className="w-4 h-4" />}>
            Novo chamado
          </Button>
        </div>

        {/* Filtros rápidos para solicitações — só admin */}
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            {[
              { value: '',              label: 'Todos' },
              { value: 'SOLICITACAO',   label: `Solicitações${solicitacoesPendentes > 0 ? ` (${solicitacoesPendentes} pendentes)` : ''}` },
              { value: 'HORAS_EXTRAS',  label: 'Horas extras' },
              { value: 'BANCO_HORAS',   label: 'Usar banco' },
              { value: 'FOLGA',         label: 'Folga' },
              { value: 'AUSENCIA',      label: 'Ausência' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => { setFilterTipo(f.value); setPage(1) }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  filterTipo === f.value
                    ? 'bg-[#15AFA4] text-white border-[#15AFA4]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#15AFA4]/40',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Barra de busca e filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar chamados…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
            />
          </div>
          <Select value={filterStatus} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="w-40">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select value={filterPrio} onChange={(e) => { setPrio(e.target.value); setPage(1) }} className="w-36">
            <option value="">Todas as prioridades</option>
            {Object.entries(PRIO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : chamados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum chamado encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {chamados.map((c) => {
              const sm   = STATUS_META[c.status] ?? STATUS_META.ABERTO
              const pm   = PRIO_META[c.prioridade] ?? PRIO_META.NORMAL
              const tm   = c.tipoSolicitacao ? TIPO_META[c.tipoSolicitacao] : null
              const am   = c.aprovacaoStatus ? APROV_META[c.aprovacaoStatus] : null
              const TipoIcon = tm?.icon
              const AprovIcon = am?.icon
              const isSol = !!c.tipoSolicitacao

              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/chamados/${c.id}`)}
                  className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 hover:border-[#15AFA4]/30 hover:shadow-sm transition-all text-left group"
                >
                  {/* Avatar */}
                  <Avatar src={c.autor.avatarUrl} name={c.autor.name} size={9} />

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', sm.dot)} />
                      <p className="font-semibold text-gray-800 text-sm truncate">{c.titulo}</p>
                      {c.naoLidas > 0 && (
                        <span className="ml-auto flex-shrink-0 bg-[#15AFA4] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {c.naoLidas}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Tipo de solicitação */}
                      {tm && TipoIcon && (
                        <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', tm.color)}>
                          <TipoIcon className="w-3 h-3" />
                          {tm.label}
                        </span>
                      )}
                      {/* Aprovação status */}
                      {am && AprovIcon && (
                        <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', am.color)}>
                          <AprovIcon className="w-3 h-3" />
                          {am.label}
                        </span>
                      )}
                      {/* Categoria (só para chamados comuns) */}
                      {!isSol && (
                        <span className="text-[11px] text-gray-400">{c.categoria}</span>
                      )}
                      {/* Datas da solicitação */}
                      {isSol && c.dataInicio && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                          <CalendarDays className="w-3 h-3" />
                          {formatDateBR(c.dataInicio)}{c.dataFim ? ` a ${formatDateBR(c.dataFim)}` : ''}
                        </span>
                      )}
                      {/* Horas banco */}
                      {isSol && c.horasSolicitadas != null && (
                        <span className="text-[11px] text-gray-500">{c.horasSolicitadas}h</span>
                      )}
                      {/* Prioridade (só chamados comuns) */}
                      {!isSol && (
                        <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded-full', pm.color)}>
                          {pm.label}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">· {c.autor.name}</span>
                      {c.unit && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.unit.color }} />
                          {c.unit.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Direita */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {c._count.mensagens > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {c._count.mensagens}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{timeAgo(c.updatedAt)}</span>
                    {isAdmin && (
                      <button
                        onClick={(e) => handleDelete(e, c.id, c.titulo)}
                        title="Excluir chamado"
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#15AFA4] transition-colors" />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Paginação */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-sm text-gray-500">{page} / {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
          </div>
        )}
      </div>

      {/* Modal novo chamado / solicitação */}
      <Modal
        open={newOpen}
        onClose={() => { setNewOpen(false); resetForm() }}
        title="Novo chamado"
      >
        <div className="p-6 space-y-5">
          {/* Seletor de tipo */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Tipo de abertura
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIPO_BUTTONS.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTipoAbertura(value)}
                  className={cn(
                    'flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all',
                    tipoAbertura === value
                      ? 'border-[#15AFA4] bg-[#15AFA4]/5'
                      : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-4 h-4', tipoAbertura === value ? 'text-[#15AFA4]' : 'text-gray-400')} />
                    <span className={cn('text-sm font-semibold', tipoAbertura === value ? 'text-[#15AFA4]' : 'text-gray-700')}>
                      {label}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 leading-snug">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chamado comum */}
          {tipoAbertura === '' && (
            <>
              <Input
                label="Título"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Descreva brevemente o assunto"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                  <Select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
                  <Select value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}>
                    {Object.entries(PRIO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </Select>
                </div>
              </div>
              <Textarea
                label="Descrição"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhe sua dúvida, problema ou solicitação…"
                rows={4}
                required
              />

              {isAdmin && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Atribuir a (opcional)</label>
                    <Select
                      value={form.atribuidoId}
                      onChange={(e) => setForm((f) => ({ ...f, atribuidoId: e.target.value, criarTarefa: e.target.value ? f.criarTarefa : false }))}
                    >
                      <option value="">Ninguém</option>
                      {analistas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </div>

                  {form.atribuidoId && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.criarTarefa}
                        onChange={(e) => setForm((f) => ({ ...f, criarTarefa: e.target.checked }))}
                        className="w-4 h-4 rounded accent-[#15AFA4]"
                      />
                      Abrir também uma tarefa para essa pessoa?
                    </label>
                  )}
                </div>
              )}
            </>
          )}

          {/* Solicitação de jornada */}
          {tipoAbertura !== '' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  label="Data de início"
                  value={form.dataInicio}
                  onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
                  required
                />
                <Input
                  type="date"
                  label="Data de fim (opcional)"
                  value={form.dataFim}
                  onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
                />
              </div>

              {TIPOS_COM_HORAS.includes(tipoAbertura) && (
                <Input
                  type="number"
                  label={tipoAbertura === 'HORAS_EXTRAS' ? 'Horas extras (crédito)' : 'Horas a usar do banco (débito)'}
                  value={form.horasSolicitadas}
                  onChange={(e) => setForm((f) => ({ ...f, horasSolicitadas: e.target.value }))}
                  placeholder="Ex.: 2"
                  min="0.5"
                  step="0.5"
                />
              )}

              {tipoAbertura === 'HORAS_EXTRAS' && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 px-3 py-2.5 text-xs text-indigo-800 leading-relaxed">
                  Use este tipo para <strong>registrar hora extra</strong> (ficou até mais tarde / trabalhou além do horário).
                  Isso é <strong>crédito</strong> no banco — não use para “sair mais cedo”.
                </div>
              )}
              {tipoAbertura === 'BANCO_HORAS' && (
                <div className="rounded-xl border border-purple-100 bg-purple-50/80 px-3 py-2.5 text-xs text-purple-800 leading-relaxed">
                  Use este tipo para <strong>usar o saldo do banco</strong> (sair mais cedo, compensar ou abater horas).
                  Isso é <strong>débito</strong> — não use para pedir ficar até mais tarde.
                </div>
              )}

              <Textarea
                label="Motivo / Justificativa"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder={
                  tipoAbertura === 'HORAS_EXTRAS'
                    ? 'Ex.: Fiquei até 20h no plantão do dia X para cobrir escala…'
                    : tipoAbertura === 'BANCO_HORAS'
                    ? 'Ex.: Quero sair 2h mais cedo no dia Y usando o banco de horas…'
                    : tipoAbertura === 'FOLGA'
                    ? 'Informe o motivo da solicitação de folga…'
                    : 'Informe o motivo da ausência…'
                }
                rows={4}
                required
              />

              {isAdmin && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Atribuir a (opcional)</label>
                    <Select
                      value={form.atribuidoId}
                      onChange={(e) => setForm((f) => ({ ...f, atribuidoId: e.target.value, criarTarefa: e.target.value ? f.criarTarefa : false }))}
                    >
                      <option value="">Ninguém</option>
                      {analistas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </div>
                  {form.atribuidoId && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.criarTarefa}
                        onChange={(e) => setForm((f) => ({ ...f, criarTarefa: e.target.checked }))}
                        className="w-4 h-4 rounded accent-[#15AFA4]"
                      />
                      Abrir também uma tarefa para essa pessoa?
                    </label>
                  )}
                </div>
              )}
            </>
          )}

          {/* Ações */}
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => { setNewOpen(false); resetForm() }}>Cancelar</Button>
            <Button isLoading={submitting} onClick={submit}>
              {tipoAbertura ? 'Enviar solicitação' : 'Abrir chamado'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
