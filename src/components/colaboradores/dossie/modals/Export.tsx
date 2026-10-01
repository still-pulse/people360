'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { api, fetchPdf, saveBlob, errorMessage } from '../api'
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
  const [admissionBusy, setAdmissionBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setSelected(overview.selecaoDossie.map((s) => s.id)); setError('') } }, [open, overview.selecaoDossie])
  const url = `/api/colaboradores/${id}/dossie/exportar`

  async function download() {
    setBusy(true); setError('')
    try {
      const { blob, fileName } = await fetchPdf(url, { tipo: 'FUNCIONAL', selecao: selected }, 'Dossie_Funcional.pdf')
      saveBlob(blob, fileName); toast('success', 'Dossiê gerado.'); onClose()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }

  async function downloadAdmission() {
    setAdmissionBusy(true); setError('')
    try {
      const { blob, fileName } = await fetchPdf(url, { tipo: 'ADMISIONAL' }, 'Dossie_Admissional.pdf')
      saveBlob(blob, fileName); toast('success', 'Dossiê admissional gerado.'); onClose()
    } catch (e) { setError(errorMessage(e)) } finally { setAdmissionBusy(false) }
  }

  async function sendToErpnext() {
    setSending(true); setError('')
    try {
      const result = await api<{ pages: number }>(`/api/colaboradores/${id}/dossie/erpnext`, { method: 'POST' })
      toast('success', `Dossiê completo (${result.pages} páginas) enviado ao ERPNext.`); onClose()
    } catch (e) { setError(errorMessage(e)) } finally { setSending(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Gerar dossiê do colaborador" size="lg">
      <div className="p-5 space-y-5">
        <section className="rounded-2xl border border-[#15AFA4]/30 bg-[#15AFA4]/5 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Dossiê admissional</h3>
            <p className="mt-1 text-sm text-gray-500">Capa e índice no padrão institucional, seguidos do formulário admissional e dos documentos enviados pelo colaborador e aprovados pelo RH.</p>
            {!overview.admissaoVinculada && <p className="mt-2 text-xs font-medium text-amber-700">Este colaborador não possui uma admissão digital vinculada.</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" disabled={!overview.admissaoVinculada || admissionBusy} onClick={() => { onClose(); previewPdf('Pré-visualização do dossiê admissional', () => fetchPdf(url, { tipo: 'ADMISIONAL', preview: true }, 'Dossie_Admissional.pdf')) }}>Visualizar PDF</Button>
            <Button size="sm" isLoading={admissionBusy} disabled={!overview.admissaoVinculada || busy || sending} onClick={downloadAdmission}>Gerar admissional</Button>
          </div>
        </section>
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Dossiê funcional (geral)</h3>
            <p className="mt-1 text-sm text-gray-500">Selecione os documentos que deverão compor o dossiê geral.</p>
          </div>
          <SelecaoDossie selected={selected} onChange={setSelected} />
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="outline" size="sm" disabled={!selected.length || busy || admissionBusy} onClick={() => { onClose(); previewPdf('Pré-visualização do dossiê funcional', () => fetchPdf(url, { tipo: 'FUNCIONAL', selecao: selected, preview: true }, 'Dossie_Funcional.pdf')) }}>Visualizar geral</Button>
          <Button variant="outline" size="sm" isLoading={sending} disabled={busy || admissionBusy} onClick={sendToErpnext} title="Gera o dossiê completo (todos os itens e documentos) e envia ao ERPNext">Enviar completo ao ERPNext</Button>
          <Button size="sm" isLoading={busy} disabled={!selected.length || sending || admissionBusy} onClick={download}>Gerar geral</Button>
        </div>
      </div>
    </Modal>
  )
}
