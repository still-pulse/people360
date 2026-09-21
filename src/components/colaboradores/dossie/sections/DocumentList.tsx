'use client'

import { useState } from 'react'
import { CheckCheck, CircleSlash, Copy, Download, Eye, FilePen, History, Paperclip, PenLine, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { api, errorMessage, fetchPdf, saveBlob } from '../api'
import { useDossie } from '../context'
import { ConfirmModal, EmptyState, fmtDate, fmtDateTime, Notice, StatusBadge } from '../parts'
import { useResource } from '../hooks'
import type { DocDetail, DocRow } from '../types'

const NEXT: Record<string, { label: string; status: string }[]> = {
  AGUARDANDO_ASSINATURA: [{ label: 'Marcar como assinado', status: 'ASSINADO' }],
  ASSINADO: [{ label: 'Tornar vigente', status: 'VIGENTE' }, { label: 'Finalizar', status: 'FINALIZADO' }],
  VIGENTE: [{ label: 'Finalizar', status: 'FINALIZADO' }],
}

function DocDetailModal({ docId, onClose }: { docId: string | null; onClose: () => void }) {
  const { id, version } = useDossie()
  const { data, loading, error } = useResource<DocDetail>(docId ? `/api/colaboradores/${id}/dossie/documentos/${docId}` : null, version)
  return (
    <Modal open={!!docId} onClose={onClose} title={data?.titulo ?? 'Histórico do documento'} size="lg">
      <div className="p-5 space-y-5">
        {loading && <p className="text-sm text-gray-400">Carregando…</p>}
        {error && <Notice tone="danger">{error}</Notice>}
        {data && (
          <>
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div><p className="text-[11px] text-gray-400 uppercase font-medium">Status</p><StatusBadge status={data.status} /></div>
              <div><p className="text-[11px] text-gray-400 uppercase font-medium">Versão</p><p>{data.versao}</p></div>
              <div><p className="text-[11px] text-gray-400 uppercase font-medium">Template</p><p>{data.templateKey ? `${data.templateKey} v${data.templateVersion}` : '—'}</p></div>
              <div><p className="text-[11px] text-gray-400 uppercase font-medium">Criado por</p><p>{data.criadoPorNome || '—'}</p></div>
              <div><p className="text-[11px] text-gray-400 uppercase font-medium">Gerado em</p><p>{fmtDateTime(data.geradoEm ?? data.createdAt)}</p></div>
              <div><p className="text-[11px] text-gray-400 uppercase font-medium">Vigência</p><p>{fmtDate(data.vigenciaInicio)}{data.vigenciaFim ? ` a ${fmtDate(data.vigenciaFim)}` : ''}</p></div>
            </div>
            {data.hash && <div><p className="text-[11px] text-gray-400 uppercase font-medium">Hash SHA-256 do arquivo</p><p className="text-xs font-mono text-gray-600 break-all">{data.hash}</p></div>}
            {data.motivoCancelamento && <Notice tone="danger">Cancelado por {data.canceladoPorNome} em {fmtDateTime(data.canceladoEm)}: {data.motivoCancelamento}</Notice>}
            {data.assinaturas && data.assinaturas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Assinaturas</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {data.assinaturas.map((s) => (
                    <div key={s.role} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm"><span>{s.label}</span><Badge variant={s.status === 'ASSINADO' ? 'success' : 'warning'}>{s.status === 'ASSINADO' ? 'Assinado' : 'Pendente'}</Badge></div>
                  ))}
                </div>
              </div>
            )}
            {data.versoes.length > 1 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Versões</p>
                <ul className="space-y-1 text-sm">{data.versoes.map((v) => <li key={v.id} className="flex items-center gap-2"><span className="font-medium">v{v.versao}</span><StatusBadge status={v.status} /><span className="text-gray-400 text-xs">{fmtDate(v.createdAt)}</span>{v.id === data.id && <span className="text-xs text-[#0d8c83]">(este)</span>}</li>)}</ul>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Eventos</p>
              {data.eventos.length ? <ul className="space-y-2">{data.eventos.map((e) => <li key={e.id} className="text-sm"><span className="text-gray-800">{e.titulo}</span><span className="block text-xs text-gray-400">{fmtDateTime(e.em)} · {e.por || 'sistema'}{e.motivo ? ` · ${e.motivo}` : ''}</span></li>)}</ul> : <p className="text-sm text-gray-400">Nenhum evento registrado.</p>}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export type DocumentListProps = {
  categorias?: string[]
  tipos?: string[]
  origem?: 'GERADO' | 'ANEXADO'
  emptyTitle: string
  emptyDescription: string
  emptyAction?: React.ReactNode
}

/** Lista de documentos com todas as ações do ciclo de vida. Carrega apenas metadados. */
export function DocumentList({ categorias, tipos, origem, emptyTitle, emptyDescription, emptyAction }: DocumentListProps) {
  const { id, version, can, reload, toast, previewPdf, downloadPdf, openNovoDocumento } = useDossie()
  const query = origem ? `?take=100&origem=${origem}` : '?take=100'
  const { data, loading, error } = useResource<{ items: DocRow[]; total: number }>(`/api/colaboradores/${id}/dossie/documentos${query}`, version)
  const [detail, setDetail] = useState<string | null>(null)
  const [cancel, setCancel] = useState<DocRow | null>(null)
  const [busy, setBusy] = useState(false)

  const items = (data?.items ?? [])
    .filter((d) => (!categorias || categorias.includes(d.categoria)) && (!tipos || tipos.includes(d.tipo)))
    .sort((a, b) => new Date(a.vigenciaInicio ?? a.geradoEm ?? a.createdAt).getTime() - new Date(b.vigenciaInicio ?? b.geradoEm ?? b.createdAt).getTime())

  const base = `/api/colaboradores/${id}/dossie/documentos`
  const file = (d: DocRow, inline: boolean) => () => fetchPdf(`${base}/${d.id}/arquivo${inline ? '?inline=1' : ''}`, undefined, d.arquivoNome || 'documento.pdf')

  async function patch(d: DocRow, body: Record<string, unknown>, message: string) {
    setBusy(true)
    try { await api(`${base}/${d.id}`, { method: 'PATCH', body }); toast('success', message); await reload() }
    catch (e) { toast('error', errorMessage(e)) } finally { setBusy(false); setCancel(null) }
  }

  if (loading && !data) return <Card className="p-6 text-sm text-gray-400">Carregando documentos…</Card>
  if (error) return <Notice tone="danger">{error}</Notice>
  if (!items.length) return <Card><EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} /></Card>

  return (
    <>
      <div className="space-y-2.5">
        {items.map((d) => {
          const cancelled = d.status === 'CANCELADO'
          return (
            <Card key={d.id} className={`p-4 ${cancelled ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{d.titulo}</p>
                    <StatusBadge status={d.status} />
                    <Badge variant="outline">{d.categoria}</Badge>
                    {d.versao > 1 && <Badge variant="secondary">v{d.versao}</Badge>}
                    {d.origem === 'ANEXADO' && <Paperclip className="w-3.5 h-3.5 text-gray-400" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {d.vigenciaInicio ? `Vigência ${fmtDate(d.vigenciaInicio)}${d.vigenciaFim ? ` a ${fmtDate(d.vigenciaFim)}` : ''} · ` : ''}
                    {d.origem === 'ANEXADO' ? 'Enviado' : 'Gerado'} em {fmtDate(d.geradoEm ?? d.createdAt)} por {d.criadoPorNome || '—'}
                  </p>
                  {d.observacao && <p className="text-xs text-gray-400 mt-0.5">{d.observacao}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {d.status === 'RASCUNHO' ? (
                    can('employee.documents.edit') && !cancelled && (
                      <>
                        <Button variant="outline" size="sm" icon={<FilePen className="w-3.5 h-3.5" />} onClick={() => openNovoDocumento(undefined, d.id)}>Editar</Button>
                        <Button size="sm" icon={<PlayCircle className="w-3.5 h-3.5" />} onClick={() => openNovoDocumento(undefined, d.id)}>Gerar</Button>
                      </>
                    )
                  ) : d.temArquivo && (
                    <>
                      <Button variant="outline" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => previewPdf(d.titulo, file(d, true))}>Visualizar</Button>
                      {can('employee.documents.export') && <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => downloadPdf(file(d, false))}>Baixar</Button>}
                    </>
                  )}
                  {d.origem === 'GERADO' && d.status !== 'RASCUNHO' && can('employee.documents.create') && (
                    <Button variant="outline" size="sm" icon={<Copy className="w-3.5 h-3.5" />} disabled={busy} onClick={() => patch(d, { action: 'duplicar' }, 'Nova versão criada como rascunho.')}>Duplicar</Button>
                  )}
                  <Button variant="ghost" size="sm" icon={<History className="w-3.5 h-3.5" />} onClick={() => setDetail(d.id)}>Histórico</Button>
                </div>
              </div>
              {can('employee.documents.edit') && !cancelled && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-50">
                  {(NEXT[d.status] ?? []).map((n) => (
                    <Button key={n.status} variant="secondary" size="sm" icon={n.status === 'ASSINADO' ? <PenLine className="w-3.5 h-3.5" /> : <CheckCheck className="w-3.5 h-3.5" />} disabled={busy} onClick={() => patch(d, { action: 'status', status: n.status }, `Status atualizado: ${n.label.toLowerCase()}.`)}>{n.label}</Button>
                  ))}
                  {can('employee.documents.cancel') && d.status !== 'FINALIZADO' && (
                    <Button variant="danger" size="sm" icon={<CircleSlash className="w-3.5 h-3.5" />} disabled={busy} onClick={() => setCancel(d)}>Cancelar documento</Button>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
      <DocDetailModal docId={detail} onClose={() => setDetail(null)} />
      <ConfirmModal
        open={!!cancel} title="Cancelar documento?" danger busy={busy} confirmLabel="Cancelar documento" reasonLabel="Motivo do cancelamento"
        message={<p>O documento <strong>{cancel?.titulo}</strong> será cancelado, mas permanecerá no histórico para rastreabilidade. Esta ação não apaga o arquivo.</p>}
        onCancel={() => setCancel(null)} onConfirm={(reason) => cancel && patch(cancel, { action: 'status', status: 'CANCELADO', motivo: reason }, 'Documento cancelado.')}
      />
    </>
  )
}

export { saveBlob }
