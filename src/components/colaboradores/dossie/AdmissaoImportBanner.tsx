'use client'

import { useState } from 'react'
import { DownloadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api, errorMessage } from './api'
import { useDossie } from './context'

export type ImportResult = { admissionId: string | null; perfil: string[]; documentos: number; assinados: number; dependentes: number; ignorados: number }

export function summarizeImport(r: ImportResult) {
  const parts = [
    r.documentos ? `${r.documentos} documento(s) validado(s)` : '', r.assinados ? `${r.assinados} contrato(s)/termo(s) assinado(s)` : '',
    r.dependentes ? `${r.dependentes} dependente(s)` : '', r.perfil.length ? `dados cadastrais (${r.perfil.join(', ')})` : '',
  ].filter(Boolean)
  return parts.length ? `Importado da admissão: ${parts.join(', ')}.` : 'Nada novo para importar: o dossiê já está atualizado.'
}

/** Aviso quando a admissão digital tem documentos validados pelo RH (ou contratos assinados) ainda fora do dossiê. */
export function AdmissaoImportBanner() {
  const { id, overview, reload, toast, can } = useDossie()
  const [busy, setBusy] = useState(false)
  const p = overview.admissao.pendentes
  if (!overview.admissaoVinculada || p.documentos + p.assinados + p.dependentes === 0 || !can('employee.documents.edit')) return null

  const parts = [
    p.documentos ? `${p.documentos} documento(s) validado(s) pelo RH` : '', p.assinados ? `${p.assinados} contrato(s)/termo(s) assinado(s) eletronicamente` : '',
    p.dependentes ? `${p.dependentes} dependente(s)` : '',
  ].filter(Boolean)

  async function run() {
    setBusy(true)
    try { toast('success', summarizeImport(await api<ImportResult>(`/api/colaboradores/${id}/dossie/admissao`, { body: {} }))); await reload() }
    catch (e) { toast('error', errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <Card className="p-4 border-[#15AFA4]/30 bg-[#15AFA4]/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Há informações da admissão digital para trazer ao dossiê</p>
          <p className="text-sm text-gray-600 mt-0.5">{parts.join(', ')}.</p>
        </div>
        <Button size="sm" icon={<DownloadCloud className="w-4 h-4" />} isLoading={busy} onClick={run}>Importar para o dossiê</Button>
      </div>
    </Card>
  )
}
