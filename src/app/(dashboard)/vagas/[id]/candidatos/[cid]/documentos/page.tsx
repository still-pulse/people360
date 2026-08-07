'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { AuditTrail } from '@/components/audit/AuditTrail'
import { formatDatetime } from '@/lib/utils'
import {
  ArrowLeft, Link2, Copy, Check, RefreshCw, Link2Off,
  Eye, CheckCircle2, XCircle, Clock, Send,
} from 'lucide-react'

interface DocumentoTipo { id: string; nome: string }
interface DocumentoArquivo { id: string; nomeOriginal: string; tamanho: number; tipo: string; createdAt: string }
interface DocumentoLinkItem {
  id: string
  status: 'PENDENTE' | 'ENVIADO' | 'APROVADO' | 'REJEITADO'
  motivoRejeicao: string | null
  tipo: DocumentoTipo
  arquivos: DocumentoArquivo[]
}
interface DocumentoLink {
  id: string
  token: string
  status: 'ATIVO' | 'EXPIRADO' | 'CONCLUIDO' | 'REVOGADO'
  expiresAt: string
  exigeConselho: boolean
  temDependentes: boolean
  militarAplicavel: boolean
  createdBy: { name: string }
  createdAt: string
  itens: DocumentoLinkItem[]
}

const LINK_STATUS_META: Record<DocumentoLink['status'], { label: string; color: string }> = {
  ATIVO:     { label: 'Ativo',     color: '#15AFA4' },
  EXPIRADO:  { label: 'Expirado',  color: '#F59E0B' },
  CONCLUIDO: { label: 'Concluído', color: '#10B981' },
  REVOGADO:  { label: 'Revogado',  color: '#EF4444' },
}

const ITEM_STATUS_META: Record<DocumentoLinkItem['status'], { label: string; color: string; icon: React.ElementType }> = {
  PENDENTE:  { label: 'Pendente',            color: '#9CA3AF', icon: Clock },
  ENVIADO:   { label: 'Aguardando análise',  color: '#3B82F6', icon: Send },
  APROVADO:  { label: 'Aprovado',            color: '#10B981', icon: CheckCircle2 },
  REJEITADO: { label: 'Rejeitado',           color: '#EF4444', icon: XCircle },
}

