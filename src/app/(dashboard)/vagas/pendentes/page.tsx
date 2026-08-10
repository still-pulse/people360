'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import {
  CheckCircle2, XCircle, MessageSquare, Clock, ExternalLink,
  User, Building2, Send, ChevronDown, ChevronUp,
} from 'lucide-react'
import { formatDatetime } from '@/lib/utils'
import type { VagaAprovacaoComentarioData } from '@/types'
import { APROVACAO_TIPO_LABELS } from '@/types'

const TABS = [
  { label: 'Dashboard',  href: '/vagas' },
  { label: 'Lista',      href: '/vagas/lista' },
  { label: 'Controle',   href: '/vagas/controle' },
  { label: 'Pendentes',  href: '/vagas/pendentes' },
]

interface VagaPendente {
  id: string
  cargo: string
  titulo: string
  municipio?: string | null
  quantidade: number
  tipoVaga: string
  createdAt: string
  requisicaoNextId?: string | null
  erpnextStatus?: string | null
  unit?: { name: string; color: string } | null
  analista?: { id: string; name: string } | null
  analistas?: { id: string; name: string }[]
  aprovacaoComentarios: VagaAprovacaoComentarioData[]
}

type AcaoTipo = 'APROVAR' | 'REJEITAR' | 'SOLICITAR_INFO' | 'RESPOSTA'

