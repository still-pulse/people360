'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CalendarPlus, ClipboardCheck, FileSignature, FileText, ListChecks, Scale, ScrollText, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { api, errorMessage, fetchPdf } from '../api'
import { useDossie } from '../context'
import { ConfirmModal, inputCls, Notice } from '../parts'
import type { CatalogField, CatalogType } from '../types'

const ICONS: Record<string, typeof FileText> = {
  CONTRATO_EXPERIENCIA: FileSignature, CONTRATO_TRABALHO: FileText, PRORROGACAO: CalendarPlus, EFETIVACAO: ClipboardCheck,
  ADITIVO_CONTRATUAL: Scale, ACORDO_COMPENSACAO: ScrollText, DECLARACAO_DEPENDENTES_IR: Users, TERMO_RESPONSABILIDADE: Users,
  FICHA_SALARIO_FAMILIA: Users, NORMAS_PONTO: ListChecks, OUTRO_DOCUMENTO: FileText,
}

function FieldInput({ field, value, onChange }: { field: CatalogField; value: string; onChange: (v: string) => void }) {
  const id = `f-${field.key}`
  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="text-sm font-medium text-gray-700">{field.label}{field.required && <span className="text-red-500"> *</span>}</span>
      {field.type === 'textarea' ? (
        <textarea id={id} rows={4} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      ) : field.type === 'select' ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          <option value="">Selecione…</option>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input id={id} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} inputMode={field.type === 'number' ? 'numeric' : undefined} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      )}
      {field.help && <span className="text-xs text-gray-400">{field.help}</span>}
    </label>
  )
}

/**
 * "Novo Documento": escolha do tipo → formulário só com o que o RH precisa informar
 * (o restante vem do cadastro) → Visualizar (PDF real) → Gerar.
 */
export function NovoDocumentoModal({ open, initialTipo, draftId, onClose }: { open: boolean; initialTipo?: string; draftId?: string; onClose: () => void }) {
  const { id, catalog, reload, toast, previewPdf, goTo } = useDossie()
  const [tipo, setTipo] = useState<string | null>(null)
  const [dados, setDados] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const type: CatalogType | undefined = useMemo(() => catalog.types.find((t) => t.tipo === tipo), [catalog, tipo])

  useEffect(() => {
    if (!open) return
    setErrors([]); setConfirm(false); setDraft(draftId ?? null)
    const initial = initialTipo && catalog.types.find((t) => t.tipo === initialTipo && !t.flow)
    setTipo(initial ? initial.tipo : null)
    if (initial) setDados(Object.fromEntries(initial.fields.map((f) => [f.key, f.default])))
    if (draftId) {
      api<{ tipo: string; dados: Record<string, string> | null }>(`/api/colaboradores/${id}/dossie/documentos/${draftId}`)
        .then((doc) => { setTipo(doc.tipo); setDados(doc.dados ?? {}) })
        .catch((e) => toast('error', errorMessage(e)))
    }
  }, [open, initialTipo, draftId, catalog, id, toast])

  const choose = (t: CatalogType) => {
    setTipo(t.tipo); setErrors([])
    setDados(Object.fromEntries(t.fields.map((f) => [f.key, f.default])))
  }
  const base = `/api/colaboradores/${id}/dossie/documentos`

  async function run(action: 'preview' | 'draft' | 'generate') {
    if (!type) return
    setBusy(true); setErrors([])
    try {
      if (action === 'preview') {
        previewPdf(`Pré-visualização — ${type.titulo}`, () => fetchPdf(base, { tipo: type.tipo, dados, mode: 'preview' }, `${type.tipo}.pdf`), [
          { label: 'Gerar PDF', onClick: () => setConfirm(true) },
        ])
        return
      }
      if (draft && action === 'generate') await api(`${base}/${draft}`, { method: 'PATCH', body: { action: 'gerar', dados } })
      else if (draft) await api(`${base}/${draft}`, { method: 'PATCH', body: { action: 'editar', dados } })
      else await api(base, { body: { tipo: type.tipo, dados, mode: action } })
      toast('success', action === 'generate' ? 'Documento gerado e arquivado no dossiê.' : 'Rascunho salvo.')
      setConfirm(false); onClose(); await reload(); goTo(type.categoria === 'Contrato' ? 'contratos' : 'acordos')
    } catch (e) {
      setConfirm(false)
      const list = (e as { details?: string[] }).details
      setErrors(list?.length ? list : [errorMessage(e)])
    } finally { setBusy(false) }
  }

  const visible = catalog.types.filter((t) => !t.flow)
  return (
    <>
      <Modal open={open} onClose={onClose} title={type ? type.titulo : 'Qual documento deseja gerar?'} size="lg">
        {!type ? (
          <div className="p-5 grid sm:grid-cols-2 gap-3">
            {visible.map((t) => {
              const Icon = ICONS[t.tipo] ?? FileText
              return (
                <button key={t.tipo} onClick={() => choose(t)} className="text-left rounded-xl border border-gray-200 p-4 hover:border-[#15AFA4] hover:bg-[#15AFA4]/5 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#15AFA4]/10 flex items-center justify-center flex-shrink-0"><Icon className="w-[18px] h-[18px] text-[#15AFA4]" /></div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{t.titulo}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.descricao}</p>
                      {t.missing.length > 0 && <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Cadastro incompleto</p>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <button onClick={() => { setTipo(null); setDraft(null); setErrors([]) }} className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />Escolher outro documento</button>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Preenchido automaticamente</p>
              <p className="text-sm text-gray-700">{type.autoFilled.join(' · ')}{type.tipo.includes('DEPENDENTES') || type.tipo.includes('RESPONSABILIDADE') || type.tipo.includes('SALARIO_FAMILIA') ? ' · dependentes cadastrados' : ''}.</p>
              <p className="text-xs text-gray-400 mt-1">Assinaturas previstas: {type.signatures.join(', ')}.</p>
            </div>
            {type.missing.length > 0 && <Notice tone="warning">Complete em <strong>Dados cadastrais</strong> antes de gerar: {type.missing.join(', ')}.</Notice>}
            {type.fields.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Informe para este documento</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {type.fields.map((f) => (
                    <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <FieldInput field={f} value={dados[f.key] ?? ''} onChange={(v) => setDados((cur) => ({ ...cur, [f.key]: v }))} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {errors.length > 0 && <Notice tone="danger"><ul className="list-disc pl-4 space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Notice>}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run('draft')}>Salvar rascunho</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run('preview')}>Visualizar documento</Button>
              <Button size="sm" disabled={busy || type.missing.length > 0} onClick={() => setConfirm(true)}>Gerar PDF</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmModal
        open={confirm} title="Confirmar geração do documento?" busy={busy} confirmLabel="Gerar documento"
        message={<><p>Será gerado o PDF de <strong>{type?.titulo}</strong> com os dados atuais do colaborador.</p><p>Após finalizado, os dados históricos deste documento não serão alterados automaticamente.</p></>}
        onCancel={() => setConfirm(false)} onConfirm={() => run('generate')}
      />
    </>
  )
}
