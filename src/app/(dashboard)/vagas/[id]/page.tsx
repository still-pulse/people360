'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import {
  ArrowLeft, Plus, Edit2, Trash2, User, Phone, Mail,
  Clock, CheckCircle2, AlertCircle, Calendar,
  Upload, FileText, X, Download, Loader2,
  ClipboardCheck, UserCheck, Search, Send, FileCheck2,
} from 'lucide-react'
import {
  VagaData, CandidatoData, VagaHistoricoData,
  VAGA_STATUS_LABELS, VAGA_STATUS_COLORS, CANDIDATO_STATUS_LABELS,
  CANDIDATO_STATUS_COLORS, TIPO_VAGA_LABELS, PERIODO_LABELS,
  TIPO_REQUISICAO_LABELS, TIPO_CONTRATO_LABELS, TIPO_RECRUTAMENTO_LABELS,
  CONTROLE_CANDIDATO_STATUS_LABELS, CONTROLE_CANDIDATO_STATUS_COLORS,
  APROVACAO_TIPO_LABELS,
} from '@/types'
import type { VagaAprovacaoComentarioData } from '@/types'
import { formatDate, formatDatetime } from '@/lib/utils'
import { VagaModal } from '@/components/vagas/VagaModal'
import { AuditTrail } from '@/components/audit/AuditTrail'

const candidatoStatusOptions = Object.entries(CANDIDATO_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))

const EMPTY_CAND = {
  nome: '', telefone: '', email: '', dataAprovacao: '',
  status: 'EM_PROCESSO', observacoes: '',
  cvFileName: '', cvOriginalName: '',
}