export default function CandidatoDocumentosPage() {
  const params = useParams()
  const router = useRouter()
  const vagaId = params.id as string
  const candidatoId = params.cid as string

  const [candidatoNome, setCandidatoNome] = useState<string>('')
  const [cargo, setCargo] = useState<string>('')
  const [link, setLink] = useState<DocumentoLink | null | undefined>(undefined)
  const [copied, setCopied] = useState(false)

  const [genOpen, setGenOpen] = useState(false)
  const [genForm, setGenForm] = useState({ expiraEmDias: 15, exigeConselho: false, temDependentes: false, militarAplicavel: false })
  const [isGenerating, setIsGenerating] = useState(false)

  const [isActing, setIsActing] = useState(false)
  const [rejectItemId, setRejectItemId] = useState<string | null>(null)
  const [rejectMotivo, setRejectMotivo] = useState('')

  const load = useCallback(async () => {
    const [vagaRes, linkRes] = await Promise.all([
      fetch(`/api/vagas/${vagaId}`),
      fetch(`/api/vagas/${vagaId}/candidatos/${candidatoId}/documento-link`),
    ])
    if (vagaRes.ok) {
      const vaga = await vagaRes.json()
      setCargo(vaga.cargo)
      const cand = (vaga.candidatos ?? []).find((c: { id: string; nome: string }) => c.id === candidatoId)
      if (cand) setCandidatoNome(cand.nome)
    }
    if (linkRes.ok) setLink(await linkRes.json())
    else setLink(null)
  }, [vagaId, candidatoId])

  useEffect(() => { load() }, [load])

  async function gerarLink() {
    setIsGenerating(true)
    const res = await fetch(`/api/vagas/${vagaId}/candidatos/${candidatoId}/documento-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genForm),
    })
    setIsGenerating(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Erro ao gerar link.'); return }
    setGenOpen(false)
    load()
  }

  async function renovarLink() {
    setIsActing(true)
    const res = await fetch(`/api/vagas/${vagaId}/candidatos/${candidatoId}/documento-link`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'RENOVAR', expiraEmDias: 15 }),
    })
    setIsActing(false)
    if (!res.ok) { alert('Erro ao renovar link.'); return }
    load()
  }

  async function revogarLink() {
    if (!confirm('Revogar este link? O candidato não conseguirá mais enviar documentos por ele.')) return
    setIsActing(true)
    const res = await fetch(`/api/vagas/${vagaId}/candidatos/${candidatoId}/documento-link`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'REVOGAR' }),
    })
    setIsActing(false)
    if (!res.ok) { alert('Erro ao revogar link.'); return }
    load()
  }

  async function revisarItem(itemId: string, acao: 'APROVAR' | 'REJEITAR', motivo?: string) {
    setIsActing(true)
    const res = await fetch(`/api/documentos-candidato/itens/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao, motivo }),
    })
    setIsActing(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Erro ao revisar documento.'); return }
    setRejectItemId(null)
    setRejectMotivo('')
    load()
  }

  function copyLink() {
    if (!link) return
    const url = `${window.location.origin}/documentos/${link.token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLoading = link === undefined

  return (
    <>
      <Header title="Documentos de Contratação" subtitle={candidatoNome ? `${candidatoNome} · ${cargo}` : undefined} />
      <div className="p-6 space-y-5 max-w-4xl">
        <button onClick={() => router.push(`/vagas/${vagaId}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar para a vaga
        </button>

        {isLoading && (
          <div className="h-40 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        )}

        {!isLoading && !link && (
          <Card>
            <div className="p-8 text-center space-y-3">
              <Link2 className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-sm text-gray-500">Nenhum link de documentos gerado para este candidato ainda.</p>
              <Button onClick={() => setGenOpen(true)} icon={<Link2 className="w-4 h-4" />}>
                Gerar link de documentos
              </Button>
            </div>
          </Card>
        )}

        {!isLoading && link && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Link do candidato</CardTitle>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: LINK_STATUS_META[link.status].color + '18', color: LINK_STATUS_META[link.status].color }}>
                  {LINK_STATUS_META[link.status].label}
                </span>
              </CardHeader>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/documentos/${link.token}`} className="font-mono text-xs" />
                  <Button variant="outline" size="md" onClick={copyLink} icon={copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}>
                    {copied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-500">
                  <p>Criado por <span className="font-medium text-gray-700">{link.createdBy?.name}</span></p>
                  <p>Em <span className="font-medium text-gray-700">{formatDatetime(link.createdAt)}</span></p>
                  <p>Expira em <span className="font-medium text-gray-700">{formatDatetime(link.expiresAt)}</span></p>
                </div>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {link.status === 'ATIVO' ? (
                    <Button variant="danger" size="sm" icon={<Link2Off className="w-3.5 h-3.5" />} isLoading={isActing} onClick={revogarLink}>
                      Revogar
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} isLoading={isActing} onClick={renovarLink}>
                      Renovar (reativar este link)
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" icon={<Link2 className="w-3.5 h-3.5" />} onClick={() => setGenOpen(true)}>
                    Gerar novo link
                  </Button>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Checklist de documentos ({link.itens.filter((i) => i.status === 'APROVADO').length}/{link.itens.length} aprovados)</CardTitle>
              </CardHeader>
              <div className="divide-y divide-gray-50">
                {link.itens.map((item) => {
                  const meta = ITEM_STATUS_META[item.status]
                  const Icon = meta.icon
                  const arquivo = item.arquivos[0]
                  return (
                    <div key={item.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold"
                            style={{ background: meta.color + '18', color: meta.color }}>
                            <Icon className="w-3 h-3" /> {meta.label}
                          </span>
                          <span className="text-sm font-medium text-gray-800">{item.tipo.nome}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {arquivo && (
                            <a href={`/api/admin/documentos-candidato/arquivo/${arquivo.id}`} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs font-medium text-[#15AFA4] hover:text-[#0d8c83]">
                              <Eye className="w-3.5 h-3.5" /> {arquivo.nomeOriginal}
                            </a>
                          )}
                          {item.status === 'ENVIADO' && (
                            <>
                              <Button size="sm" variant="outline" isLoading={isActing}
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => revisarItem(item.id, 'APROVAR')}>
                                Aprovar
                              </Button>
                              <Button size="sm" variant="outline" isLoading={isActing}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setRejectItemId(item.id)}>
                                Rejeitar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {item.status === 'REJEITADO' && item.motivoRejeicao && (
                        <p className="text-xs text-red-500 pl-1">Motivo: {item.motivoRejeicao}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card>
              <CardHeader><CardTitle>Auditoria</CardTitle></CardHeader>
              <div className="p-5">
                <AuditTrail entity="CandidatoDocumento" entityId={candidatoId} />
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Modal: gerar link */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Gerar link de documentos">
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Marque abaixo os itens que se aplicam a este candidato. Isso define quais documentos condicionais aparecerão no checklist dele.
          </p>
          <Input
            label="Validade do link (dias)"
            type="number"
            min={1}
            value={genForm.expiraEmDias}
            onChange={(e) => setGenForm({ ...genForm, expiraEmDias: Number(e.target.value) })}
          />
          <div className="space-y-2">
            {[
              { key: 'exigeConselho' as const, label: 'Exige registro em conselho de classe (ex: COREN) — carteirinha e certidão ética' },
              { key: 'temDependentes' as const, label: 'Candidato tem dependentes/filhos' },
              { key: 'militarAplicavel' as const, label: 'Homem maior de 18 anos — exigir certificado militar' },
            ].map((opt) => (
              <label key={opt.key} className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#15AFA4] focus:ring-[#15AFA4]/30"
                  checked={genForm[opt.key]}
                  onChange={(e) => setGenForm({ ...genForm, [opt.key]: e.target.checked })}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancelar</Button>
            <Button onClick={gerarLink} isLoading={isGenerating} icon={<Link2 className="w-4 h-4" />}>Gerar link</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: rejeitar item */}
      <Modal open={!!rejectItemId} onClose={() => setRejectItemId(null)} title="Rejeitar documento" size="sm">
        <div className="p-5 space-y-4">
          <label className="text-sm font-medium text-gray-700">Motivo da rejeição</label>
          <textarea
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20 resize-none"
            rows={3}
            value={rejectMotivo}
            onChange={(e) => setRejectMotivo(e.target.value)}
            placeholder="Ex: foto ilegível, documento vencido..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectItemId(null)}>Cancelar</Button>
            <Button
              style={{ background: '#EF4444' }}
              isLoading={isActing}
              disabled={!rejectMotivo.trim()}
              onClick={() => rejectItemId && revisarItem(rejectItemId, 'REJEITAR', rejectMotivo)}
            >
              Rejeitar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
