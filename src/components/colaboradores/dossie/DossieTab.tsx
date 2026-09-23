'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, FilePlus2, FolderOpen, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api, errorMessage, saveBlob } from './api'
import { DossieContext, type DossieCtx, type PdfLoader, type SectionId } from './context'
import { AditivoModal } from './modals/Aditivo'
import { AvaliacaoModal } from './modals/Avaliacao'
import { DependenteModal } from './modals/Dependente'
import { ExportModal } from './modals/Export'
import { NovoDocumentoModal } from './modals/NovoDocumento'
import { Field, fmtDate, fmtMoney, Notice, Toast, type ToastState } from './parts'
import { PdfPreview, type PreviewRequest } from './PdfPreview'
import { Aditivos } from './sections/Aditivos'
import { Avaliacoes } from './sections/Avaliacoes'
import { Cadastro } from './sections/Cadastro'
import { Dependentes } from './sections/Dependentes'
import { Documentos } from './sections/Documentos'
import { Historico } from './sections/Historico'
import { Acordos, Contratos, Experiencia, Exportacoes } from './sections/Simples'
import { Visao } from './sections/Visao'
import type { Catalog, Overview } from './types'

const GROUPS: { label: string; sections: { id: SectionId; label: string }[] }[] = [
  { label: 'Colaborador', sections: [
    { id: 'visao', label: 'Visão geral' }, { id: 'cadastro', label: 'Dados cadastrais' },
    { id: 'dependentes', label: 'Dependentes' }, { id: 'avaliacoes', label: 'Avaliações' },
  ] },
  { label: 'Vínculo de trabalho', sections: [
    { id: 'contratos', label: 'Contratos' }, { id: 'aditivos', label: 'Aditivos' },
    { id: 'acordos', label: 'Acordos e termos' }, { id: 'experiencia', label: 'Experiência' },
    { id: 'historico', label: 'Histórico funcional' },
  ] },
  { label: 'Arquivo', sections: [
    { id: 'documentos', label: 'Documentos e arquivos' }, { id: 'exportacoes', label: 'Exportar dossiê' },
  ] },
]

