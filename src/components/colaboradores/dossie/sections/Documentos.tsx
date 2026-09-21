'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { errorMessage } from '../api'
import { AdmissaoImportBanner } from '../AdmissaoImportBanner'
import { useDossie } from '../context'
import { inputCls, Notice, SectionTitle } from '../parts'
import { DocumentList } from './DocumentList'

const MAX_MB = 15

/** Todos os documentos do colaborador (gerados e anexados) + envio de anexos validado no backend. */
export function Documentos() {
  const { id, catalog, can, reload, toast } = useDossie()
  const [categoria, setCategoria] = useState('')
  const [titulo, setTitulo] = useState('')
  const [obs, setObs] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  async function upload() {
    if (!file || !categoria) { setError('Selecione o arquivo e a categoria.'); return }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`O arquivo excede ${MAX_MB} MB.`); return }
    setBusy(true); setError('')
    try {
      const form = new FormData()
      form.append('arquivo', file); form.append('categoria', categoria); form.append('titulo', titulo); form.append('observacao', obs)
      const res = await fetch(`/api/colaboradores/${id}/dossie/documentos/anexos`, { method: 'POST', body: form })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha no envio.')
      toast('success', 'Documento anexado ao dossiê.')
      setFile(null); setTitulo(''); setObs(''); setCategoria(''); if (input.current) input.current.value = ''
      await reload()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <SectionTitle title="Documentos" description="Documentos gerados pelo sistema e arquivos anexados. Os arquivos ficam protegidos e só são entregues a usuários autorizados." />
      <AdmissaoImportBanner />
      {can('employee.documents.create') && (
        <Card className="p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-800">Anexar documento</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Arquivo (PDF, JPG ou PNG — até {MAX_MB} MB)</span>
              <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={`${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-[#15AFA4]/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-[#0d8c83]`} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Categoria <span className="text-red-500">*</span></span>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls}><option value="">Selecione…</option>{catalog.categoriasAnexo.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Nome do documento</span>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Opcional — usa o nome do arquivo" className={inputCls} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Observação</span>
              <input value={obs} onChange={(e) => setObs(e.target.value)} className={inputCls} /></label>
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex justify-end"><Button size="sm" isLoading={busy} icon={<Upload className="w-4 h-4" />} onClick={upload}>Enviar documento</Button></div>
        </Card>
      )}
      <DocumentList emptyTitle="Nenhum documento registrado." emptyDescription="Gere documentos a partir de “Novo Documento” ou anexe arquivos digitalizados." />
    </div>
  )
}