const TIPO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  APROVACAO:       { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-100' },
  REJEICAO:        { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-100'   },
  SOLICITACAO_INFO:{ bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-100' },
  RESPOSTA:        { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-100'  },
}

export default function VagasPendentesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const role = session?.user?.role ?? 'ANALYST'
  const isAdmin = ['ADMIN', 'SUPERINTENDENT', 'GERENTE'].includes(role)

  const [vagas, setVagas] = useState<VagaPendente[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  // Modal de ação
  const [actionModal, setActionModal] = useState<{ vaga: VagaPendente; acao: AcaoTipo } | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  // Thread inline
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [replyVagaId, setReplyVagaId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isSendingReply, setIsSendingReply] = useState(false)

  async function load() {
    setIsLoading(true)
    const res = await fetch('/api/vagas/pendentes')
    if (res.ok) setVagas(await res.json())
    setIsLoading(false)
  }

  useEffect(() => { load() }, [])

  async function syncErpnext() {
    if (!isAdmin) return
    setIsSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/integrations/erpnext/job-requisitions', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncMsg(data.error || 'Falha no sync com ERPNext')
      } else if (!data.configured) {
        setSyncMsg('ERPNext não configurado no servidor (env).')
      } else if (data.errors?.length && !data.created && !data.updated) {
        setSyncMsg(`Erro: ${data.errors[0]?.error || 'sync falhou'}`)
      } else {
        setSyncMsg(
          `ERPNext: ${data.fetched ?? 0} pendente(s)` +
            (data.fetchedApproved ? ` · ${data.fetchedApproved} aprovada(s) recentes` : '') +
            ` · ${data.created ?? 0} nova(s)` +
            (data.createdOpen ? ` (${data.createdOpen} já aberta(s) na lista)` : '') +
            ` · ${data.updated ?? 0} atualizada(s)` +
            (data.errors?.length ? ` · ${data.errors.length} erro(s)` : ''),
        )
        await load()
      }
    } catch {
      setSyncMsg('Falha de rede ao sincronizar.')
    }
    setIsSyncing(false)
  }

  async function submitAction() {
    if (!actionModal) return
    if ((actionModal.acao === 'REJEITAR' || actionModal.acao === 'SOLICITAR_INFO') && !mensagem.trim()) {
      setActionError('Mensagem obrigatória.')
      return
    }
    setIsSaving(true)
    setActionError('')
    const res = await fetch(`/api/vagas/${actionModal.vaga.id}/aprovacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: actionModal.acao, mensagem }),
    })
    setIsSaving(false)
    if (res.ok) {
      const d = await res.json().catch(() => ({} as any))
      setActionModal(null)
      setMensagem('')
      // Após aprovar, a vaga sai de pendentes e entra na lista (ABERTA)
      if (actionModal.acao === 'APROVAR' && d.href) {
        router.push(d.href)
        return
      }
      load()
    } else {
      const d = await res.json()
      setActionError(d.error ?? 'Erro ao processar')
    }
  }

  async function sendReply(vagaId: string) {
    if (!replyText.trim()) return
    setIsSendingReply(true)
    await fetch(`/api/vagas/${vagaId}/aprovacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'RESPOSTA', mensagem: replyText }),
    })
    setIsSendingReply(false)
    setReplyText('')
    setReplyVagaId(null)
    load()
  }

  const openAction = (vaga: VagaPendente, acao: AcaoTipo) => {
    setActionModal({ vaga, acao })
    setMensagem('')
    setActionError('')
  }

  const ACTION_CONFIG = {
    APROVAR:        { label: 'Aprovar Vaga',          color: 'bg-green-600 hover:bg-green-700', textColor: 'text-green-700', icon: CheckCircle2 },
    REJEITAR:       { label: 'Rejeitar Vaga',         color: 'bg-red-600 hover:bg-red-700',     textColor: 'text-red-700',   icon: XCircle },
    SOLICITAR_INFO: { label: 'Solicitar Informações', color: 'bg-amber-500 hover:bg-amber-600', textColor: 'text-amber-700', icon: MessageSquare },
    RESPOSTA:       { label: 'Enviar Resposta',       color: '',                                textColor: '',               icon: Send },
  }

  const pathname = '/vagas/pendentes'

  return (
    <>
      <Header title="Vagas Pendentes de Aprovação" />
      <div className="p-6 space-y-5">

        {/* Tabs + sync ERPNext */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {TABS.filter(t => t.href !== '/vagas/pendentes' || isAdmin || !isAdmin).map((t) => (
              <button key={t.href}
                onClick={() => router.push(t.href)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  t.href === pathname ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {syncMsg && <span className="text-xs text-gray-500 max-w-xs truncate">{syncMsg}</span>}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSyncing}
                onClick={syncErpnext}
              >
                {isSyncing ? 'Sincronizando…' : 'Sincronizar ERPNext'}
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        ) : vagas.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhuma vaga pendente de aprovação</p>
              <p className="text-sm text-gray-400 mt-1">Todas as vagas estão em dia.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {vagas.map((vaga) => {
              const isExpanded = expandedId === vaga.id
              const lastComentario = vaga.aprovacaoComentarios.at(-1)
              const hasThread = vaga.aprovacaoComentarios.length > 0

              return (
                <Card key={vaga.id}>
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Cor da unidade */}
                      <div className="w-1 self-stretch rounded-full flex-shrink-0"
                        style={{ background: vaga.unit?.color ?? '#15AFA4' }} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900">{vaga.cargo}</h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                                Pendente
                              </span>
                              {vaga.requisicaoNextId && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[#15AFA4]/15 text-[#0d7a72] font-semibold font-mono">
                                  ERPNext · {vaga.requisicaoNextId}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                              {vaga.unit && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />{vaga.unit.name}
                                </span>
                              )}
                              {(vaga.analista || vaga.analistas?.[0]) && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />{(vaga.analista || vaga.analistas![0]).name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />Enviada {formatDatetime(vaga.createdAt)}
                              </span>
                              {vaga.municipio && <span>· {vaga.municipio}</span>}
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => router.push(`/vagas/${vaga.id}`)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-100"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Ver vaga
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => openAction(vaga, 'SOLICITAR_INFO')}
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors font-medium"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" /> Pedir info
                                </button>
                                <button
                                  onClick={() => openAction(vaga, 'REJEITAR')}
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors font-medium"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Rejeitar
                                </button>
                                <button
                                  onClick={() => openAction(vaga, 'APROVAR')}
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#15AFA4] text-white hover:bg-[#0d8c83] transition-colors font-medium"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Preview do último comentário + toggle thread */}
                        {hasThread && (
                          <div className="mt-3">
                            {!isExpanded && lastComentario && (
                              <div className={`px-3 py-2 rounded-lg border text-xs ${TIPO_COLORS[lastComentario.tipo]?.bg ?? 'bg-gray-50'} ${TIPO_COLORS[lastComentario.tipo]?.border ?? 'border-gray-100'} ${TIPO_COLORS[lastComentario.tipo]?.text ?? 'text-gray-700'}`}>
                                <span className="font-semibold">{lastComentario.user.name}:</span> {lastComentario.mensagem}
                              </div>
                            )}
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : vaga.id)}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mt-1.5 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {isExpanded ? 'Ocultar' : `Ver ${vaga.aprovacaoComentarios.length} comentário${vaga.aprovacaoComentarios.length > 1 ? 's' : ''}`}
                            </button>
                          </div>
                        )}

                        {/* Thread expandida */}
                        {isExpanded && (
                          <div className="mt-3 space-y-2 border-l-2 border-gray-100 pl-4">
                            {vaga.aprovacaoComentarios.map((c) => {
                              const colors = TIPO_COLORS[c.tipo] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100' }
                              return (
                                <div key={c.id} className={`px-3 py-2.5 rounded-xl border ${colors.bg} ${colors.border}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-bold ${colors.text}`}>
                                      {c.user.name} · {APROVACAO_TIPO_LABELS[c.tipo]}
                                    </span>
                                    <span className="text-xs text-gray-400">{formatDatetime(c.createdAt)}</span>
                                  </div>
                                  <p className={`text-sm ${colors.text}`}>{c.mensagem}</p>
                                </div>
                              )
                            })}

                            {/* Caixa de resposta (analista responde solicitações) */}
                            {replyVagaId === vaga.id ? (
                              <div className="flex gap-2 mt-2">
                                <textarea
                                  autoFocus
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder="Digite sua resposta..."
                                  rows={2}
                                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20 resize-none"
                                />
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => sendReply(vaga.id)}
                                    disabled={isSendingReply || !replyText.trim()}
                                    className="px-3 py-1.5 rounded-lg bg-[#15AFA4] text-white text-xs font-medium hover:bg-[#0d8c83] disabled:opacity-50 transition-colors"
                                  >
                                    Enviar
                                  </button>
                                  <button
                                    onClick={() => { setReplyVagaId(null); setReplyText('') }}
                                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setReplyVagaId(vaga.id)}
                                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#15AFA4] transition-colors mt-1"
                              >
                                <Send className="w-3 h-3" /> Responder
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de ação (Aprovar / Rejeitar / Solicitar Info) */}
      {actionModal && (
        <Modal
          open={!!actionModal}
          onClose={() => setActionModal(null)}
          title={ACTION_CONFIG[actionModal.acao].label}
          size="sm"
        >
          <div className="p-6 space-y-4">
            <div className="p-3 bg-gray-50 rounded-xl text-sm">
              <p className="font-semibold text-gray-800">{actionModal.vaga.cargo}</p>
              <p className="text-gray-500 text-xs mt-0.5">{actionModal.vaga.unit?.name} · {actionModal.vaga.analista?.name}</p>
            </div>

            {actionModal.acao === 'APROVAR' ? (
              <p className="text-sm text-gray-600">
                Confirma a aprovação desta vaga? Ela ficará disponível como <strong>Aberta</strong> no sistema e a analista será notificada.
              </p>
            ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  {actionModal.acao === 'REJEITAR' ? 'Motivo da rejeição *' : 'Quais informações são necessárias? *'}
                </label>
                <textarea
                  autoFocus
                  rows={4}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder={
                    actionModal.acao === 'REJEITAR'
                      ? 'Explique o motivo da rejeição...'
                      : 'Descreva quais informações ou ajustes são necessários...'
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20 resize-none"
                />
              </div>
            )}

            {actionError && <p className="text-sm text-red-500">{actionError}</p>}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setActionModal(null)}>
                Cancelar
              </Button>
              <button
                onClick={submitAction}
                disabled={isSaving}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 ${
                  actionModal.acao === 'APROVAR' ? 'bg-[#15AFA4] hover:bg-[#0d8c83]' :
                  actionModal.acao === 'REJEITAR' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {isSaving ? 'Processando...' : ACTION_CONFIG[actionModal.acao].label}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
