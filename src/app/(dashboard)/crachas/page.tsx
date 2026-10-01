'use client'

import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Building2, ChevronLeft, ChevronRight, Download, Eye, Search, User } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeManager } from '@/components/badges/BadgeManager'

type Row = { id: string; employeeName: string; matricula?: string | null; designation?: string | null; department?: string | null; unit?: { id: string; name: string } | null; photoUrl?: string | null; badgeStatus: 'NOT_GENERATED'|'GENERATED'|'UPDATE_REQUIRED'; lastBadge?: { id: string; version: number; generatedAt: string } | null }
type Response = { data: Row[]; total: number; page: number; pages: number; units: { id: string; name: string }[] }
const labels = { NOT_GENERATED: 'Não gerado', GENERATED: 'Gerado', UPDATE_REQUIRED: 'Atualização necessária' }
const colors = { NOT_GENERATED: 'bg-gray-100 text-gray-600', GENERATED: 'bg-green-50 text-green-700', UPDATE_REQUIRED: 'bg-amber-50 text-amber-700' }

export default function BadgesPage() {
  const [result, setResult] = useState<Response | null>(null)
  const [search, setSearch] = useState('')
  const [unitId, setUnitId] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Row | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '25' }); if (search) params.set('search', search); if (unitId) params.set('unitId', unitId)
    const res = await fetch(`/api/crachas?${params}`); if (res.ok) setResult(await res.json()); setLoading(false)
  }, [page, search, unitId])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])
  return <><Header title="Crachás" subtitle="Geração e histórico de crachás dos colaboradores" /><div className="p-4 sm:p-6 space-y-5 max-w-7xl">
    <div className="grid sm:grid-cols-3 gap-3"><Card className="p-4"><p className="text-xs text-gray-500">Colaboradores encontrados</p><p className="text-2xl font-bold text-gray-900 mt-1">{result?.total ?? '—'}</p></Card><Card className="p-4 sm:col-span-2 flex items-center gap-3 text-sm text-gray-600"><BadgeCheck className="w-8 h-8 text-[#15AFA4]" /><span>O PDF definitivo é criado somente ao confirmar a emissão e fica arquivado no perfil do colaborador.</span></Card></div>
    <div className="flex flex-wrap gap-3"><div className="relative flex-1 min-w-[240px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar nome, matrícula, cargo ou setor…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#15AFA4]/30" /></div><select value={unitId} onChange={(e) => { setUnitId(e.target.value); setPage(1) }} className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"><option value="">Todas as unidades</option>{result?.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div>
    <Card className="overflow-hidden">{loading ? <div className="p-12 text-center text-sm text-gray-400">Carregando colaboradores…</div> : !result?.data.length ? <div className="p-12 text-center text-sm text-gray-500">Nenhum colaborador encontrado.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-gray-50/80 text-left text-xs uppercase tracking-wide text-gray-500"><th className="px-4 py-3">Foto</th><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Cargo / Setor</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Status do crachá</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody>{result.data.map((row) => <tr key={row.id} className="border-b border-gray-50 hover:bg-[#15AFA4]/5"><td className="px-4 py-3">{row.photoUrl ? <img src={row.photoUrl} alt="" className="w-10 h-10 rounded-xl object-cover" /> : <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center"><User className="w-5 h-5" /></div>}</td><td className="px-4 py-3"><p className="font-semibold text-gray-900">{row.employeeName}</p><p className="text-xs text-gray-400 font-mono">{row.matricula || 'Sem matrícula'}</p></td><td className="px-4 py-3"><p className="text-gray-700">{row.designation || '—'}</p><p className="text-xs text-gray-400">{row.department || '—'}</p></td><td className="px-4 py-3"><span className="inline-flex gap-1.5 items-center text-gray-600"><Building2 className="w-3.5 h-3.5 text-gray-400" />{row.unit?.name || '—'}</span></td><td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${colors[row.badgeStatus]}`}>{labels[row.badgeStatus]}</span>{row.lastBadge && <p className="text-[11px] text-gray-400 mt-1">Versão {row.lastBadge.version} · {new Date(row.lastBadge.generatedAt).toLocaleDateString('pt-BR')}</p>}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setSelected(row)} icon={<Eye className="w-3.5 h-3.5" />}>Visualizar</Button>{row.lastBadge && <a href={`/api/crachas/${row.lastBadge.id}/arquivo`}><Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />}>PDF</Button></a>}</div></td></tr>)}</tbody></table></div>}
      {result && result.pages > 1 && <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500"><span>{result.total} registro(s) · página {result.page}/{result.pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></Button><Button variant="outline" size="sm" disabled={page >= result.pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></Button></div></div>}
    </Card>
  </div>{selected && <BadgeManager employeeId={selected.id} employeeName={selected.employeeName} open onClose={() => setSelected(null)} onGenerated={load} />}</>
}
