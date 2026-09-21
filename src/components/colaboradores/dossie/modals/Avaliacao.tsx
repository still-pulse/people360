'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { api, errorMessage } from '../api'
import { useDossie } from '../context'
import { ConfirmModal, inputCls, Notice, toInput } from '../parts'

type Resposta = { valor?: string; comentario?: string }
type Props = { open: boolean; input: { tipo: 'GERENCIAL' | 'AUTOAVALIACAO'; dias?: number; id?: string } | null; onClose: () => void }

function Choice({ name, options, value, onChange }: { name: string; options: { valor: string; rotulo: string }[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label key={o.valor} className={`cursor-pointer select-none rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${value === o.valor ? 'border-[#15AFA4] bg-[#15AFA4]/10 text-[#0d8c83]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
          <input type="radio" name={name} value={o.valor} checked={value === o.valor} onChange={() => onChange(o.valor)} className="sr-only" />{o.rotulo}
        </label>
      ))}
    </div>
  )
}

/** Avaliação gerencial (45/90 dias ou período livre) e autoavaliação, com critérios vindos do modelo configurado. */
export function AvaliacaoModal({ open, input, onClose }: Props) {
  const { id, catalog, overview, reload, toast } = useDossie()
  const isSelf = input?.tipo === 'AUTOAVALIACAO'
  const modelo = catalog.avaliacao.gerencial
  const auto = catalog.avaliacao.autoavaliacao
  const [dias, setDias] = useState<string>('45')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [avaliador, setAvaliador] = useState('')
  const [data, setData] = useState('')
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({})
  const [parecer, setParecer] = useState('')
  const [decisao, setDecisao] = useState('')
  const [obs, setObs] = useState('')
  const [readOnly, setReadOnly] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const applyPeriod = (value: string) => {
    setDias(value)
    const s = catalog.avaliacao.sugestoes[value]
    if (s) { setInicio(toInput(s.inicio)); setFim(toInput(s.fim)) }
  }

  useEffect(() => {
    if (!open || !input) return
    setErrors([]); setConfirm(false); setReadOnly(false)
    const base = `/api/colaboradores/${id}/dossie/avaliacoes`
    if (input.id) {
      api<{ periodoDias: number | null; periodoInicio: string | null; periodoFim: string | null; avaliadorNome: string | null; respostas: (Resposta & { id: string })[]; parecer: string | null; decisao: string | null; observacoes: string | null; dataAvaliacao: string; status: string }>(`${base}/${input.id}`)
        .then((row) => {
          setDias(row.periodoDias ? String(row.periodoDias) : 'custom'); setInicio(toInput(row.periodoInicio)); setFim(toInput(row.periodoFim))
          setAvaliador(row.avaliadorNome ?? ''); setData(toInput(row.dataAvaliacao)); setParecer(row.parecer ?? ''); setDecisao(row.decisao ?? ''); setObs(row.observacoes ?? '')
          setRespostas(Object.fromEntries(row.respostas.map((r) => [r.id, { valor: r.valor, comentario: r.comentario }]))); setReadOnly(row.status !== 'RASCUNHO')
        }).catch((e) => setErrors([errorMessage(e)]))
      return
    }
    setRespostas({}); setParecer(''); setDecisao(''); setObs(''); setAvaliador(input.tipo === 'GERENCIAL' ? overview.colaborador.gestor : ''); setData(new Date().toISOString().slice(0, 10))
    const d = String(input.dias ?? 45)
    setDias(d)
    const s = catalog.avaliacao.sugestoes[d]
    setInicio(toInput(s?.inicio)); setFim(toInput(s?.fim))
  }, [open, input, id, catalog, overview.colaborador.gestor])

  const answered = useMemo(() => {
    if (isSelf) return auto.perguntas.filter((q) => (q.tipo === 'texto' ? respostas[q.id]?.comentario : respostas[q.id]?.valor)).length
    return modelo.criterios.filter((c) => respostas[c.id]?.valor).length
  }, [respostas, isSelf, auto, modelo])
  const total = isSelf ? auto.perguntas.length : modelo.criterios.length
  const patch = (key: string, p: Resposta) => setRespostas((r) => ({ ...r, [key]: { ...r[key], ...p } }))

  async function save(finalizar: boolean) {
    if (!input) return
    setBusy(true); setErrors([])
    try {
      const body = {
        tipo: input.tipo, periodoDias: dias === 'custom' ? null : Number(dias), periodoInicio: inicio || null, periodoFim: fim || null, avaliadorNome: avaliador || null,
        respostas: Object.entries(respostas).map(([rid, r]) => ({ id: rid, valor: r.valor || undefined, comentario: r.comentario || undefined })),
        parecer: parecer || null, decisao: decisao || null, observacoes: obs || null, dataAvaliacao: data || null, finalizar,
      }
      const base = `/api/colaboradores/${id}/dossie/avaliacoes`
      if (input.id) await api(`${base}/${input.id}`, { method: 'PUT', body })
      else await api(base, { body })
      toast('success', finalizar ? 'Avaliação finalizada e registrada no histórico.' : 'Rascunho da avaliação salvo.')
      setConfirm(false); onClose(); await reload()
    } catch (e) {
      setConfirm(false)
      const list = (e as { details?: string[] }).details
      setErrors(list?.length ? list : [errorMessage(e)])
    } finally { setBusy(false) }
  }

  if (!input) return null
  return (
    <>
      <Modal open={open} onClose={onClose} title={isSelf ? 'Autoavaliação do colaborador' : 'Avaliação do período de experiência'} size="xl">
        <div className="p-5 space-y-5">
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 grid sm:grid-cols-4 gap-3 text-sm">
            {[['Colaborador', overview.colaborador.nome], ['Matrícula', overview.colaborador.matricula], ['Cargo', overview.colaborador.cargo], ['Unidade', overview.colaborador.unidade]].map(([l, v]) => (
              <div key={l} className="min-w-0"><p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{l}</p><p className="text-gray-900 break-words">{v || '—'}</p></div>
            ))}
          </div>
          {readOnly && <Notice>Esta avaliação já foi finalizada e não pode ser alterada. Para uma nova avaliação, crie um novo registro.</Notice>}

          <div className="grid sm:grid-cols-4 gap-4">
            <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Período avaliado</span>
              <select disabled={readOnly} value={dias} onChange={(e) => e.target.value === 'custom' ? setDias('custom') : applyPeriod(e.target.value)} className={inputCls}>
                {modelo.periodos.map((p) => <option key={p} value={p}>{p} dias</option>)}<option value="custom">Personalizado</option>
              </select></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">De</span><input disabled={readOnly} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={inputCls} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Até</span><input disabled={readOnly} type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={inputCls} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Data da avaliação</span><input disabled={readOnly} type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} /></label>
            {!isSelf && <label className="block space-y-1.5 sm:col-span-4"><span className="text-sm font-medium text-gray-700">Responsável pela avaliação <span className="text-red-500">*</span></span>
              <input disabled={readOnly} value={avaliador} onChange={(e) => setAvaliador(e.target.value)} className={inputCls} /></label>}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{isSelf ? 'Questionário' : 'Critérios de avaliação'}</p>
            <p className="text-xs text-gray-400">{answered} de {total} respondidos</p>
          </div>
          <div className="space-y-3">
            {isSelf ? auto.perguntas.map((q) => (
              <div key={q.id} className="rounded-xl border border-gray-200 p-4 space-y-2.5">
                <p className="text-sm font-medium text-gray-800">{q.rotulo}</p>
                {q.tipo === 'texto'
                  ? <textarea disabled={readOnly} rows={2} value={respostas[q.id]?.comentario ?? ''} onChange={(e) => patch(q.id, { comentario: e.target.value })} className={inputCls} />
                  : <Choice name={q.id} options={q.tipo === 'sim_nao' ? auto.escalaSimNao : auto.escala} value={respostas[q.id]?.valor} onChange={(v) => !readOnly && patch(q.id, { valor: v })} />}
              </div>
            )) : modelo.criterios.map((c, index) => (
              <div key={c.id} className="rounded-xl border border-gray-200 p-4 space-y-2.5">
                <div><p className="text-sm font-semibold text-gray-800">{index + 1}. {c.rotulo}</p><p className="text-xs text-gray-400">{c.descricao}</p></div>
                <Choice name={c.id} options={modelo.escala} value={respostas[c.id]?.valor} onChange={(v) => !readOnly && patch(c.id, { valor: v })} />
                <input disabled={readOnly} value={respostas[c.id]?.comentario ?? ''} onChange={(e) => patch(c.id, { comentario: e.target.value })} placeholder="Comentário do avaliador (opcional)" className={inputCls} />
              </div>
            ))}
          </div>

          <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">{isSelf ? 'Parecer final do colaborador' : 'Parecer do gestor'} <span className="text-red-500">*</span></span>
            <textarea disabled={readOnly} rows={3} value={parecer} onChange={(e) => setParecer(e.target.value)} className={inputCls} /></label>
          {!isSelf && (
            <div className="space-y-2"><p className="text-sm font-medium text-gray-700">Decisão <span className="text-red-500">*</span></p>
              <Choice name="decisao" options={modelo.decisoes} value={decisao} onChange={(v) => !readOnly && setDecisao(v)} /></div>
          )}
          <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Observações</span>
            <textarea disabled={readOnly} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} className={inputCls} /></label>

          {errors.length > 0 && <Notice tone="danger"><ul className="list-disc pl-4 space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Notice>}
          {!readOnly && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => save(false)}>Salvar rascunho</Button>
              <Button size="sm" disabled={busy} onClick={() => setConfirm(true)}>Finalizar avaliação</Button>
            </div>
          )}
        </div>
      </Modal>
      <ConfirmModal open={confirm} title="Finalizar avaliação?" busy={busy} confirmLabel="Finalizar"
        message={<p>Após finalizada, a avaliação não poderá ser editada e será registrada no histórico funcional.</p>}
        onCancel={() => setConfirm(false)} onConfirm={() => save(true)} />
    </>
  )
}
