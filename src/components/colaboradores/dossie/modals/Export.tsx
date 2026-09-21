'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { fetchPdf, saveBlob, errorMessage } from '../api'
import { useDossie } from '../context'
import { Notice } from '../parts'

export function SelecaoDossie({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { overview } = useDossie()
  const all = overview.selecaoDossie.map((s) => s.id)
  const toggle = (sid: string) => onChange(selected.includes(sid) ? selected.filter((v) => v !== sid) : [...selected, sid])
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onChange(all)}>Selecionar todos</Button>
        <Button variant="outline" size="sm" onClick={() => onChange([])}>Limpar seleção</Button>
        <span className="ml-auto self-center text-xs text-gray-400">{selected.length} de {all.length}</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {overview.selecaoDossie.map((s) => (
          <label key={s.id} className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer transition-all ${selected.includes(s.id) ? 'border-[#15AFA4]/40 bg-[#15AFA4]/5 text-gray-900' : 'border-gray-200 text-gray-600'}`}>
            <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="accent-[#15AFA4] w-4 h-4 flex-shrink-0" />{s.label}
          </label>
        ))}
      </div>
    </div>
  )
}

/** Exporta o dossiê completo em um único PDF (capa, índice, documentos em ordem cronológica e anexos). */
export function ExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { id, overview, previewPdf, toast } = useDossie()
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setSelected(overview.selecaoDossie.map((s) => s.id)); setError('') } }, [open, overview.selecaoDossie])
  const url = `/api/colaboradores/${id}/dossie/exportar`

  async function download() {
    setBusy(true); setError('')
    try {
      const { blob, fileName } = await fetchPdf(url, { selecao: selected }, 'Dossie_Funcional.pdf')
      saveBlob(blob, fileName); toast('success', 'Dossiê gerado.'); onClose()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Gerar Dossiê do Colaborador" size="lg">
      <div className="p-5 space-y-4">
        <p className="text-sm text-gray-500">Selecione os documentos que deverão compor o dossiê.</p>
        <SelecaoDossie selected={selected} onChange={setSelected} />
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="outline" size="sm" disabled={!selected.length || busy} onClick={() => { onClose(); previewPdf('Pré-visualização do dossiê', () => fetchPdf(url, { selecao: selected, preview: true }, 'Dossie_Funcional.pdf')) }}>Visualizar PDF</Button>
          <Button size="sm" isLoading={busy} disabled={!selected.length} onClick={download}>Gerar PDF</Button>
        </div>
      </div>
    </Modal>
  )
}
