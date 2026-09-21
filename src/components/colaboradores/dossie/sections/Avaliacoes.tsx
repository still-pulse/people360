'use client'

import { useState } from 'react'
import { CircleSlash, Download, Eye, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api, errorMessage, fetchPdf } from '../api'
import { useDossie } from '../context'
import { useResource } from '../hooks'
import { ConfirmModal, EmptyState, fmtDate, Notice, SectionTitle, StatusBadge } from '../parts'
import type { AvaliacaoRow } from '../types'

export function Avaliacoes() {
  const { id, version, can, catalog, openAvaliacao, previewPdf, downloadPdf, reload, toast } = useDossie()
  const { data, loading, error } = useResource<{ items: AvaliacaoRow[] }>(`/api/colaboradores/${id}/dossie/avaliacoes`, version)
  const [cancel, setCancel] = useState<AvaliacaoRow | null>(null)
  const [busy, setBusy] = useState(false)
  const decisions = Object.fromEntries(catalog.avaliacao.gerencial.decisoes.map((d) => [d.valor, d.rotulo]))
  const canCreate = can('employee.evaluations.create')
  const buttons = canCreate ? (
    <>
      {catalog.avaliacao.gerencial.periodos.map((p) => <Button key={p} size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => openAvaliacao({ tipo: 'GERENCIAL', dias: p })}>Avaliação de {p} dias</Button>)}
      <Button variant="outline" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => openAvaliacao({ tipo: 'AUTOAVALIACAO', dias: 45 })}>Autoavaliação</Button>
    </>
  ) : null
  const file = (row: AvaliacaoRow, inline: boolean) => () => fetchPdf(`/api/colaboradores/${id}/dossie/avaliacoes/${row.id}/pdf${inline ? '?inline=1' : ''}`, undefined, 'Avaliacao.pdf')

  async function doCancel(reason?: string) {
    if (!cancel) return
    setBusy(true)
    try { await api(`/api/colaboradores/${id}/dossie/avaliacoes/${cancel.id}`, { method: 'PATCH', body: { action: 'cancelar', motivo: reason } }); toast('success', 'Avaliação cancelada.'); await reload() }
    catch (e) { toast('error', errorMessage(e)) } finally { setBusy(false); setCancel(null) }
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Avaliações do período de experiência" description="Avaliações do gestor (45 e 90 dias) e autoavaliação do colaborador." action={buttons} />
      {error && <Notice tone="danger">{error}</Notice>}
      {loading && !data ? <Card className="p-6 text-sm text-gray-400">Carregando…</Card> : !data?.items.length ? (
        <Card><EmptyState title="Nenhuma avaliação registrada." description="Registre as avaliações de 45 e 90 dias e a autoavaliação durante o período de experiência." /></Card>
      ) : (
        <div className="space-y-2.5">
          {data.items.map((a) => (
            <Card key={a.id} className={`p-4 ${a.status === 'CANCELADA' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{a.tipo === 'AUTOAVALIACAO' ? 'Autoavaliação' : `Avaliação${a.periodoDias ? ` de ${a.periodoDias} dias` : ''}`}</p>
                    <StatusBadge status={a.status} />
                    {a.decisao && <Badge variant="outline">{decisions[a.decisao] ?? a.decisao}</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{a.periodoInicio && a.periodoFim ? `Período ${fmtDate(a.periodoInicio)} a ${fmtDate(a.periodoFim)} · ` : ''}{fmtDate(a.dataAvaliacao)} · {a.avaliadorNome || a.criadoPorNome || '—'}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {a.status === 'RASCUNHO' && canCreate && <Button size="sm" variant="outline" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openAvaliacao({ tipo: a.tipo, id: a.id })}>Continuar</Button>}
                  {a.status === 'FINALIZADA' && <Button size="sm" variant="outline" onClick={() => openAvaliacao({ tipo: a.tipo, id: a.id })}>Detalhes</Button>}
                  {a.status !== 'CANCELADA' && <Button size="sm" variant="outline" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => previewPdf('Avaliação', file(a, true))}>Visualizar</Button>}
                  {a.status !== 'CANCELADA' && can('employee.documents.export') && <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={() => downloadPdf(file(a, false))}>Baixar</Button>}
                  {a.status !== 'CANCELADA' && can('employee.documents.cancel') && <Button size="sm" variant="danger" icon={<CircleSlash className="w-3.5 h-3.5" />} onClick={() => setCancel(a)}>Cancelar</Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ConfirmModal open={!!cancel} title="Cancelar avaliação?" danger busy={busy} confirmLabel="Cancelar avaliação" reasonLabel="Motivo do cancelamento"
        message={<p>A avaliação será cancelada, mas permanecerá registrada para rastreabilidade.</p>} onCancel={() => setCancel(null)} onConfirm={doCancel} />
    </div>
  )
}
