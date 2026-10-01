'use client'

import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Building2, ChevronLeft, ChevronRight, Download, Eye, FolderArchive, Search, User } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { BadgeManager } from '@/components/badges/BadgeManager'

type Row = { id: string; employeeName: string; matricula?: string | null; designation?: string | null; department?: string | null; unit?: { id: string; name: string } | null; photoUrl?: string | null; badgeStatus: 'NOT_GENERATED'|'GENERATED'|'UPDATE_REQUIRED'; lastBadge?: { id: string; version: number; generatedAt: string } | null }
type Response = { data: Row[]; total: number; page: number; pages: number; units: { id: string; name: string }[] }
type BatchResult = { generated: number; reused: number; skipped: number }
const labels = { NOT_GENERATED: 'Não gerado', GENERATED: 'Gerado', UPDATE_REQUIRED: 'Atualização necessária' }
const colors = { NOT_GENERATED: 'bg-gray-100 text-gray-600', GENERATED: 'bg-green-50 text-green-700', UPDATE_REQUIRED: 'bg-amber-50 text-amber-700' }

export default function BadgesPage() {
  const [result, setResult] = useState<Response | null>(null)
  const [search, setSearch] = useState('')
  const [unitId, setUnitId] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Row | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '25' }); if (search) params.set('search', search); if (unitId) params.set('unitId', unitId)
    const res = await fetch(`/api/crachas?${params}`); if (res.ok) setResult(await res.json()); setLoading(false)
  }, [page, search, unitId])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])
  const selectedUnit = result?.units.find((unit) => unit.id === unitId)
  async function downloadBatch() {
    if (!unitId || batchLoading) return
    setBatchLoading(true); setBatchError(''); setBatchResult(null)
    try {
      const res = await fetch('/api/crachas/lote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId }) })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Não foi possível gerar o lote de crachás.')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'crachas.zip'
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setBatchResult({
        generated: Number(res.headers.get('X-Badges-Generated') || 0),
        reused: Number(res.headers.get('X-Badges-Reused') || 0),
        skipped: Number(res.headers.get('X-Badges-Skipped') || 0),
      })
      await load()
    } catch (batchFailure) {
      setBatchError(batchFailure instanceof Error ? batchFailure.message : 'Não foi possível gerar o lote de crachás.')
    } finally { setBatchLoading(false) }
  }
  return <><Header title="Crachás" subtitle="Geração e histórico de crachás dos colaboradores" /><div className="p-4 sm:p-6 space-y-5 max-w-7xl">
    <div className="grid sm:grid-cols-3 gap-3"><Card className="p-4"><p className="text-xs text-gray-500">Colaboradores encontrados</p><p className="text-2xl font-bold text-gray-900 mt-1">{result?.total ?? '—'}</p></Card><Card className="p-4 sm:col-span-2 flex items-center gap-3 text-sm text-gray-600"><BadgeCheck className="w-8 h-8 text-[#15AFA4]" /><span>O PDF definitivo é criado somente ao confirmar a emissão e fica arquivado no perfil do colaborador.</span></Card></div>
    <div className="flex flex-wrap gap-3"><div className="relative flex-1 min-w-[240px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar nome, matrícula, cargo ou setor…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#15AFA4]/30" /></div><select value={unitId} onChange={(e) => { setUnitId(e.target.value); setPage(1); setBatchResult(null); setBatchError('') }} className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"><option value="">Todas as unidades</option>{result?.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select><Button disabled={!unitId} onClick={() => setBatchOpen(true)} icon={<FolderArchive className="w-4 h-4" />}>Gerar lote da unidade</Button></div>
    <Card className="overflow-hidden">{loading ? <div className="p-12 text-center text-sm text-gray-400">Carregando colaboradores…</div> : !result?.data.length ? <div className="p-12 text-center text-sm text-gray-500">Nenhum colaborador encontrado.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-gray-50/80 text-left text-xs uppercase tracking-wide text-gray-500"><th className="px-4 py-3">Foto</th><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Cargo / Setor</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Status do crachá</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody>{result.data.map((row) => <tr key={row.id} className="border-b border-gray-50 hover:bg-[#15AFA4]/5"><td className="px-4 py-3">{row.photoUrl ? <img src={row.photoUrl} alt="" className="w-10 h-10 rounded-xl object-cover" /> : <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center"><User className="w-5 h-5" /></div>}</td><td className="px-4 py-3"><p className="font-semibold text-gray-900">{row.employeeName}</p><p className="text-xs text-gray-400 font-mono">{row.matricula || 'Sem matrícula'}</p></td><td className="px-4 py-3"><p className="text-gray-700">{row.designation || '—'}</p><p className="text-xs text-gray-400">{row.department || '—'}</p></td><td className="px-4 py-3"><span className="inline-flex gap-1.5 items-center text-gray-600"><Building2 className="w-3.5 h-3.5 text-gray-400" />{row.unit?.name || '—'}</span></td><td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${colors[row.badgeStatus]}`}>{labels[row.badgeStatus]}</span>{row.lastBadge && <p className="text-[11px] text-gray-400 mt-1">Versão {row.lastBadge.version} · {new Date(row.lastBadge.generatedAt).toLocaleDateString('pt-BR')}</p>}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setSelected(row)} icon={<Eye className="w-3.5 h-3.5" />}>Visualizar</Button>{row.lastBadge && <a href={`/api/crachas/${row.lastBadge.id}/arquivo`}><Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />}>PDF</Button></a>}</div></td></tr>)}</tbody></table></div>}
      {result && result.pages > 1 && <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500"><span>{result.total} registro(s) · página {result.page}/{result.pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></Button><Button variant="outline" size="sm" disabled={page >= result.pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></Button></div></div>}
    </Card>
  </div>{selected && <BadgeManager employeeId={selected.id} employeeName={selected.employeeName} open onClose={() => setSelected(null)} onGenerated={load} />}
    <Modal open={batchOpen} onClose={() => { if (!batchLoading) setBatchOpen(false) }} title="Gerar crachás em lote" size="md">
      <div className="p-6 space-y-4">
        <div><p className="text-sm font-semibold text-gray-900">{selectedUnit?.name || 'Unidade selecionada'}</p><p className="text-sm text-gray-500 mt-1">Todos os colaboradores ativos da unidade serão processados, independentemente da busca atual.</p></div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600 space-y-2"><p className="font-medium text-gray-800">Estrutura do arquivo ZIP</p><p>Uma pasta por colaborador, contendo <span className="font-mono text-xs">01-frente.pdf</span> e <span className="font-mono text-xs">02-verso.pdf</span>, ambos em 54 × 86 mm.</p><p>Crachás atualizados serão reutilizados. Os novos ou desatualizados serão emitidos e arquivados no perfil.</p><p>Quando houver dados faltantes, a pasta terá um <span className="font-mono text-xs">PENDENCIA.txt</span>. O resumo geral ficará em <span className="font-mono text-xs">relatorio.csv</span>.</p></div>
        {batchLoading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">Preparando os PDFs e o ZIP. Em unidades maiores, isso pode levar alguns minutos.</div>}
        {batchError && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{batchError}</div>}
        {batchResult && <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">Download iniciado: {batchResult.generated} gerado(s), {batchResult.reused} reutilizado(s) e {batchResult.skipped} com pendência(s).</div>}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={batchLoading} onClick={() => setBatchOpen(false)}>{batchResult ? 'Concluir' : 'Cancelar'}</Button>{!batchResult && <Button isLoading={batchLoading} onClick={() => void downloadBatch()} icon={<Download className="w-4 h-4" />}>Gerar e baixar ZIP</Button>}</div>
      </div>
    </Modal>
  </>
}
