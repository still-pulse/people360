'use client'

import { Download, Eye, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fetchPdf } from '../api'
import { useDossie } from '../context'
import { useResource } from '../hooks'
import { EmptyState, fmtDate, Notice, SectionTitle, StatusBadge } from '../parts'
import type { AditivoRow } from '../types'

/** Histórico de aditivos: cada um é um registro novo; nenhum sobrescreve o anterior. */
export function Aditivos() {
  const { id, version, can, openAditivo, previewPdf, downloadPdf } = useDossie()
  const { data, loading, error } = useResource<{ items: AditivoRow[] }>(`/api/colaboradores/${id}/dossie/aditivos`, version)
  const file = (row: AditivoRow, inline: boolean) => () => fetchPdf(`/api/colaboradores/${id}/dossie/documentos/${row.documentoId}/arquivo${inline ? '?inline=1' : ''}`, undefined, 'Aditivo_Contratual.pdf')
  const newButton = can('employee.amendments.create') ? <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={openAditivo}>Novo aditivo</Button> : null

  return (
    <div className="space-y-4">
      <SectionTitle title="Aditivos contratuais" description="Alterações de cargo, salário, jornada, unidade e demais cláusulas, com histórico completo." action={newButton} />
      {error && <Notice tone="danger">{error}</Notice>}
      {loading && !data ? <Card className="p-6 text-sm text-gray-400">Carregando…</Card> : !data?.items.length ? (
        <Card><EmptyState title="Nenhum aditivo contratual registrado." description="Quando houver alterações de cargo, salário, jornada ou unidade, elas poderão ser registradas aqui." action={newButton} /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Nº</th><th className="px-4 py-3 font-medium">Vigência</th><th className="px-4 py-3 font-medium">Alteração</th>
              <th className="px-4 py-3 font-medium">Anterior → Nova</th><th className="px-4 py-3 font-medium">Motivo</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3" />
            </tr></thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0 align-top">
                  <td className="px-4 py-3 text-gray-500">{a.numero}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDate(a.vigencia)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{a.campoAlterado}</td>
                  <td className="px-4 py-3 text-gray-600"><span className="text-gray-400">{a.anterior}</span> → <span className="text-gray-900">{a.novo}</span></td>
                  <td className="px-4 py-3 text-gray-600 max-w-[220px]">{a.motivo}</td>
                  <td className="px-4 py-3">{a.status && <StatusBadge status={a.status} />}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {a.documentoId && <>
                      <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => previewPdf(`Aditivo nº ${a.numero}`, file(a, true))}>Ver</Button>
                      {can('employee.documents.export') && <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => downloadPdf(file(a, false))}>Baixar</Button>}
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