function Photo({ id, name, hasPhoto }: { id: string; name: string; hasPhoto: boolean }) {
  const [failed, setFailed] = useState(false)
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  if (!hasPhoto || failed) {
    return <div className="w-16 h-20 rounded-2xl bg-gradient-to-br from-[#15AFA4] to-[#0d8c83] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">{initials}</div>
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/colaboradores/${id}/dossie/foto`} alt={name} onError={() => setFailed(true)} className="w-16 h-20 rounded-2xl object-cover border border-gray-100 flex-shrink-0" />
}

export function DossieTab({ colaboradorId }: { colaboradorId: string }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [section, setSection] = useState<SectionId>('visao')
  const [toast, setToast] = useState<ToastState>(null)
  const [preview, setPreview] = useState<PreviewRequest>(null)
  const [novoDoc, setNovoDoc] = useState<{ open: boolean; tipo?: string; draftId?: string }>({ open: false })
  const [aditivo, setAditivo] = useState(false)
  const [avaliacao, setAvaliacao] = useState<{ tipo: 'GERENCIAL' | 'AUTOAVALIACAO'; dias?: number; id?: string } | null>(null)
  const [dependente, setDependente] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const base = `/api/colaboradores/${colaboradorId}/dossie`
  const load = useCallback(async () => {
    try {
      const [o, c] = await Promise.all([api<Overview>(base), api<Catalog>(`${base}/catalogo`)])
      setOverview(o); setCatalog(c); setError(''); setVersion((v) => v + 1)
    } catch (e) { setError(errorMessage(e)) }
  }, [base])
  useEffect(() => { load() }, [load])

  const ctx = useMemo<DossieCtx | null>(() => {
    if (!overview || !catalog) return null
    return {
      id: colaboradorId, overview, catalog, version,
      can: (permission) => !!overview.permissoes[permission],
      reload: load,
      toast: (kind, text) => setToast({ kind, text }),
      goTo: setSection,
      previewPdf: (title, loader, actions) => setPreview({ title, loader, actions }),
      downloadPdf: async (loader: PdfLoader) => {
        try { const { blob, fileName } = await loader(); saveBlob(blob, fileName) } catch (e) { setToast({ kind: 'error', text: errorMessage(e) }) }
      },
      openNovoDocumento: (tipo, draftId) => setNovoDoc({ open: true, tipo, draftId }),
      openAditivo: () => setAditivo(true),
      openAvaliacao: (input) => setAvaliacao(input),
      openDependente: () => setDependente(true),
      openExport: () => setExportOpen(true),
    }
  }, [overview, catalog, colaboradorId, version, load])

  if (error) return <Notice tone="danger">{error}</Notice>
  if (!ctx || !overview) return <div className="space-y-4"><div className="h-44 rounded-2xl bg-gray-100 animate-pulse" /><div className="h-10 rounded-xl bg-gray-100 animate-pulse w-2/3" /></div>
  const c = overview.colaborador
  const can = ctx.can

  return (
    <DossieContext.Provider value={ctx}>
      <div className="space-y-5">
        <Card className="overflow-hidden">
          <div className="p-5 flex flex-wrap items-center gap-4">
            <Photo id={colaboradorId} name={c.nome} hasPhoto={c.temFoto} />
            <div className="min-w-0 flex-1 basis-48">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-gray-900 break-words">{c.nome}</h2><Badge variant={c.situacao === 'Ativo' ? 'success' : 'secondary'}>{c.situacao}</Badge></div>
              <p className="text-sm text-gray-600 mt-1">{c.cargo || 'Cargo não informado'}</p>
              {!!c.matricula && c.matricula !== '0' && <p className="text-xs text-gray-400 mt-1">Matrícula {c.matricula}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<FolderOpen className="w-4 h-4" />} onClick={() => setSection('documentos')}>Documentos</Button>
              {can('employee.documents.create') && <Button variant="outline" size="sm" icon={<FilePlus2 className="w-4 h-4" />} onClick={() => ctx.openNovoDocumento()}>Novo documento</Button>}
              {can('employee.documents.export') && <Button variant="ghost" size="sm" icon={<Package className="w-4 h-4" />} onClick={ctx.openExport}>Exportar dossiê</Button>}
            </div>
          </div>
          <div className="border-t border-gray-100 px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50/50">
            <div className="col-span-2 sm:col-span-1"><Field label="Unidade" value={c.unidade} /></div><Field label="Admissão" value={fmtDate(c.admissao)} /><Field label="Contrato" value={c.tipoContrato} />
          </div>
          <details className="group border-t border-gray-100">
            <summary className="cursor-pointer list-none px-5 py-3 text-xs font-medium text-gray-500 flex items-center gap-2 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#15AFA4]">Mais informações do vínculo<ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" /></summary>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 px-5 pb-5">
              <Field label="CPF" value={c.cpf} mono /><Field label="Setor" value={c.setor} /><Field label="Centro de custo" value={c.centroCusto} />
              <Field label="Jornada" value={c.jornada} /><Field label="Escala" value={c.escala} /><Field label="Salário" value={fmtMoney(c.salario)} /><Field label="Gestor imediato" value={c.gestor} />
              <Field label="Última alteração contratual" value={c.ultimaAlteracao ? fmtDate(c.ultimaAlteracao) : '—'} />
            </div>
          </details>
        </Card>

        <div className="lg:hidden">
          <label htmlFor="dossie-section" className="block text-xs font-medium text-gray-500 mb-2">Navegar pelo dossiê</label>
          <select id="dossie-section" value={section} onChange={event => setSection(event.target.value as SectionId)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#15AFA4]/30">
            {GROUPS.map(group => <optgroup key={group.label} label={group.label}>{group.sections.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>)}
          </select>
        </div>
        <div className="grid lg:grid-cols-[190px_minmax(0,1fr)] gap-6 items-start">
          <nav aria-label="Seções do dossiê" className="hidden lg:block space-y-5 sticky top-5">
            {GROUPS.map(group => <div key={group.label}>
              <p className="px-3 mb-2 text-[10px] uppercase tracking-wider font-semibold text-gray-400">{group.label}</p>
              <div className="space-y-1">{group.sections.map(item => <button key={item.id} onClick={() => setSection(item.id)} aria-current={section === item.id ? 'page' : undefined}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#15AFA4] ${section === item.id ? 'bg-[#15AFA4]/10 text-[#0d8c83] font-semibold' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>{item.label}</button>)}</div>
            </div>)}
          </nav>
          <div className="min-w-0">
          {section === 'visao' && <Visao />}
          {section === 'cadastro' && <Cadastro />}
          {section === 'contratos' && <Contratos />}
          {section === 'aditivos' && <Aditivos />}
          {section === 'dependentes' && <Dependentes />}
          {section === 'acordos' && <Acordos />}
          {section === 'experiencia' && <Experiencia />}
          {section === 'avaliacoes' && <Avaliacoes />}
          {section === 'historico' && <Historico />}
          {section === 'documentos' && <Documentos />}
          {section === 'exportacoes' && <Exportacoes />}
          </div>
        </div>
      </div>

      <NovoDocumentoModal open={novoDoc.open} initialTipo={novoDoc.tipo} draftId={novoDoc.draftId} onClose={() => setNovoDoc({ open: false })} />
      <AditivoModal open={aditivo} onClose={() => setAditivo(false)} />
      <AvaliacaoModal open={!!avaliacao} input={avaliacao} onClose={() => setAvaliacao(null)} />
      <DependenteModal open={dependente} editing={null} onClose={() => setDependente(false)} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <PdfPreview request={preview} onClose={() => setPreview(null)} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </DossieContext.Provider>
  )
}

