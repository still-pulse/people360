'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import {
  Plus, Search, RefreshCw, FileSpreadsheet, FileText, Link2, Mail,
  Copy, Check, Eye, Ban, Trash2, Loader2, ClipboardList, Brain,
} from 'lucide-react'
import {
  BIG_FIVE_LABELS,
  BIG_FIVE_COLORS,
  BIG_FIVE_INTERP,
  type BigFiveFactor,
} from '@/lib/testes/bigfive'
import {
  DISC_LABELS,
  DISC_COLORS,
  DISC_LAUDOS,
  DISC_TRAITS,
  type DiscLetter,
  type DiscProfileKey,
} from '@/lib/testes/disc'
import { formatDate } from '@/lib/utils'

type TipoTeste = 'BIG_FIVE' | 'DISC'
type Status = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'EXPIRADO' | 'REVOGADO'

interface TesteConvite {
  id: string
  token: string
  tipo: TipoTeste
  status: Status
  nome: string
  email: string | null
  cargo: string | null
  telefone: string | null
  expiresAt: string
  enviadoAt: string | null
  iniciadoAt: string | null
  concluidoAt: string | null
  createdAt: string
  linkUrl?: string
  createdBy?: { id: string; name: string }
  controleCandidato?: { id: string; nome: string; funcao: string; status: string } | null
  resultado?: {
    id: string
    scores: any
    perfilPredominante: string | null
    completedAt: string
    answers?: any
  } | null
}

interface CandidatoOpt {
  id: string
  nome: string
  funcao: string
  telefone: string | null
  status: string
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  PENDENTE: { label: 'Pendente', color: '#9CA3AF' },
  EM_ANDAMENTO: { label: 'Em andamento', color: '#3B82F6' },
  CONCLUIDO: { label: 'Concluído', color: '#10B981' },
  EXPIRADO: { label: 'Expirado', color: '#F59E0B' },
  REVOGADO: { label: 'Revogado', color: '#EF4444' },
}

const TIPO_LABEL: Record<TipoTeste, string> = {
  BIG_FIVE: 'Big Five',
  DISC: 'DISC',
}

