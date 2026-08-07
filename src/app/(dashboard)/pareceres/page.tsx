'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus, Search, Edit2, Trash2, Eye, RefreshCw, FileSpreadsheet, ClipboardCheck,
} from 'lucide-react'
import {
  ParecerData,
  PARECER_RESULTADO_LABELS,
  PARECER_RESULTADO_COLORS,
  TIPO_VINCULO_PARECER_LABELS,
  type ParecerResultado,
} from '@/types'
import { formatDate } from '@/lib/utils'
import { buildTypeCode } from '@/components/pareceres/TraitBars'

export default function PareceresPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const canEdit = session?.user?.role !== 'JURIDICO'
  const isAdmin = session?.user?.role === 'ADMIN'

  const [pareceres, setPareceres] = useState<ParecerData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterResultado, setFilterResultado] = useState('')

  async function load() {
    setIsLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterResultado) params.set('resultado', filterResultado)
    const res = await fetch(`/api/pareceres?${params}`)
    const data = await res.json()
    setPareceres(Array.isArray(data) ? data : [])
    setIsLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterResultado])

  const filtered = useMemo(() => {
    if (!search.trim()) return pareceres
    const q = search.toLowerCase()
    return pareceres.filter(
      (p) =>
        p.candidatoNome.toLowerCase().includes(q) ||
        p.cargo.toLowerCase().includes(q) ||
        (p.unit?.name ?? '').toLowerCase().includes(q)
    )
  }, [pareceres, search])

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir o parecer de "${nome}"?`)) return
    const res = await fetch(`/api/pareceres/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || 'Erro ao excluir')
      return
    }
    load()
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const rows = filtered.map((p) => ({
      Candidato: p.candidatoNome,
      Cargo: p.cargo,
      Unidade: p.unit?.name ?? '',
      'Data Avaliação': formatDate(p.dataAvaliacao),
      Vínculo: TIPO_VINCULO_PARECER_LABELS[p.tipoVinculo],
      Resultado: p.resultado ? PARECER_RESULTADO_LABELS[p.resultado] : '',
      Elaborador: p.elaborador?.name ?? '',
      Tipo: buildTypeCode({
        traitEI: p.traitEI,
        traitNS: p.traitNS,
        traitTF: p.traitTF,
        traitJP: p.traitJP,
        traitAT: p.traitAT,
      }),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pareceres')
    XLSX.writeFile(wb, `pareceres_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <>
      <Header title="Pareceres" subtitle="Parecer de Recrutamento e Seleção (FP.RH.09.001)" />
      <div className="p-6 flex flex-col gap-5">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex flex-1 gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="Buscar candidato ou cargo..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
              />
            </div>
            <select
              value={filterResultado}
              onChange={(e) => setFilterResultado(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4]"
            >
              <option value="">Todos os resultados</option>
              {(Object.keys(PARECER_RESULTADO_LABELS) as ParecerResultado[]).map((k) => (
                <option key={k} value={k}>{PARECER_RESULTADO_LABELS[k]}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
              Atualizar
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={<FileSpreadsheet className="w-3.5 h-3.5" />} onClick={exportExcel}>
              Excel
            </Button>
            {canEdit && (
              <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => router.push('/pareceres/novo')}>
                Novo Parecer
              </Button>
            )}
          </div>
        </div>

        {/* Lista */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-gray-400">Carregando pareceres...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Nenhum parecer encontrado</p>
              {canEdit && (
                <Button className="mt-4" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => router.push('/pareceres/novo')}>
                  Criar primeiro parecer
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Candidato</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Cargo</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Unidade</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Data</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Perfil</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Resultado</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Elaborador</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const typeCode = buildTypeCode({
                      traitEI: p.traitEI,
                      traitNS: p.traitNS,
                      traitTF: p.traitTF,
                      traitJP: p.traitJP,
                      traitAT: p.traitAT,
                    })
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                        onClick={() => router.push(`/pareceres/${p.id}`)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{p.candidatoNome}</p>
                          <p className="text-xs text-gray-400">{TIPO_VINCULO_PARECER_LABELS[p.tipoVinculo]}{p.idade != null ? ` · ${p.idade} anos` : ''}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{p.cargo}</td>
                        <td className="px-4 py-3">
                          {p.unit ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                              <span className="w-2 h-2 rounded-full" style={{ background: p.unit.color }} />
                              {p.unit.name}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(p.dataAvaliacao)}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-900 text-white">
                            {typeCode}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.resultado ? (
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ background: PARECER_RESULTADO_COLORS[p.resultado] }}
                            >
                              {PARECER_RESULTADO_LABELS[p.resultado]}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Pendente</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{p.elaborador?.name ?? '—'}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="p-2 rounded-lg text-gray-400 hover:text-[#15AFA4] hover:bg-[#15AFA4]/10"
                              title="Visualizar"
                              onClick={() => router.push(`/pareceres/${p.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canEdit && (
                              <button
                                className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                title="Editar"
                                onClick={() => router.push(`/pareceres/${p.id}/editar`)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {(isAdmin || p.elaborador?.id === session?.user?.id) && canEdit && (
                              <button
                                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                                title="Excluir"
                                onClick={() => handleDelete(p.id, p.candidatoNome)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
