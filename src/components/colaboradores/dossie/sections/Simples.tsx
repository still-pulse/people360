'use client'

import { useState } from 'react'
import { FileDown, FileSearch, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fetchPdf, saveBlob, errorMessage } from '../api'
import { useDossie } from '../context'
import { fmtDate, Notice, SectionTitle } from '../parts'
import { SelecaoDossie } from '../modals/Export'
import { DocumentList } from './DocumentList'

const CONTRATOS = ['CONTRATO_EXPERIENCIA', 'CONTRATO_TRABALHO', 'PRORROGACAO', 'EFETIVACAO']

/** Linha do tempo de contratos: experiência, prorrogação, efetivação e contratos posteriores. */
export function Contratos() {
  const { can, openNovoDocumento } = useDossie()
  const button = can('employee.contracts.create') ? <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => openNovoDocumento('CONTRATO_EXPERIENCIA')}>Novo contrato</Button> : null
  return (
    <div className="space-y-4">
      <SectionTitle title="Contratos" description="Do contrato de experiência aos contratos posteriores, em ordem cronológica." action={button} />
      <DocumentList tipos={CONTRATOS} emptyTitle="Nenhum contrato registrado." emptyDescription="Gere o contrato de experiência com os dados já cadastrados do colaborador." emptyAction={button} />
    </div>
  )
}

export function Acordos() {
  const { can, openNovoDocumento } = useDossie()
  const button = can('employee.documents.create') ? <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => openNovoDocumento()}>Novo documento</Button> : null
  return (
    <div className="space-y-4">
      <SectionTitle title="Acordos e termos" description="Acordo de compensação de horas, declarações, termos de responsabilidade e normas." action={button} />
      <DocumentList categorias={['Acordo', 'Termo', 'Dependente', 'Outro']} emptyTitle="Nenhum acordo ou termo registrado." emptyDescription="Gere acordos de compensação de horas, termos e declarações a partir do cadastro do colaborador." emptyAction={button} />
    </div>
  )
}

/** Acompanhamento do período de experiência: prazos + documentos + atalhos. */
export function Experiencia() {
  const { overview, can, openNovoDocumento, openAvaliacao, goTo } = useDossie()
  const admissao = overview.colaborador.admissao ? new Date(overview.colaborador.admissao) : null
  const at = (days: number) => (admissao ? fmtDate(new Date(admissao.getTime() + (days - 1) * 86_400_000).toISOString()) : '—')
  return (
    <div className="space-y-5">
      <SectionTitle title="Período de experiência" description="Contrato, prorrogação, avaliações e efetivação." />
      <Card className="p-5 grid sm:grid-cols-3 gap-4">
        <div><p className="text-[11px] text-gray-400 uppercase font-medium">Admissão</p><p className="text-sm">{fmtDate(overview.colaborador.admissao)}</p></div>
        <div><p className="text-[11px] text-gray-400 uppercase font-medium">Fim dos 45 dias</p><p className="text-sm">{at(45)}</p></div>
        <div><p className="text-[11px] text-gray-400 uppercase font-medium">Fim dos 90 dias</p><p className="text-sm">{at(90)}</p></div>
      </Card>
      <div className="flex flex-wrap gap-2">
        {can('employee.documents.create') && <>
          <Button variant="outline" size="sm" onClick={() => openNovoDocumento('CONTRATO_EXPERIENCIA')}>Contrato de experiência</Button>
          <Button variant="outline" size="sm" onClick={() => openNovoDocumento('PRORROGACAO')}>Prorrogação</Button>
          <Button variant="outline" size="sm" onClick={() => openNovoDocumento('EFETIVACAO')}>Efetivação</Button>
        </>}
        {can('employee.evaluations.create') && <>
          <Button variant="outline" size="sm" onClick={() => openAvaliacao({ tipo: 'GERENCIAL', dias: 45 })}>Avaliação de 45 dias</Button>
          <Button variant="outline" size="sm" onClick={() => openAvaliacao({ tipo: 'GERENCIAL', dias: 90 })}>Avaliação de 90 dias</Button>
        </>}
        <Button variant="ghost" size="sm" onClick={() => goTo('avaliacoes')}>Ver avaliações</Button>
      </div>
      <DocumentList tipos={['CONTRATO_EXPERIENCIA', 'PRORROGACAO', 'EFETIVACAO']} emptyTitle="Nenhum documento da experiência." emptyDescription="O contrato de experiência, a prorrogação e a efetivação aparecerão aqui." />
    </div>
  )
}

