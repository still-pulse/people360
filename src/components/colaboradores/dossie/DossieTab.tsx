'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FilePlus2, FileText, FolderOpen, Package } from 'lucide-react'
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

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'visao', label: 'Visão Geral' }, { id: 'cadastro', label: 'Dados Cadastrais' }, { id: 'contratos', label: 'Contratos' },
  { id: 'aditivos', label: 'Aditivos' }, { id: 'dependentes', label: 'Dependentes' }, { id: 'acordos', label: 'Acordos e Termos' },
  { id: 'experiencia', label: 'Período de Experiência' }, { id: 'avaliacoes', label: 'Avaliações' }, { id: 'historico', label: 'Histórico Funcional' },
  { id: 'documentos', label: 'Documentos' }, { id: 'exportacoes', label: 'Exportações' },
]

function Photo({ id, name, hasPhoto }: { id: string; name: string; hasPhoto: boolean }) {
  const [failed, setFailed] = useState(false)
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  if (!hasPhoto || failed) {
    return <div className="w-28 h-36 rounded-2xl bg-gradient-to-br from-[#15AFA4] to-[#0d8c83] flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">{initials}</div>
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/colaboradores/${id}/dossie/foto`} alt={name} onError={() => setFailed(true)} className="w-28 h-36 rounded-2xl object-cover border border-gray-100 flex-shrink-0" />
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
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row gap-5">
            <Photo id={colaboradorId} name={c.nome} hasPhoto={c.temFoto} />
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 break-words">{c.nome}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant={c.situacao === 'Ativo' ? 'success' : 'secondary'}>{c.situacao}</Badge>
                    <span className="text-sm text-gray-500">Matrícula {c.matricula}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {can('employee.documents.export') && <Button size="sm" icon={<Package className="w-4 h-4" />} onClick={ctx.openExport}>Gerar Dossiê Completo</Button>}
                  {can('employee.documents.create') && <Button variant="outline" size="sm" icon={<FilePlus2 className="w-4 h-4" />} onClick={() => ctx.openNovoDocumento()}>Novo Documento</Button>}
                  {can('employee.amendments.create') && <Button variant="outline" size="sm" icon={<FileText className="w-4 h-4" />} onClick={ctx.openAditivo}>Novo Aditivo</Button>}
                  <Button variant="outline" size="sm" icon={<FolderOpen className="w-4 h-4" />} onClick={() => setSection('documentos')}>Visualizar Documentos</Button>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
                <Field label="CPF" value={c.cpf} mono /><Field label="Cargo" value={c.cargo} /><Field label="Setor" value={c.setor} /><Field label="Unidade" value={c.unidade} />
                <Field label="Centro de custo" value={c.centroCusto} /><Field label="Data de admissão" value={fmtDate(c.admissao)} /><Field label="Tipo de contrato" value={c.tipoContrato} /><Field label="Jornada" value={c.jornada} />
                <Field label="Escala" value={c.escala} /><Field label="Salário" value={fmtMoney(c.salario)} /><Field label="Gestor imediato" value={c.gestor} />
                <Field label="Última alteração contratual" value={c.ultimaAlteracao ? fmtDate(c.ultimaAlteracao) : '—'} />
              </div>
            </div>
          </div>
        </Card>

        <nav aria-label="Seções do dossiê" className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)} aria-current={section === s.id ? 'page' : undefined}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${section === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s.label}
            </button>
          ))}
        </nav>

        <div>
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

