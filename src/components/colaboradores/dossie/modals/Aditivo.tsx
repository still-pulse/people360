'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { api, errorMessage, fetchPdf } from '../api'
import { useDossie } from '../context'
import { ConfirmModal, fmtMoney, inputCls, Notice } from '../parts'

const today = () => new Date().toISOString().slice(0, 10)

/** Novo aditivo: mostra a informação ATUAL x a NOVA, exige vigência e motivo, e gera o documento oficial. */
export function AditivoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { id, catalog, reload, toast, previewPdf, goTo } = useDossie()
  const [tipo, setTipo] = useState('')
  const [novo, setNovo] = useState('')
  const [anteriorLivre, setAnteriorLivre] = useState('')
  const [descricao, setDescricao] = useState('')
  const [vigencia, setVigencia] = useState(today())
  const [motivo, setMotivo] = useState('')
  const [clausulas, setClausulas] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setTipo(''); setNovo(''); setAnteriorLivre(''); setDescricao(''); setVigencia(today()); setMotivo(''); setClausulas(''); setErrors([]); setConfirm(false)
  }, [open])

  const meta = useMemo(() => catalog.aditivo.tipos.find((t) => t.value === tipo), [catalog, tipo])
  const atual = tipo ? catalog.aditivo.atual[tipo] : ''
  const isMoney = tipo === 'SALARIO'
  const atualLabel = meta?.livre ? (anteriorLivre || '—') : (isMoney ? fmtMoney(atual) : atual || '— (não cadastrado)')
  const novoLabel = isMoney ? fmtMoney(novo) : novo || '—'

  const body = (mode: 'preview' | 'generate') => ({ tipoAlteracao: tipo, valorNovo: novo, valorAnterior: anteriorLivre, descricao, vigencia, motivo, clausulas, mode })
  const url = `/api/colaboradores/${id}/dossie/aditivos`

  async function generate() {
    setBusy(true); setErrors([])
    try {
      await api(url, { body: body('generate') })
      toast('success', 'Aditivo gerado. O histórico do colaborador foi atualizado.')
      setConfirm(false); onClose(); await reload(); goTo('aditivos')
    } catch (e) {
      setConfirm(false)
      const list = (e as { details?: string[] }).details
      setErrors(list?.length ? list : [errorMessage(e)])
    } finally { setBusy(false) }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Novo aditivo de contrato" size="lg">
        <div className="p-5 space-y-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Tipo de alteração <span className="text-red-500">*</span></span>
            <select value={tipo} onChange={(e) => { setTipo(e.target.value); setNovo('') }} className={inputCls}>
              <option value="">Selecione o que será alterado…</option>
              {catalog.aditivo.tipos.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>

          {meta && (
            <>
              {meta.livre && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium text-gray-700">Cláusula / benefício alterado <span className="text-red-500">*</span></span>
                    <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Vale-alimentação" className={inputCls} />
                  </label>
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium text-gray-700">Informação anterior (opcional)</span>
                    <input value={anteriorLivre} onChange={(e) => setAnteriorLivre(e.target.value)} className={inputCls} />
                  </label>
                </div>
              )}
              <div className="grid sm:grid-cols-[1fr_auto_1fr] items-end gap-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Informação atual</p>
                  <p className="text-sm text-gray-900 mt-1 break-words">{atualLabel}</p>
                </div>
                <ArrowRight className="hidden sm:block w-4 h-4 text-gray-400 mb-4" />
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#0d8c83] uppercase tracking-wide">Nova informação <span className="text-red-500">*</span></span>
                  <input value={novo} onChange={(e) => setNovo(e.target.value)} type={isMoney ? 'number' : 'text'} step={isMoney ? '0.01' : undefined} placeholder={isMoney ? '0,00' : ''} className={inputCls} />
                </label>
              </div>
              {novo && <p className="text-xs text-gray-500 -mt-2">Ficará registrado: <strong>{atualLabel}</strong> → <strong>{novoLabel}</strong></p>}
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-gray-700">Data de vigência <span className="text-red-500">*</span></span>
                  <input type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} className={inputCls} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-gray-700">Motivo <span className="text-red-500">*</span></span>
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Promoção interna" className={inputCls} />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Cláusulas / observações do aditivo</span>
                <textarea rows={3} value={clausulas} onChange={(e) => setClausulas(e.target.value)} className={inputCls} />
              </label>
              <p className="text-xs text-gray-400">O aditivo será registrado como um novo documento (com assinaturas do representante da BHCL, do colaborador e de duas testemunhas). Aditivos anteriores nunca são sobrescritos.</p>
            </>
          )}

          {errors.length > 0 && <Notice tone="danger"><ul className="list-disc pl-4 space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Notice>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="outline" size="sm" disabled={!meta || busy} onClick={() => previewPdf('Pré-visualização — Aditivo contratual', () => fetchPdf(url, body('preview'), 'aditivo.pdf'), [{ label: 'Gerar PDF', onClick: () => setConfirm(true) }])}>Visualizar documento</Button>
            <Button size="sm" disabled={!meta || busy} onClick={() => setConfirm(true)}>Gerar aditivo</Button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        open={confirm} title="Confirmar geração do aditivo?" busy={busy} confirmLabel="Gerar aditivo"
        message={<><p>Alteração de <strong>{meta?.label}</strong>: <strong>{atualLabel}</strong> → <strong>{novoLabel}</strong>, vigente a partir de {vigencia ? new Date(vigencia + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}.</p><p>Após finalizado, os dados históricos deste documento não serão alterados automaticamente.</p></>}
        onCancel={() => setConfirm(false)} onConfirm={generate}
      />
    </>
  )
}
