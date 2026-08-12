'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Select, Textarea } from '@/components/ui/input'
import {
  ArrowLeft, Send, CheckCircle2, XCircle, Clock, Circle,
  AlertTriangle, User, Building2, Tag, Calendar, RefreshCw,
  Paperclip, X, FileText, FileImage, FileSpreadsheet, File, Download,
  Timer, Palmtree, UserX, ThumbsUp, ThumbsDown, Hourglass, CalendarDays, Trash2,
  FileClock, Stethoscope,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Anexo {
  id: string
  nome: string
  url: string
  tamanho: number
  tipo: string
}

interface Mensagem {
  id: string
  conteudo: string
  createdAt: string
  autor: { id: string; name: string; avatarUrl?: string | null; role: string }
  anexos: Anexo[]
}

interface ChamadoDetalhe {
  id: string
  titulo: string
  descricao: string
  status: string
  prioridade: string
  categoria: string
  createdAt: string
  updatedAt: string
  resolvidoAt?: string | null
  tipoSolicitacao?: string | null
  aprovacaoStatus?: string | null
  dataInicio?: string | null
  dataFim?: string | null
  horaEntrada?: string | null
  horaSaida?: string | null
  horasSolicitadas?: number | null
  aprovacaoJustificativa?: string | null
  aprovadoAt?: string | null
  autor:       { id: string; name: string; avatarUrl?: string | null; role: string }
  atribuido?:  { id: string; name: string; avatarUrl?: string | null } | null
  unit?:       { id: string; name: string; color: string } | null
  aprovadoPor?: { id: string; name: string } | null
  mensagens: Mensagem[]
}

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  ABERTO:       { label: 'Aberto',              icon: Circle,       color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-100' },
  EM_ANDAMENTO: { label: 'Em andamento',        icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100' },
  PENDENTE:     { label: 'Pendente de documento', icon: FileClock,  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
  RESOLVIDO:    { label: 'Resolvido',           icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50 border-green-100' },
  FECHADO:      { label: 'Fechado',             icon: XCircle,      color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-200' },
}

const PRIO_META: Record<string, { label: string; color: string }> = {
  BAIXA:   { label: 'Baixa',   color: 'text-gray-500' },
  NORMAL:  { label: 'Normal',  color: 'text-blue-600' },
  ALTA:    { label: 'Alta',    color: 'text-amber-600' },
  URGENTE: { label: 'Urgente', color: 'text-red-600' },
}

const TIPO_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  HORAS_EXTRAS:     { label: 'Horas extras (crédito)',       icon: Clock,       color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100' },
  BANCO_HORAS:      { label: 'Usar banco de horas (débito)', icon: Timer,       color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100' },
  FOLGA:            { label: 'Folga',                        icon: Palmtree,    color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-100' },
  AUSENCIA:         { label: 'Ausência (dia inteiro)',       icon: UserX,       color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100' },
  AUSENCIA_PARCIAL: { label: 'Ausência Parcial (algumas horas)', icon: Stethoscope, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-100' },
}

const APROV_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  PENDENTE:  { label: 'Aguardando aprovação', icon: Hourglass,  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-100' },
  APROVADO:  { label: 'Aprovado',             icon: ThumbsUp,   color: 'text-green-700',  bg: 'bg-green-50 border-green-100' },
  REJEITADO: { label: 'Rejeitado',            icon: ThumbsDown, color: 'text-red-700',    bg: 'bg-red-50 border-red-100' },
}

function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  if (src) return <img src={src} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#15AFA4,#0d8c83)', fontSize: size * 0.35 }}>
      {initials}
    </div>
  )
}

function fileIcon(tipo: string) {
  if (tipo.startsWith('image/'))       return FileImage
  if (tipo.includes('pdf'))            return FileText
  if (tipo.includes('sheet') || tipo.includes('excel') || tipo.includes('csv')) return FileSpreadsheet
  return File
}

function formatBytes(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateBR(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ChamadoDetalhePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [chamado, setChamado]       = useState<ChamadoDetalhe | null>(null)
  const [loading, setLoading]       = useState(true)
  const [msg, setMsg]               = useState('')
  const [sending, setSending]       = useState(false)
  const [updating, setUpdating]     = useState(false)
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; name: string }[]>([])
  const [selectedFiles, setFiles]   = useState<File[]>([])
  const [uploading, setUploading]   = useState(false)

  // Aprovação
  const [aprovJust, setAprovJust]   = useState('')
  const [aprovando, setAprovando]   = useState(false)

  const bottomRef    = useRef<HTMLDivElement>(null)
  const textRef      = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isAdmin      = session?.user?.role === 'ADMIN'

  const fetchChamado = useCallback(async () => {
    const res = await fetch(`/api/chamados/${params.id}`)
    if (res.ok) setChamado(await res.json())
    setLoading(false)
  }, [params.id])

  useEffect(() => { fetchChamado() }, [fetchChamado])

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/users')
        .then((r) => r.json())
        .then((u) =>
          setAssignableUsers(
            u.filter((x: any) => ['ADMIN', 'ANALYST', 'GERENTE', 'SUPERINTENDENT'].includes(x.role) && x.active !== false),
          ),
        )
        .catch(() => {})
    }
  }, [isAdmin])

  useEffect(() => {
    if (chamado) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [chamado?.mensagens.length])

  async function sendMsg() {
    if (!msg.trim() && selectedFiles.length === 0) return
    if (!chamado) return
    setSending(true)

    let anexos: { url: string; nome: string; tamanho: number; tipo: string }[] = []
    if (selectedFiles.length > 0) {
      setUploading(true)
      for (const file of selectedFiles) {
        const fd = new FormData()
        fd.append('file', file)
        const r = await fetch('/api/upload/chamado-anexo', { method: 'POST', body: fd })
        if (r.ok) anexos.push(await r.json())
      }
      setUploading(false)
    }

    const res = await fetch(`/api/chamados/${params.id}/mensagens`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudo: msg.trim(), anexos }),
    })
    if (res.ok) {
      const newMsg = await res.json()
      setChamado((prev) => prev ? {
        ...prev,
        status: prev.status === 'ABERTO' && isAdmin ? 'EM_ANDAMENTO' : prev.status,
        mensagens: [...prev.mensagens, newMsg],
      } : prev)
      setMsg('')
      setFiles([])
      textRef.current?.focus()
    }
    setSending(false)
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...files].slice(0, 5))
    e.target.value = ''
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  async function updateChamado(patch: Record<string, string>) {
    setUpdating(true)
    const res = await fetch(`/api/chamados/${params.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    if (res.ok) await fetchChamado()
    setUpdating(false)
  }

  async function handleDelete() {
    if (!chamado) return
    if (!confirm(`Excluir o chamado "${chamado.titulo}"? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/chamados/${params.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/chamados')
    else alert('Não foi possível excluir o chamado.')
  }

  async function decidirAprovacao(decisao: 'APROVADO' | 'REJEITADO') {
    setAprovando(true)
    const res = await fetch(`/api/chamados/${params.id}/aprovacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisao, justificativa: aprovJust }),
    })
    if (res.ok) {
      await fetchChamado()
      setAprovJust('')
    }
    setAprovando(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
  }

  if (loading) {
    return (
      <>
        <Header title="Chamado" />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-[#15AFA4]" />
        </div>
      </>
    )
  }
  if (!chamado) {
    return (
      <>
        <Header title="Chamado não encontrado" />
        <div className="p-6"><Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => router.back()}>Voltar</Button></div>
      </>
    )
  }

  const sm         = STATUS_META[chamado.status] ?? STATUS_META.ABERTO
  const pm         = PRIO_META[chamado.prioridade] ?? PRIO_META.NORMAL
  const tm         = chamado.tipoSolicitacao ? TIPO_META[chamado.tipoSolicitacao] : null
  const am         = chamado.aprovacaoStatus ? APROV_META[chamado.aprovacaoStatus] : null
  const StatusIcon = sm.icon
  const isClosed   = chamado.status === 'FECHADO'
  const isPendente = chamado.tipoSolicitacao && chamado.aprovacaoStatus === 'PENDENTE'

  return (
    <>
      <Header title={chamado.titulo} subtitle={`Chamado #${params.id.slice(-6).toUpperCase()} · ${sm.label}`} />
      <div className="p-6">
        <div className="flex gap-6 max-w-6xl">

          {/* Thread de mensagens */}
          <div className="flex-1 flex flex-col min-h-0">
            <button onClick={() => router.push('/chamados')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Todos os chamados
            </button>

            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {chamado.mensagens.map((m, i) => {
                  const isMine  = m.autor.id === session?.user?.id
                  const isFirst = i === 0 || chamado.mensagens[i - 1].autor.id !== m.autor.id
                  return (
                    <div key={m.id} className={cn('flex gap-3', isMine && 'flex-row-reverse')}>
                      {isFirst && <Avatar src={m.autor.avatarUrl} name={m.autor.name} size={32} />}
                      {!isFirst && <div style={{ width: 32 }} />}
                      <div className={cn('max-w-[70%] space-y-1', isMine && 'items-end flex flex-col')}>
                        {isFirst && (
                          <div className={cn('flex items-center gap-2 text-xs', isMine && 'flex-row-reverse')}>
                            <span className="font-semibold text-gray-700">{m.autor.name}</span>
                            <span className="text-gray-400">{m.autor.role === 'ADMIN' ? 'Administrador' : 'Analista'}</span>
                          </div>
                        )}
                        <div className={cn(
                          'rounded-2xl text-sm leading-relaxed',
                          isMine ? 'text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm',
                          (m.conteudo || m.anexos?.length > 0) ? 'overflow-hidden' : '',
                        )}
                          style={isMine ? { background: 'linear-gradient(135deg,#15AFA4,#0d8c83)' } : {}}>
                          {m.conteudo && <p className="px-4 py-2.5 whitespace-pre-wrap">{m.conteudo}</p>}
                          {m.anexos?.length > 0 && (
                            <div className={cn('space-y-1 px-3 pb-3', m.conteudo && 'pt-0 border-t', isMine ? 'border-white/20' : 'border-gray-200')}>
                              {m.anexos.map((a) => {
                                const Icon  = fileIcon(a.tipo)
                                const isImg = a.tipo.startsWith('image/')
                                return isImg ? (
                                  <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="block mt-2">
                                    <img src={a.url} alt={a.nome} className="max-w-[220px] max-h-[160px] rounded-xl object-cover" />
                                    <p className={cn('text-xs mt-1', isMine ? 'text-white/70' : 'text-gray-400')}>{a.nome}</p>
                                  </a>
                                ) : (
                                  <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                                    className={cn('flex items-center gap-2.5 px-3 py-2 rounded-xl mt-2 transition-colors group',
                                      isMine ? 'bg-white/15 hover:bg-white/25' : 'bg-white hover:bg-gray-50 border border-gray-100')}>
                                    <Icon className={cn('w-5 h-5 flex-shrink-0', isMine ? 'text-white/80' : 'text-[#15AFA4]')} />
                                    <div className="flex-1 min-w-0">
                                      <p className={cn('text-xs font-medium truncate', isMine ? 'text-white' : 'text-gray-700')}>{a.nome}</p>
                                      <p className={cn('text-[11px]', isMine ? 'text-white/60' : 'text-gray-400')}>{formatBytes(a.tamanho)}</p>
                                    </div>
                                    <Download className={cn('w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity', isMine ? 'text-white' : 'text-gray-400')} />
                                  </a>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        <p className={cn('text-[11px] text-gray-400 px-1', isMine && 'text-right')}>
                          {formatDt(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {!isClosed ? (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 ml-11">
                      {selectedFiles.map((f, i) => {
                        const Icon = fileIcon(f.type)
                        return (
                          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#15AFA4]/10 border border-[#15AFA4]/20 rounded-xl text-xs text-gray-700 max-w-[180px]">
                            <Icon className="w-3.5 h-3.5 text-[#15AFA4] flex-shrink-0" />
                            <span className="truncate flex-1">{f.name}</span>
                            <span className="text-gray-400 flex-shrink-0">{formatBytes(f.size)}</span>
                            <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex gap-3 items-end">
                    <Avatar src={session?.user?.avatarUrl} name={session?.user?.name ?? 'U'} size={32} />
                    <div className="flex-1">
                      <textarea
                        ref={textRef}
                        value={msg}
                        onChange={(e) => setMsg(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={selectedFiles.length > 0 ? 'Adicione uma mensagem (opcional)…' : 'Digite uma mensagem…'}
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        title="Anexar arquivo"
                        className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#15AFA4] hover:border-[#15AFA4]/40 hover:bg-[#15AFA4]/5 transition-colors"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <Button isLoading={sending || uploading} disabled={!msg.trim() && selectedFiles.length === 0} onClick={sendMsg} icon={<Send className="w-4 h-4" />}>
                        {uploading ? 'Enviando…' : 'Enviar'}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 ml-11">Enter para enviar · Shift+Enter para quebrar linha · Máx. 5 arquivos · 10 MB cada</p>
                  <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip" className="hidden" onChange={handleFilesSelected} />
                </div>
              ) : (
                <div className="border-t border-gray-100 p-4 text-center text-sm text-gray-400">
                  Este chamado está fechado. Abra um novo chamado se precisar de mais ajuda.
                </div>
              )}
            </div>
          </div>

          {/* Painel lateral */}
          <div className="w-72 flex-shrink-0 space-y-4">

            {/* Card de solicitação — visível para todos quando é solicitação */}
            {tm && (
              <div className={cn('rounded-2xl border p-4 space-y-3', tm.bg)}>
                <div className="flex items-center gap-2">
                  <tm.icon className={cn('w-4 h-4', tm.color)} />
                  <span className={cn('font-semibold text-sm', tm.color)}>{tm.label}</span>
                </div>

                {(chamado.dataInicio || chamado.dataFim) && (
                  <div className="flex items-start gap-2 text-sm">
                    <CalendarDays className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Período</p>
                      <p className="font-medium text-gray-700">
                        {formatDateBR(chamado.dataInicio)}
                        {chamado.dataFim && ` a ${formatDateBR(chamado.dataFim)}`}
                      </p>
                    </div>
                  </div>
                )}

                {(chamado.horaEntrada || chamado.horaSaida) && (
                  <div className="flex items-start gap-2 text-sm">
                    <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Horário</p>
                      <p className="font-medium text-gray-700 font-mono">
                        {chamado.horaEntrada || '—'} → {chamado.horaSaida || '—'}
                      </p>
                    </div>
                  </div>
                )}

                {chamado.horasSolicitadas != null && (
                  <div className="flex items-start gap-2 text-sm">
                    <Timer className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Horas</p>
                      <p className="font-medium text-gray-700">{chamado.horasSolicitadas}h</p>
                    </div>
                  </div>
                )}

                {/* Status de aprovação */}
                {am && (
                  <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border', am.bg)}>
                    <am.icon className={cn('w-4 h-4', am.color)} />
                    <span className={cn('text-xs font-semibold', am.color)}>{am.label}</span>
                  </div>
                )}

                {/* Quem aprovou / rejeitou */}
                {chamado.aprovadoPor && chamado.aprovadoAt && (
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>Por <span className="font-medium text-gray-700">{chamado.aprovadoPor.name}</span></p>
                    <p>{formatDt(chamado.aprovadoAt)}</p>
                    {chamado.aprovacaoJustificativa && (
                      <p className="mt-1 italic text-gray-600">"{chamado.aprovacaoJustificativa}"</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Painel de aprovação — admin, pendente */}
            {isAdmin && isPendente && (
              <div className="bg-white rounded-2xl border-2 border-amber-300 p-4 space-y-4">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Hourglass className="w-3.5 h-3.5" /> Decisão de aprovação
                </p>

                <Textarea
                  label="Observação (opcional)"
                  value={aprovJust}
                  onChange={(e) => setAprovJust(e.target.value)}
                  placeholder="Justificativa ou comentário sobre a decisão…"
                  rows={3}
                />

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    isLoading={aprovando}
                    onClick={() => decidirAprovacao('APROVADO')}
                    icon={<ThumbsUp className="w-4 h-4" />}
                  >
                    Aprovar
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    isLoading={aprovando}
                    onClick={() => decidirAprovacao('REJEITADO')}
                    icon={<ThumbsDown className="w-4 h-4" />}
                  >
                    Rejeitar
                  </Button>
                </div>
              </div>
            )}

            {/* Status geral */}
            <div className={cn('rounded-2xl border p-4 space-y-1', sm.bg)}>
              <div className="flex items-center gap-2">
                <StatusIcon className={cn('w-4 h-4', sm.color)} />
                <span className={cn('font-semibold text-sm', sm.color)}>{sm.label}</span>
              </div>
              {chamado.resolvidoAt && (
                <p className="text-xs text-gray-500">Resolvido em {formatDt(chamado.resolvidoAt)}</p>
              )}
            </div>

            {/* Controles — admin */}
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gerenciar</p>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Status</label>
                  <Select value={chamado.status} onChange={(e) => updateChamado({ status: e.target.value })} disabled={updating}>
                    {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Prioridade</label>
                  <Select value={chamado.prioridade} onChange={(e) => updateChamado({ prioridade: e.target.value })} disabled={updating}>
                    {Object.entries(PRIO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </Select>
                </div>

                {assignableUsers.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600">Atribuído a</label>
                    <Select value={chamado.atribuido?.id ?? ''} onChange={(e) => updateChamado({ atribuidoId: e.target.value })} disabled={updating}>
                      <option value="">Não atribuído</option>
                      {assignableUsers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </div>
                )}

                <Button variant="danger" size="sm" className="w-full" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir chamado
                </Button>
              </div>
            )}

            {/* Analista: fechar chamado */}
            {!isAdmin && !isClosed && chamado.status === 'RESOLVIDO' && (
              <Button variant="outline" className="w-full" onClick={() => updateChamado({ status: 'FECHADO' })}>
                <XCircle className="w-4 h-4 mr-2" /> Confirmar e fechar
              </Button>
            )}
            {!isAdmin && !isClosed && (
              <Button variant="danger" size="sm" className="w-full" onClick={() => updateChamado({ status: 'FECHADO' })}>
                <XCircle className="w-4 h-4 mr-2" /> Fechar chamado
              </Button>
            )}

            {/* Info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Informações</p>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2.5">
                  <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Aberto por</p>
                    <p className="font-medium text-gray-700">{chamado.autor.name}</p>
                  </div>
                </div>

                {chamado.unit && (
                  <div className="flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Unidade</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: chamado.unit.color }} />
                        <p className="font-medium text-gray-700">{chamado.unit.name}</p>
                      </div>
                    </div>
                  </div>
                )}

                {!chamado.tipoSolicitacao && (
                  <div className="flex items-start gap-2.5">
                    <Tag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Categoria</p>
                      <p className="font-medium text-gray-700">{chamado.categoria}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2.5">
                  <AlertTriangle className={cn('w-4 h-4 mt-0.5 flex-shrink-0', pm.color)} />
                  <div>
                    <p className="text-xs text-gray-400">Prioridade</p>
                    <p className={cn('font-medium', pm.color)}>{pm.label}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Aberto em</p>
                    <p className="font-medium text-gray-700">{formatDt(chamado.createdAt)}</p>
                  </div>
                </div>

                {chamado.atribuido && (
                  <div className="flex items-start gap-2.5">
                    <Avatar src={chamado.atribuido.avatarUrl} name={chamado.atribuido.name} size={16} />
                    <div>
                      <p className="text-xs text-gray-400">Responsável</p>
                      <p className="font-medium text-gray-700">{chamado.atribuido.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
