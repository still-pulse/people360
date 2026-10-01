'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, Eye, FileBadge, History, Printer, RefreshCw } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { BadgePreview, type BadgePreviewData } from './BadgePreview'

type HistoryItem = { id: string; versao: number; observacao?: string | null; geradoEm?: string | null; createdAt: string; criadoPorNome?: string | null }
type Payload = { employee: { id: string; name: string }; preview: BadgePreviewData; missing: string[]; current: HistoryItem | null; history: HistoryItem[] }

const fields: { key: keyof BadgePreviewData; label: string; wide?: boolean; required?: boolean }[] = [
  { key: 'firstName', label: 'Nome no crachá' }, { key: 'lastName', label: 'Sobrenome' },
  { key: 'fullName', label: 'Nome completo', wide: true }, { key: 'role', label: 'Cargo no crachá' },
  { key: 'department', label: 'Setor' }, { key: 'admissionDate', label: 'Data de admissão' },
  { key: 'document', label: 'Registro profissional (opcional)', required: false }, { key: 'employeeId', label: 'Matrícula' },
]

export function BadgeManager({ employeeId, employeeName, open, onClose, onGenerated }: { employeeId: string; employeeName: string; open: boolean; onClose: () => void; onGenerated?: () => void }) {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [form, setForm] = useState<BadgePreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    const res = await fetch(`/api/colaboradores/${employeeId}/crachas`)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) setError(body.error || 'Não foi possível carregar o crachá.')
    else { setPayload(body); setForm(body.preview) }
    setLoading(false)
  }, [employeeId])
  useEffect(() => { if (open) void load() }, [open, load])
  const missing = useMemo(() => !form ? [] : fields.filter(({ key, required }) => required !== false && !String(form[key] ?? '').trim()).map(({ label }) => label).concat(form.photoUrl ? [] : ['Foto para o crachá']), [form])
  async function generate() {
    if (!form || missing.length) return
    setGenerating(true); setError('')
    const overrides = Object.fromEntries(fields.map(({ key }) => [key, form[key]]).concat([['photoFocusY', form.photoFocusY]]))
    const res = await fetch(`/api/colaboradores/${employeeId}/crachas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overrides, issueType: payload?.current ? 'SECOND_COPY' : 'INITIAL', reason }) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) setError(body.error || 'Não foi possível gerar o crachá.')
    else { await load(); onGenerated?.(); window.open(body.downloadUrl, '_blank', 'noopener,noreferrer') }
    setGenerating(false)
  }
  return <Modal open={open} onClose={onClose} title={`Crachá de ${employeeName}`} size="xl">
    <div className="p-5 space-y-6">
      {loading ? <div className="py-16 text-center text-sm text-gray-400">Carregando dados do colaborador…</div> : form ? <>
        <BadgePreview data={form} />
        {missing.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>Antes de gerar, confira: {missing.join(', ')}.</span></div>}
        <section><h3 className="text-sm font-semibold text-gray-900 mb-3">Dados desta emissão</h3><div className="grid sm:grid-cols-2 gap-3">
          {fields.map(({ key, label, wide }) => <label key={key} className={wide ? 'sm:col-span-2' : ''}><span className="block text-xs font-medium text-gray-500 mb-1">{label}</span><input value={String(form[key] ?? '')} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={key === 'document' ? 'Ex.: COREN-SP 123456' : undefined} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#15AFA4]/30" />{key === 'document' && <span className="block mt-1 text-[11px] text-gray-400">CPF e RG não são exibidos no crachá.</span>}</label>)}
          <label className="sm:col-span-2"><span className="block text-xs font-medium text-gray-500 mb-1">Enquadramento vertical da foto: {form.photoFocusY}%</span><input type="range" min="0" max="100" value={form.photoFocusY} onChange={(e) => setForm({ ...form, photoFocusY: Number(e.target.value) })} className="w-full accent-[#15AFA4]" /></label>
          {payload?.current && <label className="sm:col-span-2"><span className="block text-xs font-medium text-gray-500 mb-1">Motivo da segunda via</span><select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"><option value="">Não informado</option><option>Perda</option><option>Dano</option><option>Alteração de cargo</option><option>Alteração de nome</option><option>Atualização de foto</option><option>Outro</option></select></label>}
        </div></section>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={onClose}>Fechar</Button><Button onClick={generate} disabled={missing.length > 0} isLoading={generating} icon={<Printer className="w-4 h-4" />}>{payload?.current ? 'Gerar segunda via' : 'Gerar crachá'}</Button></div>
        {payload?.history.length ? <section className="border-t border-gray-100 pt-5"><h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><History className="w-4 h-4" />Histórico de crachás</h3><div className="space-y-2">{payload.history.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 p-3"><div className="flex-1 min-w-[180px]"><p className="text-sm font-semibold text-gray-800">Versão {item.versao} · {item.observacao || (item.versao === 1 ? 'Emissão inicial' : 'Segunda via')}</p><p className="text-xs text-gray-400">{new Date(item.geradoEm || item.createdAt).toLocaleString('pt-BR')} · {item.criadoPorNome || 'Usuário'}</p></div><a href={`/api/crachas/${item.id}/arquivo?inline=1`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" icon={<Eye className="w-3.5 h-3.5" />}>Visualizar</Button></a><a href={`/api/crachas/${item.id}/arquivo`}><Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />}>Baixar</Button></a></div>)}</div></section> : null}
      </> : error ? <p className="text-sm text-red-600 p-3 bg-red-50 rounded-xl">{error}</p> : null}
    </div>
  </Modal>
}
export function BadgeProfileCard({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Payload | null>(null)
  const load = useCallback(() => fetch(`/api/colaboradores/${employeeId}/crachas`).then((r) => r.ok ? r.json() : null).then(setData).catch(() => setData(null)), [employeeId])
  useEffect(() => { void load() }, [load])
  const current = data?.current
  return <><div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><FileBadge className="w-4 h-4" />Crachás</p><p className="text-sm text-gray-600 mt-2">{current ? `Gerado · versão ${current.versao}` : 'Nenhum crachá gerado'}</p>{current && <p className="text-xs text-gray-400 mt-0.5">{new Date(current.geradoEm || current.createdAt).toLocaleString('pt-BR')} · {current.criadoPorNome || 'Usuário'}</p>}</div><div className="flex flex-wrap gap-2">{current && <a href={`/api/crachas/${current.id}/arquivo`}><Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />}>Baixar PDF</Button></a>}<Button size="sm" onClick={() => setOpen(true)} icon={current ? <RefreshCw className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}>{current ? 'Ver e gerar segunda via' : 'Visualizar crachá'}</Button></div></div></div><BadgeManager employeeId={employeeId} employeeName={employeeName} open={open} onClose={() => setOpen(false)} onGenerated={load} /></>
}