export default function TestesPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const canCreate = session?.user?.role === 'ADMIN' || session?.user?.role === 'ANALYST'

  const [list, setList] = useState<TesteConvite[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [detail, setDetail] = useState<TesteConvite | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // form
  const [formTipo, setFormTipo] = useState<TipoTeste>('BIG_FIVE')
  const [origem, setOrigem] = useState<'candidato' | 'manual'>('manual')
  const [candidatos, setCandidatos] = useState<CandidatoOpt[]>([])
  const [candSearch, setCandSearch] = useState('')
  const [selectedCandId, setSelectedCandId] = useState('')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [telefone, setTelefone] = useState('')
  const [expiraDias, setExpiraDias] = useState(15)
  const [enviarEmail, setEnviarEmail] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [createdLink, setCreatedLink] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterTipo) params.set('tipo', filterTipo)
    if (filterStatus) params.set('status', filterStatus)
    if (search.trim()) params.set('search', search.trim())
    const res = await fetch(`/api/testes?${params}`)
    const data = await res.json()
    setList(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterTipo, filterStatus, search])

  useEffect(() => {
    load()
  }, [filterTipo, filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!modalOpen || origem !== 'candidato') return
    fetch('/api/candidatos-controle')
      .then((r) => r.json())
      .then((d) => setCandidatos(Array.isArray(d) ? d : []))
      .catch(() => setCandidatos([]))
  }, [modalOpen, origem])

  const filteredCands = useMemo(() => {
    if (!candSearch.trim()) return candidatos.slice(0, 30)
    const q = candSearch.toLowerCase()
    return candidatos.filter((c) => c.nome.toLowerCase().includes(q) || c.funcao.toLowerCase().includes(q)).slice(0, 30)
  }, [candidatos, candSearch])

  function openCreate() {
    setFormTipo('BIG_FIVE')
    setOrigem('manual')
    setSelectedCandId('')
    setNome('')
    setEmail('')
    setCargo('')
    setTelefone('')
    setExpiraDias(15)
    setEnviarEmail(true)
    setFormError('')
    setCreatedLink(null)
    setModalOpen(true)
  }

  function selectCandidato(c: CandidatoOpt) {
    setSelectedCandId(c.id)
    setNome(c.nome)
    setCargo(c.funcao)
    setTelefone(c.telefone || '')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const res = await fetch('/api/testes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: formTipo,
          nome,
          email: email || null,
          cargo: cargo || null,
          telefone: telefone || null,
          controleCandidatoId: origem === 'candidato' ? selectedCandId || null : null,
          expiraEmDias: expiraDias,
          enviarEmail: enviarEmail && !!email,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Erro ao criar convite')
        setSaving(false)
        return
      }
      setCreatedLink(data.linkUrl)
      load()
    } catch {
      setFormError('Falha de conexão')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true)
    setDetail(null)
    setCopied(false)
    try {
      const res = await fetch(`/api/testes/${id}`)
      const data = await res.json()
      if (res.ok) setDetail(data)
    } finally {
      setDetailLoading(false)
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function reenviarEmail(id: string) {
    const res = await fetch(`/api/testes/${id}/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Erro ao enviar e-mail')
      return
    }
    if (!data.ok) {
      alert(data.error || 'SMTP não configurado ou falha no envio. Use o link copiado.')
      return
    }
    alert('E-mail reenviado com sucesso.')
    load()
  }

  async function revogar(id: string) {
    if (!confirm('Revogar este convite? O link deixará de funcionar.')) return
    const res = await fetch(`/api/testes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke' }),
    })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || 'Erro')
      return
    }
    setDetail(null)
    load()
  }

  async function excluir(id: string, nomePessoa: string) {
    if (!confirm(`Excluir definitivamente o convite/resultado de "${nomePessoa}"?`)) return
    const res = await fetch(`/api/testes/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || 'Erro')
      return
    }
    setDetail(null)
    load()
  }

  async function exportExcel() {
    if (!isAdmin) return
    const params = new URLSearchParams()
    if (filterTipo) params.set('tipo', filterTipo)
    const res = await fetch(`/api/testes/export?${params}`)
    const rows = await res.json()
    if (!Array.isArray(rows)) {
      alert('Erro ao exportar')
      return
    }
    const XLSX = await import('@/lib/xlsxSafe')
    const flat = rows.map((r: any) => {
      const base: Record<string, unknown> = {
        Tipo: TIPO_LABEL[r.tipo as TipoTeste] || r.tipo,
        Nome: r.nome,
        EMail: r.email || '',
        Cargo: r.cargo || '',
        Telefone: r.telefone || '',
        Perfil: r.perfil || '',
        Concluído: r.concluidoAt ? new Date(r.concluidoAt).toLocaleString('pt-BR') : '',
        CriadoPor: r.criadoPor || '',
      }
      if (r.tipo === 'BIG_FIVE') {
        base['E %'] = r.E_pct
        base['A %'] = r.A_pct
        base['C %'] = r.C_pct
        base['N %'] = r.N_pct
        base['O %'] = r.O_pct
      } else if (r.tipo === 'DISC') {
        base.D = r.D
        base.I = r.I
        base.S = r.S
        base['C (DISC)'] = r.C
        base['D %'] = r.D_pct
        base['I %'] = r.I_pct
        base['S %'] = r.S_pct
        base['C %'] = r.C_pct
      }
      return base
    })
    const ws = XLSX.utils.json_to_sheet(flat)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados')
    XLSX.writeFile(wb, `testes_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function exportPDF(item: TesteConvite) {
    if (!isAdmin || !item.resultado?.scores) return
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()
    const tipoLabel = TIPO_LABEL[item.tipo]
    const brand = [0, 168, 168] as [number, number, number]

    doc.setFillColor(...brand)
    doc.rect(0, 0, 210, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(`Relatório ${tipoLabel} — BHCL`, 14, 12)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Gestão de Pessoas · Beneficência Hospitalar de Cesário Lange', 14, 20)

    doc.setTextColor(30, 41, 59)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(item.nome, 14, 40)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(
      [
        item.cargo || '—',
        item.concluidoAt ? `Concluído em ${new Date(item.concluidoAt).toLocaleString('pt-BR')}` : '',
        item.resultado.perfilPredominante ? `Perfil: ${item.resultado.perfilPredominante}` : '',
      ]
        .filter(Boolean)
        .join('  ·  '),
      14,
      47
    )

    if (item.tipo === 'BIG_FIVE') {
      const factors = item.resultado.scores.factors as Record<
        BigFiveFactor,
        { pct: number; raw: number; max: number; level: string }
      >
      const rows = (['E', 'A', 'C', 'N', 'O'] as BigFiveFactor[]).map((f) => [
        BIG_FIVE_LABELS[f],
        `${factors[f].pct}%`,
        `${factors[f].raw}/${factors[f].max}`,
        factors[f].level,
      ])
      autoTable(doc, {
        startY: 56,
        head: [['Dimensão', '%', 'Pontos', 'Faixa']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: brand },
      })
      let y = (doc as any).lastAutoTable.finalY + 10
      for (const f of ['E', 'A', 'C', 'N', 'O'] as BigFiveFactor[]) {
        const level = factors[f].level as 'alta' | 'moderada' | 'baixa'
        const interp = BIG_FIVE_INTERP[f][level]
        if (y > 250) {
          doc.addPage()
          y = 20
        }
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 118, 110)
        doc.setFontSize(11)
        doc.text(`${BIG_FIVE_LABELS[f]} (${factors[f].pct}% — ${level})`, 14, y)
        y += 6
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 65, 85)
        doc.setFontSize(9)
        const lines = doc.splitTextToSize(interp.texto, 180)
        doc.text(lines, 14, y)
        y += lines.length * 4.5 + 2
        const forcas = doc.splitTextToSize(`Forças: ${interp.forcas}`, 180)
        doc.text(forcas, 14, y)
        y += forcas.length * 4.5 + 2
        const atencao = doc.splitTextToSize(`Atenção: ${interp.atencao}`, 180)
        doc.text(atencao, 14, y)
        y += atencao.length * 4.5 + 8
      }
    } else {
      const s = item.resultado.scores
      const scores = s.scores as Record<DiscLetter, number>
      const pcts = s.pcts as Record<DiscLetter, number>
      const rows = (['D', 'I', 'S', 'C'] as DiscLetter[]).map((l) => [
        DISC_LABELS[l],
        String(scores[l]),
        `${(pcts[l] * 100).toFixed(1)}%`,
      ])
      autoTable(doc, {
        startY: 56,
        head: [['Fator', 'Pontos', '%']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: brand },
      })
      let y = (doc as any).lastAutoTable.finalY + 12
      const principal = (s.perfilPrincipal || item.resultado.perfilPredominante) as DiscProfileKey
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(15, 118, 110)
      doc.text(`Perfil: ${s.perfil || principal}`, 14, y)
      y += 8
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(51, 65, 85)
      const laudo = DISC_LAUDOS[principal]
      if (laudo) {
        const lines = doc.splitTextToSize(laudo, 180)
        doc.text(lines, 14, y)
        y += lines.length * 4.5 + 10
      }
      const traits = DISC_TRAITS[principal]
      if (traits) {
        if (y > 240) {
          doc.addPage()
          y = 20
        }
        doc.setFont('helvetica', 'bold')
        doc.text('Características', 14, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.text(doc.splitTextToSize(traits.caracteristicas.join(', '), 180), 14, y)
        y += 12
        doc.setFont('helvetica', 'bold')
        doc.text('Não gosta de', 14, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.text(doc.splitTextToSize(traits.naoGosta.join(', '), 180), 14, y)
        y += 12
        doc.setFont('helvetica', 'bold')
        doc.text('Principais necessidades', 14, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.text(doc.splitTextToSize(traits.necessidades.join(', '), 180), 14, y)
      }
    }

    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(
      'Ferramenta de apoio ao RH. Não substitui avaliação psicológica profissional.',
      14,
      285
    )
    doc.save(`teste_${item.tipo.toLowerCase()}_${item.nome.replace(/\s+/g, '_')}.pdf`)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.cargo ?? '').toLowerCase().includes(q)
    )
  }, [list, search])

  const kpis = useMemo(() => {
    const total = list.length
    const concluidos = list.filter((c) => c.status === 'CONCLUIDO').length
    const pendentes = list.filter((c) => c.status === 'PENDENTE' || c.status === 'EM_ANDAMENTO').length
    const big = list.filter((c) => c.tipo === 'BIG_FIVE').length
    const disc = list.filter((c) => c.tipo === 'DISC').length
    return { total, concluidos, pendentes, big, disc }
  }, [list])

  return (
    <>
      <Header
        title="Testes"
        subtitle="Big Five e DISC — convites personalizados e resultados confidenciais"
      />
      <div className="p-6 flex flex-col gap-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: kpis.total, color: 'text-gray-800' },
            { label: 'Concluídos', value: kpis.concluidos, color: 'text-emerald-600' },
            { label: 'Em aberto', value: kpis.pendentes, color: 'text-blue-600' },
            { label: 'Big Five', value: kpis.big, color: 'text-teal-600' },
            { label: 'DISC', value: kpis.disc, color: 'text-amber-600' },
          ].map((k) => (
            <Card key={k.label} className="p-3">
              <p className="text-xs text-gray-500 font-medium">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2 items-center flex-1">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                placeholder="Buscar nome, e-mail, cargo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
              />
            </div>
            <select
              className="text-sm border border-gray-200 rounded-xl px-3 py-2"
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              <option value="BIG_FIVE">Big Five</option>
              <option value="DISC">DISC</option>
            </select>
            <select
              className="text-sm border border-gray-200 rounded-xl px-3 py-2"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
              </Button>
            )}
            {canCreate && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4" /> Novo convite
              </Button>
            )}
          </div>
        </div>

        {!isAdmin && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            Resultados detalhados (scores e relatórios) são visíveis apenas para administradores.
            Você pode criar convites e acompanhar o status de envio.
          </div>
        )}

        {/* Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-semibold">Pessoa</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Perfil</th>
                  <th className="px-4 py-3 font-semibold">Criado</th>
                  <th className="px-4 py-3 font-semibold">Validade</th>
                  <th className="px-4 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                      Carregando…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      Nenhum convite encontrado. Crie o primeiro para enviar um teste.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((c) => {
                    const st = STATUS_META[c.status]
                    return (
                      <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{c.nome}</div>
                          <div className="text-xs text-gray-500">
                            {[c.cargo, c.email].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-700">
                            {c.tipo === 'BIG_FIVE' ? <Brain className="w-3 h-3" /> : <ClipboardList className="w-3 h-3" />}
                            {TIPO_LABEL[c.tipo]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold"
                            style={{ background: st.color + '18', color: st.color }}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {isAdmin && c.resultado?.perfilPredominante
                            ? c.resultado.perfilPredominante
                            : c.status === 'CONCLUIDO'
                              ? isAdmin
                                ? '—'
                                : 'Concluído'
                              : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatDate(c.createdAt)}
                          {c.createdBy && (
                            <div className="text-[11px] text-gray-400">{c.createdBy.name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.expiresAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
                              title="Detalhes"
                              onClick={() => openDetail(c.id)}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {isAdmin && c.status === 'CONCLUIDO' && (
                              <button
                                type="button"
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                                title="PDF"
                                onClick={async () => {
                                  const res = await fetch(`/api/testes/${c.id}`)
                                  const full = await res.json()
                                  if (res.ok) exportPDF(full)
                                }}
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal criar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={createdLink ? 'Convite criado' : 'Novo convite de teste'}
        size="lg"
      >
        {createdLink ? (
          <div className="p-6 space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800">
              Convite gerado com sucesso. Envie o link abaixo para a pessoa realizar o teste.
            </div>
            <div className="flex gap-2 min-w-0">
              <input
                readOnly
                value={createdLink}
                className="min-w-0 flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50"
              />
              <Button type="button" variant="outline" onClick={() => copyLink(createdLink)} className="flex-shrink-0">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setCreatedLink(null)}>
                Criar outro
              </Button>
              <Button type="button" onClick={() => setModalOpen(false)}>Fechar</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo de teste</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['BIG_FIVE', 'DISC'] as TipoTeste[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormTipo(t)}
                      className={`py-2.5 px-3 rounded-xl text-sm font-semibold border transition ${
                        formTipo === t
                          ? 'border-teal-500 bg-teal-50 text-teal-800 ring-1 ring-teal-500/30'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {TIPO_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Origem</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrigem('manual')}
                    className={`py-2.5 px-3 rounded-xl text-sm font-semibold border transition ${
                      origem === 'manual'
                        ? 'border-teal-500 bg-teal-50 text-teal-800 ring-1 ring-teal-500/30'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Colaborador
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrigem('candidato')}
                    className={`py-2.5 px-3 rounded-xl text-sm font-semibold border transition ${
                      origem === 'candidato'
                        ? 'border-teal-500 bg-teal-50 text-teal-800 ring-1 ring-teal-500/30'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Candidato
                  </button>
                </div>
              </div>
            </div>

            {origem === 'candidato' && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Selecionar candidato
                </p>
                <input
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 mb-2 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  placeholder="Buscar no controle de candidatos…"
                  value={candSearch}
                  onChange={(e) => setCandSearch(e.target.value)}
                />
                <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
                  {filteredCands.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCandidato(c)}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-teal-50 transition-colors ${
                        selectedCandId === c.id ? 'bg-teal-50' : ''
                      }`}
                    >
                      <span className="font-medium text-gray-900">{c.nome}</span>
                      <span className="text-gray-400 text-xs ml-2">{c.funcao}</span>
                    </button>
                  ))}
                  {filteredCands.length === 0 && (
                    <p className="px-3 py-4 text-xs text-gray-400 text-center">Nenhum candidato</p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 min-w-0">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Nome *
                </label>
                <input
                  required
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Cargo / Função
                </label>
                <input
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex: Analista de RH"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Telefone
                </label>
                <input
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Validade (dias)
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  value={expiraDias}
                  onChange={(e) => setExpiraDias(Number(e.target.value) || 15)}
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enviarEmail}
                onChange={(e) => setEnviarEmail(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span>
                Enviar e-mail com o link
                <span className="block text-xs text-gray-400 mt-0.5">
                  Requer e-mail preenchido e SMTP configurado
                </span>
              </span>
            </label>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Gerar link
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal detalhe */}
      <Modal
        open={!!detail || detailLoading}
        onClose={() => setDetail(null)}
        title={detail ? `${TIPO_LABEL[detail.tipo]} — ${detail.nome}` : 'Carregando…'}
        size="xl"
      >
        {detailLoading && (
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin inline" />
          </div>
        )}
        {detail && !detailLoading && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Status</p>
                <p className="font-medium" style={{ color: STATUS_META[detail.status].color }}>
                  {STATUS_META[detail.status].label}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Cargo</p>
                <p className="font-medium truncate">{detail.cargo || '—'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">E-mail</p>
                <p className="font-medium break-all">{detail.email || '—'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Validade</p>
                <p className="font-medium">{formatDate(detail.expiresAt)}</p>
              </div>
            </div>

            {detail.linkUrl && detail.status !== 'CONCLUIDO' && detail.status !== 'REVOGADO' && (
              <div className="flex gap-2 items-center min-w-0">
                <input
                  readOnly
                  value={detail.linkUrl}
                  className="min-w-0 flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => copyLink(detail.linkUrl!)} className="flex-shrink-0">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
                {detail.email && (
                  <Button type="button" variant="outline" size="sm" onClick={() => reenviarEmail(detail.id)} className="flex-shrink-0">
                    <Mail className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}

            {isAdmin && detail.resultado?.scores && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">
                    Resultado
                    {detail.resultado.perfilPredominante && (
                      <span className="ml-2 text-teal-700">· {detail.resultado.perfilPredominante}</span>
                    )}
                  </h3>
                  <Button type="button" size="sm" variant="outline" onClick={() => exportPDF(detail)}>
                    <FileText className="w-4 h-4 text-red-500" /> PDF
                  </Button>
                </div>

                {detail.tipo === 'BIG_FIVE' && detail.resultado.scores.factors && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {(Object.keys(BIG_FIVE_LABELS) as BigFiveFactor[]).map((f) => {
                      const sc = detail.resultado!.scores.factors[f]
                      return (
                        <div
                          key={f}
                          className="rounded-xl border border-gray-100 p-3 text-center min-w-0"
                          style={{ borderTopColor: BIG_FIVE_COLORS[f], borderTopWidth: 3 }}
                        >
                          <div className="text-lg font-bold" style={{ color: BIG_FIVE_COLORS[f] }}>
                            {sc.pct}%
                          </div>
                          <div className="text-xs font-semibold text-gray-700">{BIG_FIVE_LABELS[f]}</div>
                          <div className="text-[11px] text-gray-400 capitalize">{sc.level}</div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {detail.tipo === 'DISC' && detail.resultado.scores.scores && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(Object.keys(DISC_LABELS) as DiscLetter[]).map((l) => (
                        <div
                          key={l}
                          className="rounded-xl border border-gray-100 p-3 text-center min-w-0"
                          style={{ borderTopColor: DISC_COLORS[l], borderTopWidth: 3 }}
                        >
                          <div className="text-lg font-bold" style={{ color: DISC_COLORS[l] }}>
                            {detail.resultado!.scores.scores[l]}
                          </div>
                          <div className="text-xs font-semibold text-gray-700">{DISC_LABELS[l]}</div>
                          <div className="text-[11px] text-gray-400">
                            {((detail.resultado!.scores.pcts?.[l] ?? 0) * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                    {detail.resultado.scores.perfilPrincipal && (
                      <div className="rounded-xl bg-teal-50 border border-teal-100 p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                        {DISC_LAUDOS[detail.resultado.scores.perfilPrincipal as DiscProfileKey]}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {!isAdmin && detail.status === 'CONCLUIDO' && (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">
                Resultado disponível apenas para administradores.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-gray-100">
              {detail.status !== 'CONCLUIDO' && detail.status !== 'REVOGADO' && canCreate && (
                <Button type="button" variant="outline" size="sm" onClick={() => revogar(detail.id)}>
                  <Ban className="w-4 h-4" /> Revogar
                </Button>
              )}
              {isAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => excluir(detail.id, detail.nome)}
                >
                  <Trash2 className="w-4 h-4" /> Excluir
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => setDetail(null)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
