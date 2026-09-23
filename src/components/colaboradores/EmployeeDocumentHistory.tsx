'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Eye, FolderArchive, History, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api, errorMessage, fetchPdf, saveBlob } from './dossie/api'
import { PdfPreview, type PreviewRequest } from './dossie/PdfPreview'
import { fmtDateTime, inputCls, Notice } from './dossie/parts'
import type { HistoryDocument } from '@/lib/dossie/documentHistory'

const STATUS: Record<string, string> = {
  PROCESSING: 'Em processamento', RESUBMISSION_REQUIRED: 'Reenvio solicitado', EXPIRED: 'Expirado', DELETED: 'Removido', PENDING: 'Pendente', UPLOADED: 'Enviado', UNDER_REVIEW: 'Em análise', APPROVED: 'Aprovado', REJECTED: 'Rejeitado',
  WAIVED: 'Dispensado', DRAFT: 'Rascunho', GENERATED: 'Gerado', SENT: 'Enviado', SIGNED: 'Assinado', ORIGINAL: 'Original sem assinatura',
  VOIDED: 'Cancelado', CANCELLED: 'Cancelado', RASCUNHO: 'Rascunho', GERADO: 'Gerado', AGUARDANDO_ASSINATURA: 'Aguardando assinatura',
  ASSINADO: 'Assinado', VIGENTE: 'Vigente', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado',
}

export function EmployeeDocumentHistory({ employeeId }: { employeeId: string }) {
  const [items, setItems] = useState<HistoryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<PreviewRequest>(null)
  const base = `/api/colaboradores/${encodeURIComponent(employeeId)}/documentos`

  useEffect(() => {
    let alive = true
    setLoading(true); setError(''); setItems([]); setPage(0)
    api<{ items: HistoryDocument[] }>(base)
      .then(data => { if (alive) setItems(data.items) })
      .catch(caught => { if (alive) setError(errorMessage(caught)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [base, revision])

  const filtered = useMemo(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const term = normalize(search.trim())
    return items.filter(file => normalize(`${file.title} ${file.fileName} ${file.origin} ${file.protocol || ''}`).includes(term))
  }, [items, search])

  const fileUrl = (file: HistoryDocument, inline = false) => `${base}/arquivo?documento=${encodeURIComponent(file.id)}${inline ? '&inline=1' : ''}`
  async function download(url: string) {
    setBusy(true); setError('')
    try { const { blob, fileName } = await fetchPdf(url); saveBlob(blob, fileName) }
    catch (caught) { setError(errorMessage(caught)) }
    finally { setBusy(false) }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><History className="w-4 h-4 text-[#15AFA4]" />Histórico de documentos</h2>
          <p className="text-sm text-gray-500 mt-1">Arquivos da admissão, atualizações cadastrais e dossiê, com suas versões e situação de análise.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={loading || busy} icon={<RefreshCw className="w-4 h-4" />} onClick={() => setRevision(value => value + 1)}>Atualizar lista</Button>
          <Button size="sm" isLoading={busy} disabled={loading || !items.length} icon={<FolderArchive className="w-4 h-4" />} onClick={() => download(`${base}/zip`)}>Baixar tudo em ZIP</Button>
        </div>
      </div>
      <p className="text-xs text-gray-500">O ZIP contém todos os arquivos, organizados por processo dentro de uma pasta com o nome do colaborador.</p>
      {error && <Notice tone="danger">{error}</Notice>}
      {loading ? <p className="text-sm text-gray-500">Carregando documentos…</p> : items.length === 0 ? <p className="text-sm text-gray-500">Nenhum arquivo disponível para este colaborador.</p> : <>
        <label className="block"><span className="sr-only">Buscar documento</span><input className={inputCls} placeholder="Buscar por documento, origem ou protocolo" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} /></label>
        <p className="text-xs text-gray-500">{filtered.length} de {items.length} arquivo(s)</p>
        <div className="space-y-3">
          {filtered.slice(page * 20, (page + 1) * 20).map(file => (
            <div key={file.id} className="rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row sm:flex-wrap justify-between items-start gap-3">
              <div className="min-w-0 w-full sm:w-auto sm:flex-1 sm:basis-56">
                <p className="text-sm font-semibold text-gray-900 break-words">{file.title}</p>
                <p className="text-xs text-gray-500 mt-1 break-all">{file.fileName}</p>
                <p className="text-xs text-gray-500 mt-1">{file.origin}{file.protocol ? ` · ${file.protocol}` : ''} · {fmtDateTime(file.date)}</p>
                <div className="flex flex-wrap gap-1.5 mt-2"><Badge variant="outline">{STATUS[file.status] || file.status}</Badge><Badge variant="secondary">Versão {file.version}</Badge>{file.previous && <Badge variant="outline">Versão anterior</Badge>}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" icon={<Eye className="w-4 h-4" />} onClick={() => setPreview({ title: file.title, loader: () => fetchPdf(fileUrl(file, true), undefined, file.fileName) })}>Visualizar</Button>
                <Button variant="outline" size="sm" disabled={busy} icon={<Download className="w-4 h-4" />} onClick={() => download(fileUrl(file))}>Baixar</Button>
              </div>
            </div>
          ))}
          {!filtered.length && <p className="text-sm text-gray-500">Nenhum documento corresponde à busca.</p>}
        </div>
        {filtered.length > 20 && <div className="flex justify-end items-center gap-3"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</Button><span className="text-xs text-gray-500">{page + 1} / {Math.ceil(filtered.length / 20)}</span><Button variant="outline" size="sm" disabled={(page + 1) * 20 >= filtered.length} onClick={() => setPage(value => value + 1)}>Próxima</Button></div>}
      </>}
      <PdfPreview request={preview} onClose={() => setPreview(null)} />
    </Card>
  )
}