export function Exportacoes() {
  const { id, overview, previewPdf, toast } = useDossie()
  const [selected, setSelected] = useState<string[]>(overview.selecaoDossie.map((s) => s.id))
  const [busy, setBusy] = useState(false)
  const [admissionBusy, setAdmissionBusy] = useState(false)
  const [error, setError] = useState('')
  const url = `/api/colaboradores/${id}/dossie/exportar`
  async function download() {
    setBusy(true); setError('')
    try { const { blob, fileName } = await fetchPdf(url, { tipo: 'FUNCIONAL', selecao: selected }, 'Dossie_Funcional.pdf'); saveBlob(blob, fileName); toast('success', 'Dossiê gerado.') }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  async function downloadAdmission() {
    setAdmissionBusy(true); setError('')
    try { const { blob, fileName } = await fetchPdf(url, { tipo: 'ADMISIONAL' }, 'Dossie_Admissional.pdf'); saveBlob(blob, fileName); toast('success', 'Dossiê admissional gerado.') }
    catch (e) { setError(errorMessage(e)) } finally { setAdmissionBusy(false) }
  }
  return (
    <div className="space-y-4">
      <SectionTitle title="Exportações" description="Gere o dossiê admissional ou o dossiê funcional completo em um único PDF." />
      {error && <Notice tone="danger">{error}</Notice>}
      <Card className="p-5 space-y-4 border-[#15AFA4]/30 bg-[#15AFA4]/5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Dossiê admissional</h3>
          <p className="mt-1 text-sm text-gray-500">Capa e índice no padrão institucional, formulário admissional e documentos enviados pelo colaborador e aprovados pelo RH.</p>
          {!overview.admissaoVinculada && <p className="mt-2 text-xs font-medium text-amber-700">Este colaborador não possui uma admissão digital vinculada.</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" icon={<FileSearch className="w-4 h-4" />} disabled={!overview.admissaoVinculada || admissionBusy} onClick={() => previewPdf('Pré-visualização do dossiê admissional', () => fetchPdf(url, { tipo: 'ADMISIONAL', preview: true }, 'Dossie_Admissional.pdf'))}>Visualizar PDF</Button>
          <Button size="sm" icon={<FileDown className="w-4 h-4" />} isLoading={admissionBusy} disabled={!overview.admissaoVinculada || busy} onClick={downloadAdmission}>Gerar admissional</Button>
        </div>
      </Card>
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Dossiê funcional (geral)</h3>
          <p className="mt-1 text-sm text-gray-500">Escolha as seções, documentos e anexos que farão parte do dossiê geral.</p>
        </div>
        <SelecaoDossie selected={selected} onChange={setSelected} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" icon={<FileSearch className="w-4 h-4" />} disabled={!selected.length || admissionBusy} onClick={() => previewPdf('Pré-visualização do dossiê funcional', () => fetchPdf(url, { tipo: 'FUNCIONAL', selecao: selected, preview: true }, 'Dossie_Funcional.pdf'))}>Visualizar geral</Button>
          <Button size="sm" icon={<FileDown className="w-4 h-4" />} isLoading={busy} disabled={!selected.length || admissionBusy} onClick={download}>Gerar geral</Button>
        </div>
      </Card>
      <p className="text-xs text-gray-400">Cada exportação é registrada na auditoria (quem gerou/baixou e quando).</p>
    </div>
  )
}