export default function VagaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const canEdit = session?.user?.role !== 'JURIDICO'
  const analystUnitIds: string[] = (session?.user as any)?.unitIds?.length
    ? (session?.user as any).unitIds
    : (session?.user?.unitId ? [session?.user?.unitId] : [])
  const analystUnitId = analystUnitIds[0] ?? null

  const [vaga, setVaga] = useState<VagaData | null>(null)
  const [units, setUnits] = useState<{ id: string; name: string; color: string }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string; unitId?: string | null; managedUnits?: { unitId: string }[] }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'candidatos' | 'historico' | 'acompanhamento' | 'aprovacao'>('candidatos')
  const [aprovacaoThread, setAprovacaoThread] = useState<VagaAprovacaoComentarioData[]>([])
  const [aprovacaoReply, setAprovacaoReply] = useState('')
  const [isSendingAprovacao, setIsSendingAprovacao] = useState(false)
  const [acompanhamentos, setAcomp]    = useState<any[]>([])
  const [acForm, setAcForm]            = useState({ decisao: 'ACOMPANHAR', notas: '' })
  const [isSavingAc, setIsSavingAc]    = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [isDeletingVaga, setIsDeletingVaga] = useState(false)

  async function deleteVaga() {
    if (!confirm(`Excluir a vaga "${vaga?.cargo}" permanentemente? Esta ação não pode ser desfeita.`)) return
    setIsDeletingVaga(true)
    await fetch(`/api/vagas/${params.id}`, { method: 'DELETE' })
    router.push('/vagas')
  }
  const [candModalOpen, setCandModalOpen] = useState(false)
  const [editCand, setEditCand] = useState<CandidatoData | null>(null)
  const [candForm, setCandForm] = useState({ ...EMPTY_CAND })
  const [isSavingCand, setIsSavingCand] = useState(false)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [isUploadingCv, setIsUploadingCv] = useState(false)
  const [cvDragOver, setCvDragOver] = useState(false)

  // Busca no Controle de Candidatos antes de abrir o form
  const [candSearchPhase, setCandSearchPhase] = useState(false)
  const [candSearchQuery, setCandSearchQuery] = useState('')
  const [candSearchResults, setCandSearchResults] = useState<{ id: string; nome: string; telefone?: string | null; funcao?: string; status: string }[]>([])
  const [isSearchingCands, setIsSearchingCands] = useState(false)

  async function load() {
    setIsLoading(true)
    const [vagaRes, acRes, apRes] = await Promise.all([
      fetch(`/api/vagas/${params.id}`),
      fetch(`/api/vagas/${params.id}/acompanhamentos`),
      fetch(`/api/vagas/${params.id}/aprovacao`),
    ])
    if (vagaRes.ok) setVaga(await vagaRes.json())
    if (acRes.ok) setAcomp(await acRes.json())
    if (apRes.ok) setAprovacaoThread(await apRes.json())
    setIsLoading(false)
  }

  async function sendAprovacaoReply() {
    if (!aprovacaoReply.trim()) return
    setIsSendingAprovacao(true)
    await fetch(`/api/vagas/${params.id}/aprovacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'RESPOSTA', mensagem: aprovacaoReply }),
    })
    setIsSendingAprovacao(false)
    setAprovacaoReply('')
    load()
  }

  async function saveAcompanhamento() {
    if (!acForm.decisao) return
    setIsSavingAc(true)
    const res = await fetch(`/api/vagas/${params.id}/acompanhamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(acForm),
    })
    setIsSavingAc(false)
    if (res.ok) {
      setAcForm({ decisao: 'ACOMPANHAR', notas: '' })
      load()
    }
  }

  useEffect(() => {
    load()
    fetch('/api/units').then((r) => r.json()).then(setUnits)
    fetch('/api/users').then((r) => r.json()).then(setUsers)
  }, [params.id])

  useEffect(() => {
    if (!candSearchQuery.trim() || candSearchQuery.length < 2) { setCandSearchResults([]); return }
    setIsSearchingCands(true)
    const t = setTimeout(async () => {
      const res = await fetch(`/api/candidatos-controle?search=${encodeURIComponent(candSearchQuery)}`)
      if (res.ok) setCandSearchResults(await res.json())
      setIsSearchingCands(false)
    }, 300)
    return () => clearTimeout(t)
  }, [candSearchQuery])

  async function handleCvSelect(file: File) {
    if (file.size > 10 * 1024 * 1024) { alert('Arquivo muito grande. Limite: 10 MB.'); return }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext ?? '')) { alert('Formato inválido. Use PDF, DOC ou DOCX.'); return }
    setCvFile(file)
  }

  async function uploadCvIfNeeded(): Promise<{ cvFileName: string; cvOriginalName: string } | null> {
    if (!cvFile) return null
    setIsUploadingCv(true)
    const fd = new FormData()
    fd.append('cv', cvFile)
    const res = await fetch('/api/upload/cv', { method: 'POST', body: fd })
    setIsUploadingCv(false)
    if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Erro no upload'); return null }
    const { fileName, originalName } = await res.json()
    return { cvFileName: fileName, cvOriginalName: originalName }
  }

  async function saveCandidato() {
    if (!candForm.nome.trim()) return
    setIsSavingCand(true)

    const cvData = await uploadCvIfNeeded()

    const payload = {
      ...candForm,
      dataAprovacao: candForm.dataAprovacao || null,
      ...(cvData ?? {}),
    }

    if (editCand) {
      await fetch(`/api/vagas/${params.id}/candidatos/${editCand.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch(`/api/vagas/${params.id}/candidatos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    setIsSavingCand(false)
    setCandModalOpen(false)
    setEditCand(null)
    setCvFile(null)
    load()
  }

  async function deleteCandidato(id: string, nome: string) {
    if (!confirm(`Remover candidato "${nome}"?`)) return
    await fetch(`/api/vagas/${params.id}/candidatos/${id}`, { method: 'DELETE' })
    load()
  }

  function openNewCand() {
    setEditCand(null)
    setCandForm({ ...EMPTY_CAND })
    setCvFile(null)
    setCandSearchPhase(true)
    setCandSearchQuery('')
    setCandSearchResults([])
    setCandModalOpen(true)
  }

  function selectControleCandidato(c: { nome: string; telefone?: string | null }) {
    setCandForm({ ...EMPTY_CAND, nome: c.nome, telefone: c.telefone ?? '' })
    setCandSearchPhase(false)
  }

  function openEditCand(c: CandidatoData) {
    setEditCand(c)
    setCandForm({
      nome: c.nome, telefone: c.telefone ?? '', email: c.email ?? '',
      dataAprovacao: c.dataAprovacao?.slice(0, 10) ?? '',
      status: c.status, observacoes: c.observacoes ?? '',
      cvFileName: c.cvFileName ?? '', cvOriginalName: c.cvOriginalName ?? '',
    })
    setCvFile(null)
    setCandModalOpen(true)
  }


  if (isLoading) {
    return (
      <>
        <Header title="Carregando vaga..." />
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
        </div>
      </>
    )
  }

  if (!vaga) return <div className="p-6 text-gray-500">Vaga não encontrada.</div>

  const candidatos = vaga.candidatos ?? []
  const historico = vaga.historico ?? []
  const statusColor = VAGA_STATUS_COLORS[vaga.status]

  const candsByStatus = {
    ativos: candidatos.filter((c) => ['EM_PROCESSO', 'APROVADO', 'AGUARDANDO_ADMISSAO'].includes(c.status)),
    admitidos: candidatos.filter((c) => c.status === 'ADMITIDO'),
    outros: candidatos.filter((c) => ['DESISTENTE', 'REPROVADO'].includes(c.status)),
  }

  return (
    <>
      <Header
        title={vaga.cargo}
        subtitle={`${vaga.unit?.name ?? ''}${vaga.municipio ? ` · ${vaga.municipio}` : ''}`}
      />
      <div className="p-6 space-y-5">

        {/* Voltar + Ações */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="ml-auto flex gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={deleteVaga} isLoading={isDeletingVaga}
                className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300">
                Excluir Vaga
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" icon={<Edit2 className="w-3.5 h-3.5" />}
                onClick={() => setEditOpen(true)}>
                Editar Vaga
              </Button>
            )}
          </div>
        </div>

        {/* Header da vaga */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-2" style={{ background: vaga.unit?.color ?? '#15AFA4' }} />
          <div className="p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{vaga.cargo}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{vaga.titulo}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold"
                  style={{ background: statusColor + '18', color: statusColor }}>
                  {VAGA_STATUS_LABELS[vaga.status]}
                </span>
              </div>
            </div>

            {/* Requisição NextERP */}
            {(vaga.requisicaoNextId || vaga.tipoRequisicao || vaga.tipoContrato || vaga.gestorRequisitante) && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Requisição</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {vaga.requisicaoNextId && (
                    <div>
                      <p className="text-xs text-blue-500">Next (ID RP)</p>
                      <p className="font-bold text-blue-900 font-mono">{vaga.requisicaoNextId}</p>
                    </div>
                  )}
                  {vaga.tipoRequisicao && (
                    <div>
                      <p className="text-xs text-blue-500">Tipo de Requisição</p>
                      <p className="font-semibold text-blue-900">{TIPO_REQUISICAO_LABELS[vaga.tipoRequisicao]}</p>
                    </div>
                  )}
                  {vaga.tipoContrato && (
                    <div>
                      <p className="text-xs text-blue-500">Contrato</p>
                      <p className="font-semibold text-blue-900">{TIPO_CONTRATO_LABELS[vaga.tipoContrato]}</p>
                    </div>
                  )}
                  {vaga.tipoRecrutamento && (
                    <div>
                      <p className="text-xs text-blue-500">Recrutamento</p>
                      <p className="font-semibold text-blue-900">{TIPO_RECRUTAMENTO_LABELS[vaga.tipoRecrutamento]}</p>
                    </div>
                  )}
                  {vaga.gestorRequisitante && (
                    <div>
                      <p className="text-xs text-blue-500">Gestor Requisitante</p>
                      <p className="font-semibold text-blue-900">{vaga.gestorRequisitante}</p>
                    </div>
                  )}
                  {vaga.setorRequisitante && (
                    <div>
                      <p className="text-xs text-blue-500">Setor Requisitante</p>
                      <p className="font-semibold text-blue-900">{vaga.setorRequisitante}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'Unidade', value: vaga.unit?.name },
                { label: 'Município', value: vaga.municipio },
                { label: 'Setor', value: vaga.setor },
                { label: 'Tipo de Vaga', value: TIPO_VAGA_LABELS[vaga.tipoVaga] },
                { label: 'Vagas', value: `${vaga.quantidade} vaga${vaga.quantidade > 1 ? 's' : ''}` },
                { label: 'Período', value: vaga.periodoTrabalho ? PERIODO_LABELS[vaga.periodoTrabalho] : null },
                { label: 'Horário', value: vaga.horarioTrabalho },
                { label: 'Carga Horária', value: vaga.cargaHoraria },
                { label: 'Escala', value: vaga.escala },
                { label: 'Salário', value: vaga.salarioMin ? `R$ ${vaga.salarioMin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null },
                { label: 'Analistas', value: (vaga as any).analistas?.map((a: any) => a.name).join(', ') || null },
                { label: 'Abertura', value: formatDate(vaga.dataAbertura) },
                { label: 'Prazo Previsto', value: vaga.dataPrevistaFechamento ? formatDate(vaga.dataPrevistaFechamento) : null },
                { label: 'Data Fechamento', value: vaga.dataFechamento ? formatDate(vaga.dataFechamento) : null },
                { label: 'Início / Integração', value: vaga.dataInicioIntegracao ? formatDate(vaga.dataInicioIntegracao) : null },
                { label: 'Vaga PCD', value: vaga.vagaPcd ? 'Sim' : null },
              ].filter((i) => i.value).map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
                  <p className="font-semibold text-gray-800">{value}</p>
                </div>
              ))}
            </div>

            {/* Colaborador que saiu */}
            {(vaga.nomeColaboradorSaiu || vaga.plantaoColaboradorSaiu) && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Colaborador em Substituição
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {vaga.nomeColaboradorSaiu && (
                    <div>
                      <p className="text-xs text-orange-600">Nome</p>
                      <p className="font-semibold text-orange-900">{vaga.nomeColaboradorSaiu}</p>
                    </div>
                  )}
                  {vaga.plantaoColaboradorSaiu && (
                    <div>
                      <p className="text-xs text-orange-600">Plantão</p>
                      <p className="font-semibold text-orange-900">{vaga.plantaoColaboradorSaiu}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Novo colaborador */}
            {(vaga.nomeColaborador || vaga.disponibilidadeHorario || vaga.numProcessoAdmissao || vaga.numProtocoloOnvio) && (
              <div className="mt-4 p-4 bg-teal-50 border border-teal-100 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" /> Candidato / Novo Colaborador
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {vaga.nomeColaborador && (
                    <div>
                      <p className="text-xs text-teal-600">Nome</p>
                      <p className="font-semibold text-teal-900">{vaga.nomeColaborador}</p>
                    </div>
                  )}
                  {vaga.disponibilidadeHorario && (
                    <div>
                      <p className="text-xs text-teal-600">Disponibilidade</p>
                      <p className="font-semibold text-teal-900">{vaga.disponibilidadeHorario}</p>
                    </div>
                  )}
                  {vaga.numProcessoAdmissao && (
                    <div>
                      <p className="text-xs text-teal-600">1Doc — Admissão</p>
                      <p className="font-semibold text-teal-900 font-mono">{vaga.numProcessoAdmissao}</p>
                    </div>
                  )}
                  {vaga.numProtocoloOnvio && (
                    <div>
                      <p className="text-xs text-teal-600">Onvio — Protocolo</p>
                      <p className="font-semibold text-teal-900 font-mono">{vaga.numProtocoloOnvio}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {vaga.observacoes && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                <span className="font-semibold">Observações:</span> {vaga.observacoes}
              </div>
            )}

          </div>
        </div>

        {/* Contadores candidatos */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Em Processo', count: candsByStatus.ativos.length, color: '#3B82F6', icon: Clock },
            { label: 'Admitidos', count: candsByStatus.admitidos.length, color: '#10B981', icon: CheckCircle2 },
            { label: 'Desistentes/Reprovados', count: candsByStatus.outros.length, color: '#94A3B8', icon: AlertCircle },
          ].map(({ label, count, color, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
                  <Icon className="w-4.5 h-4.5" style={{ color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs candidatos / histórico */}
        <div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-4">
            {([
              { key: 'candidatos',      label: `Candidatos (${candidatos.length})` },
              { key: 'acompanhamento',  label: `Acompanhamento (${acompanhamentos.length})` },
              { key: 'historico',       label: `Histórico (${historico.length})` },
              ...(aprovacaoThread.length > 0 || (vaga.status as string) === 'PENDENTE_APROVACAO' || (vaga.status as string) === 'REJEITADA'
                ? [{ key: 'aprovacao' as const, label: `Aprovação${aprovacaoThread.length > 0 ? ` (${aprovacaoThread.length})` : ''}` }]
                : []),
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'candidatos' && (
            <Card>
              <CardHeader>
                <CardTitle>Candidatos</CardTitle>
                {canEdit && (
                  <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openNewCand}>
                    Adicionar Candidato
                  </Button>
                )}
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y border-gray-100">
                    <tr>
                      {['Nome', 'Contato', 'Status', 'Aprovação', 'CV', 'Observações', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {candidatos.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nenhum candidato registrado</td></tr>
                    )}
                    {candidatos.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: CANDIDATO_STATUS_COLORS[c.status] }}>
                              {c.nome.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-900">{c.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {c.telefone && <p className="text-xs text-gray-600 flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefone}</p>}
                            {c.email && <p className="text-xs text-gray-600 flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: CANDIDATO_STATUS_COLORS[c.status] + '18', color: CANDIDATO_STATUS_COLORS[c.status] }}>
                            {CANDIDATO_STATUS_LABELS[c.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {c.dataAprovacao ? formatDate(c.dataAprovacao) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {c.cvFileName ? (
                            <a
                              href={`/uploads/cvs/${c.cvFileName}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs font-medium text-[#15AFA4] hover:text-[#0d8c83] transition-colors group"
                              title={c.cvOriginalName ?? 'Baixar CV'}
                            >
                              <div className="w-6 h-6 rounded-md bg-[#15AFA4]/10 flex items-center justify-center group-hover:bg-[#15AFA4]/20 transition-colors">
                                <FileText className="w-3.5 h-3.5 text-[#15AFA4]" />
                              </div>
                              <span className="truncate max-w-[80px]">
                                {c.cvOriginalName ?? 'CV'}
                              </span>
                              <Download className="w-3 h-3 flex-shrink-0 opacity-60" />
                            </a>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{c.observacoes ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {['APROVADO', 'AGUARDANDO_ADMISSAO', 'ADMITIDO'].includes(c.status) && (
                              <button
                                onClick={() => router.push(`/vagas/${params.id}/candidatos/${c.id}/documentos`)}
                                title="Documentos de contratação"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-[#15AFA4] hover:bg-[#15AFA4]/10 transition-colors">
                                <FileCheck2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canEdit && (
                              <>
                                <button onClick={() => openEditCand(c)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteCandidato(c.id, c.nome)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'acompanhamento' && (
            <div className="space-y-4">
              {/* Formulário de novo acompanhamento */}
              {canEdit && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-gray-400" />
                      Registrar Acompanhamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                      Dados atualizados em: <strong>{new Date().toLocaleDateString('pt-BR')}</strong>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Decisão</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: 'ACOMPANHAR', label: 'Acompanhar por mais uma semana', color: 'border-amber-300 bg-amber-50 text-amber-700' },
                          { value: 'CONCLUIDA',  label: 'Vaga concluída / Colaborador contratado', color: 'border-green-300 bg-green-50 text-green-700' },
                        ].map((op) => (
                          <button key={op.value} type="button"
                            onClick={() => setAcForm((p) => ({ ...p, decisao: op.value }))}
                            className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                              acForm.decisao === op.value ? op.color : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                            }`}>
                            {op.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Textarea
                      label="Notas do acompanhamento"
                      value={acForm.notas}
                      onChange={(e) => setAcForm((p) => ({ ...p, notas: e.target.value }))}
                      rows={3}
                      placeholder="Ex: Candidato em entrevista final, aguardando retorno do gestor..."
                    />

                    <div className="flex justify-end">
                      <Button isLoading={isSavingAc} onClick={saveAcompanhamento}
                        icon={<ClipboardCheck className="w-4 h-4" />}>
                        Salvar Acompanhamento
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Histórico de acompanhamentos */}
              <Card>
                <CardHeader><CardTitle>Histórico de Acompanhamentos</CardTitle></CardHeader>
                <div className="p-5">
                  {acompanhamentos.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Nenhum acompanhamento registrado ainda</p>
                  ) : (
                    <div className="space-y-3">
                      {acompanhamentos.map((ac) => (
                        <div key={ac.id} className={`p-4 rounded-xl border ${
                          ac.decisao === 'CONCLUIDA'
                            ? 'bg-green-50 border-green-100'
                            : 'bg-amber-50 border-amber-100'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                ac.decisao === 'CONCLUIDA'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {ac.decisao === 'CONCLUIDA' ? 'Vaga Concluída' : 'Acompanhar Semana Seguinte'}
                              </span>
                              <span className="text-xs text-gray-500">{ac.user?.name}</span>
                            </div>
                            <span className="text-xs text-gray-400">
                              {new Date(ac.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          </div>
                          {ac.notas && <p className="text-sm text-gray-700 mt-1">{ac.notas}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'historico' && (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Histórico de Movimentações</CardTitle></CardHeader>
                <div className="p-5">
                  {historico.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Nenhum registro no histórico</p>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />
                      <div className="space-y-4">
                        {historico.map((h) => (
                          <div key={h.id} className="flex gap-4 pl-10 relative">
                            <div className="absolute left-2.5 w-3 h-3 rounded-full border-2 border-white shadow"
                              style={{ background: h.toStatus ? VAGA_STATUS_COLORS[h.toStatus] : '#15AFA4', top: '4px' }} />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">{h.descricao}</p>
                              {h.fromStatus && h.toStatus && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-xs px-2 py-0.5 rounded-full"
                                    style={{ background: VAGA_STATUS_COLORS[h.fromStatus] + '18', color: VAGA_STATUS_COLORS[h.fromStatus] }}>
                                    {VAGA_STATUS_LABELS[h.fromStatus]}
                                  </span>
                                  <span className="text-gray-400 text-xs">→</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full"
                                    style={{ background: VAGA_STATUS_COLORS[h.toStatus] + '18', color: VAGA_STATUS_COLORS[h.toStatus] }}>
                                    {VAGA_STATUS_LABELS[h.toStatus]}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-400">{h.user?.name ?? 'Sistema'}</span>
                                <span className="text-gray-300">·</span>
                                <span className="text-xs text-gray-400">{formatDatetime(h.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader><CardTitle>Alterações de Cadastro</CardTitle></CardHeader>
                <div className="p-5">
                  <AuditTrail entity="Vaga" entityId={vaga.id} />
                </div>
              </Card>
            </div>
          )}

          {/* Aba Aprovação */}
          {activeTab === 'aprovacao' && (
            <Card>
              <CardHeader>
                <CardTitle>Thread de Aprovação</CardTitle>
              </CardHeader>
              <div className="p-5">
                {aprovacaoThread.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Nenhuma mensagem ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {aprovacaoThread.map((c) => {
                      const COLORS: Record<string, string[]> = {
                        APROVACAO:        ['bg-green-50 border-green-100', 'text-green-700'],
                        REJEICAO:         ['bg-red-50 border-red-100',     'text-red-700'],
                        SOLICITACAO_INFO: ['bg-amber-50 border-amber-100', 'text-amber-700'],
                        RESPOSTA:         ['bg-blue-50 border-blue-100',   'text-blue-700'],
                      }
                      const [box, text] = COLORS[c.tipo] ?? ['bg-gray-50 border-gray-100', 'text-gray-700']
                      return (
                        <div key={c.id} className={`px-4 py-3 rounded-xl border ${box}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-bold ${text}`}>
                              {c.user.name} · {APROVACAO_TIPO_LABELS[c.tipo]}
                            </span>
                            <span className="text-xs text-gray-400">{formatDatetime(c.createdAt)}</span>
                          </div>
                          <p className={`text-sm ${text}`}>{c.mensagem}</p>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Resposta (analista ou admin) */}
                {canEdit && ((vaga.status as string) === 'PENDENTE_APROVACAO' || aprovacaoThread.some(c => c.tipo === 'SOLICITACAO_INFO')) && (
                  <div className="mt-4 flex gap-2">
                    <textarea
                      value={aprovacaoReply}
                      onChange={(e) => setAprovacaoReply(e.target.value)}
                      placeholder="Digite uma resposta..."
                      rows={2}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20 resize-none"
                    />
                    <Button
                      onClick={sendAprovacaoReply}
                      isLoading={isSendingAprovacao}
                      disabled={!aprovacaoReply.trim()}
                      icon={<Send className="w-4 h-4" />}
                    >
                      Enviar
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modal editar vaga */}
      {canEdit && (
        <VagaModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={load}
          vaga={vaga}
          units={units}
          users={users}
          isAdmin={isAdmin}
          analystUnitIds={analystUnitIds}
        />
      )}

      {/* Modal candidato */}
      <Modal
        open={canEdit && candModalOpen}
        onClose={() => { setCandModalOpen(false); setEditCand(null); setCandSearchPhase(false) }}
        title={editCand ? `Editar — ${editCand.nome}` : 'Adicionar Candidato'}
        size="md"
      >

        {/* FASE 1 — busca no Controle de Candidatos */}
        {!editCand && candSearchPhase && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-500">Busque um candidato já cadastrado no Controle de Candidatos para pré-preencher os dados.</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                value={candSearchQuery}
                onChange={(e) => setCandSearchQuery(e.target.value)}
                placeholder="Digite o nome do candidato..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
              />
            </div>

            <div className="min-h-[80px] max-h-64 overflow-y-auto space-y-1">
              {isSearchingCands && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[#15AFA4]" />
                </div>
              )}
              {!isSearchingCands && candSearchQuery.length >= 2 && candSearchResults.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">Nenhum candidato encontrado</p>
              )}
              {candSearchResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectControleCandidato(c)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#15AFA4]/5 text-left transition-colors border border-transparent hover:border-[#15AFA4]/20"
                >
                  <div className="w-8 h-8 rounded-full bg-[#15AFA4]/10 flex items-center justify-center text-[#15AFA4] text-sm font-bold flex-shrink-0">
                    {c.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{c.nome}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {c.funcao}{c.telefone ? ` · ${c.telefone}` : ''}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: CONTROLE_CANDIDATO_STATUS_COLORS[c.status as keyof typeof CONTROLE_CANDIDATO_STATUS_COLORS] + '18',
                      color: CONTROLE_CANDIDATO_STATUS_COLORS[c.status as keyof typeof CONTROLE_CANDIDATO_STATUS_COLORS],
                    }}>
                    {CONTROLE_CANDIDATO_STATUS_LABELS[c.status as keyof typeof CONTROLE_CANDIDATO_STATUS_LABELS]}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-gray-100" />
              <span className="text-xs text-gray-400">ou</span>
              <div className="flex-1 border-t border-gray-100" />
            </div>

            <Button
              variant="outline"
              className="w-full"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setCandSearchPhase(false)}
            >
              Cadastrar candidato novo
            </Button>
          </div>
        )}

        {/* FASE 2 — formulário */}
        {(editCand || !candSearchPhase) && (
        <div className="p-6 space-y-4">
          <Input label="Nome *" value={candForm.nome} onChange={(e) => setCandForm({ ...candForm, nome: e.target.value })} placeholder="Nome completo" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Telefone" value={candForm.telefone} onChange={(e) => setCandForm({ ...candForm, telefone: e.target.value })} placeholder="(11) 99999-9999" />
            <Input label="E-mail" type="email" value={candForm.email} onChange={(e) => setCandForm({ ...candForm, email: e.target.value })} placeholder="candidato@email.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={candForm.status} onChange={(e) => setCandForm({ ...candForm, status: e.target.value })} options={candidatoStatusOptions} />
            <Input label="Data de Aprovação" type="date" value={candForm.dataAprovacao} onChange={(e) => setCandForm({ ...candForm, dataAprovacao: e.target.value })} />
          </div>
          <Textarea label="Observações" value={candForm.observacoes} onChange={(e) => setCandForm({ ...candForm, observacoes: e.target.value })} rows={2} placeholder="Observações sobre o candidato..." />

          {/* Upload de CV */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Currículo (CV)</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setCvDragOver(true) }}
              onDragLeave={() => setCvDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setCvDragOver(false)
                const file = e.dataTransfer.files[0]
                if (file) handleCvSelect(file)
              }}
              className={`relative border-2 border-dashed rounded-xl transition-all ${
                cvDragOver
                  ? 'border-[#15AFA4] bg-[#15AFA4]/5'
                  : cvFile || candForm.cvFileName
                  ? 'border-[#15AFA4]/40 bg-[#15AFA4]/5'
                  : 'border-gray-200 bg-gray-50 hover:border-[#15AFA4]/40 hover:bg-[#15AFA4]/5'
              }`}
            >
              {/* Arquivo selecionado ou já salvo */}
              {(cvFile || candForm.cvFileName) ? (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-lg bg-[#15AFA4]/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-[#15AFA4]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {cvFile ? cvFile.name : (candForm.cvOriginalName || candForm.cvFileName)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {cvFile
                        ? `${(cvFile.size / 1024 / 1024).toFixed(2)} MB · Novo arquivo`
                        : 'Arquivo atual — envie outro para substituir'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {candForm.cvFileName && !cvFile && (
                      <a
                        href={`/uploads/cvs/${candForm.cvFileName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-[#15AFA4] hover:bg-[#15AFA4]/10 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        title="Baixar CV atual"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => { setCvFile(null); setCandForm((f: any) => ({ ...f, cvFileName: '', cvOriginalName: '' })) }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remover CV"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 px-4 py-5 cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">
                      Clique para enviar ou arraste o arquivo
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX · Máximo 10 MB</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCvSelect(f) }}
                  />
                </label>
              )}

              {/* Loading do upload */}
              {isUploadingCv && (
                <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#15AFA4]" />
                  <span className="ml-2 text-sm text-[#15AFA4] font-medium">Enviando...</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setCandModalOpen(false); setCvFile(null) }}>Cancelar</Button>
            <Button className="flex-1" isLoading={isSavingCand || isUploadingCv} onClick={saveCandidato} disabled={!candForm.nome.trim()}>
              {editCand ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </div>
        )}
      </Modal>
    </>
  )
}
