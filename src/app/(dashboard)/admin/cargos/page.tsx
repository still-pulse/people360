'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Edit2, Power, Briefcase, Search, RefreshCw, Tag, Trash2, X,
  Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import type { PositionData } from '@/types'
import { ADMISSION_MONTHLY_HOURS_OPTIONS } from '@/lib/admission/positions'

export default function CargosPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const [positions, setPositions] = useState<PositionData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [aliasModalOpen, setAliasModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editPosition, setEditPosition] = useState<PositionData | null>(null)
  const [aliasTarget, setAliasTarget] = useState<PositionData | null>(null)
  const [toggleTarget, setToggleTarget] = useState<PositionData | null>(null)

  const [name, setName] = useState('')
  const [categoria, setCategoria] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [salarios, setSalarios] = useState<SalaryRow[]>([])
  const [units, setUnits] = useState<{ id: string; name: string }[]>([])
  const [newAlias, setNewAlias] = useState('')
  const [formError, setFormError] = useState('')
  const [aliasError, setAliasError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function loadPositions() {
    setIsLoading(true)
    const res = await fetch('/api/positions?all=true&aliases=true')
    setPositions(await res.json())
    setIsLoading(false)
  }

  useEffect(() => {
    loadPositions()
    fetch('/api/units').then((r) => r.json()).then((d) => setUnits(Array.isArray(d) ? d : [])).catch(() => setUnits([]))
  }, [])

  const filtered = useMemo(() => {
    return positions.filter((p) => {
      if (search) {
        const q = search.toLowerCase()
        const matchName = p.name.toLowerCase().includes(q)
        const matchAlias = p.aliases?.some((a) => a.alias.toLowerCase().includes(q))
        const matchCat = p.categoria?.toLowerCase().includes(q)
        const matchUnit = p.salarios?.some((s) => s.unit?.name.toLowerCase().includes(q))
        if (!matchName && !matchAlias && !matchCat && !matchUnit) return false
      }
      if (filterStatus === 'active' && !p.active) return false
      if (filterStatus === 'inactive' && p.active) return false
      if (filterUnit && !p.salarios?.some((s) => s.unitId === filterUnit || !s.unitId)) return false
      return true
    })
  }, [positions, search, filterStatus, filterUnit])

  // Uma linha por cargo + unidade; cargo sem salário aparece uma vez, sem unidade.
  const rows = useMemo(() => filtered.flatMap((pos): { pos: PositionData; salario: NonNullable<PositionData['salarios']>[number] | null }[] => {
    const salarios = (pos.salarios ?? [])
      .filter((s) => !filterUnit || s.unitId === filterUnit || !s.unitId)
      .slice().sort((a, b) => (a.unitId ? 0 : 1) - (b.unitId ? 0 : 1) || (a.unit?.name ?? '').localeCompare(b.unit?.name ?? '') || (a.cargaHorariaMensal ?? 0) - (b.cargaHorariaMensal ?? 0))
    return salarios.length ? salarios.map((salario) => ({ pos, salario })) : [{ pos, salario: null }]
  }), [filtered, filterUnit])

  async function handleSave() {
    if (!name.trim()) { setFormError('Nome é obrigatório.'); return }
    const used = salarios.filter((s) => s.salario.trim() || s.allUnits || s.unitIds.length)
    if (used.some((s) => !(parseMoney(s.salario) > 0))) { setFormError('Informe salários válidos (ex.: 3.886,36).'); return }
    if (used.some((s) => !s.allUnits && !s.unitIds.length)) { setFormError('Marque ao menos uma unidade para cada salário.'); return }
    const entries = used.flatMap((s) => (s.allUnits ? [null] : s.unitIds).map((unitId) => ({ unitId, cargaHorariaMensal: s.cargaHoraria ? Number(s.cargaHoraria) : null, salario: parseMoney(s.salario) })))
    const unitKeys = entries.map((s) => `${s.unitId ?? '*'}|${s.cargaHorariaMensal ?? '*'}`)
    if (new Set(unitKeys).size !== unitKeys.length) { setFormError('Cada unidade só pode ter um salário por carga horária.'); return }
    setFormError('')
    setIsSaving(true)

    const url = editPosition ? `/api/positions/${editPosition.id}` : '/api/positions'
    const method = editPosition ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(), categoria: categoria.trim() || null,
        departamento: departamento.trim() || null,
        salarios: entries,
      }),
    })

    setIsSaving(false)
    if (res.ok) {
      setModalOpen(false)
      setEditPosition(null)
      setName('')
      setCategoria('')
      setDepartamento('')
      setSalarios([])
      loadPositions()
    } else {
      const data = await res.json()
      setFormError(data.error || 'Erro ao salvar cargo.')
    }
  }

  async function handleToggle() {
    if (!toggleTarget) return
    await fetch(`/api/positions/${toggleTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !toggleTarget.active }),
    })
    setConfirmOpen(false)
    setToggleTarget(null)
    loadPositions()
  }

  async function handleAddAlias() {
    if (!newAlias.trim() || !aliasTarget) { setAliasError('Alias é obrigatório.'); return }
    setAliasError('')
    const res = await fetch(`/api/positions/${aliasTarget.id}/aliases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: newAlias.trim() }),
    })
    if (res.ok) {
      setNewAlias('')
      loadPositions().then(() => {
        setAliasTarget((prev) => positions.find((p) => p.id === prev?.id) ?? prev)
      })
    } else {
      const d = await res.json()
      setAliasError(d.error || 'Erro ao adicionar alias.')
    }
  }

  async function handleRemoveAlias(aliasId: string) {
    if (!aliasTarget) return
    await fetch(`/api/positions/${aliasTarget.id}/aliases`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aliasId }),
    })
    loadPositions()
  }

  async function handleDelete(pos: PositionData) {
    if (!confirm(`Excluir o cargo "${pos.name}"? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/positions/${pos.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || 'Erro ao excluir.')
    } else {
      loadPositions()
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/positions/planilha')
      if (!res.ok) throw new Error()
      downloadBlob(await res.blob(), `cargos-salarios-unidades-${new Date().toLocaleDateString('sv-SE')}.xlsx`)
    } catch {
      alert('Não foi possível exportar a planilha.')
    } finally {
      setExporting(false)
    }
  }

  function openNew() {
    setEditPosition(null)
    setName('')
    setCategoria('')
    setDepartamento('')
    setSalarios([emptySalaryRow()])
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(pos: PositionData) {
    setEditPosition(pos)
    setName(pos.name)
    setCategoria(pos.categoria ?? '')
    setDepartamento(pos.departamento ?? '')
    // Agrupa as unidades com o mesmo salário e a mesma carga horária numa faixa; o padrão fica numa faixa própria por carga.
    const groups = new Map<string, SalaryRow>()
    for (const s of pos.salarios ?? []) {
      const hours = s.cargaHorariaMensal ? String(s.cargaHorariaMensal) : ''
      const key = s.unitId ? `u:${s.salario}:${hours}` : `default:${hours}`
      const row = groups.get(key) ?? { salario: formatMoney(s.salario), cargaHoraria: hours, allUnits: !s.unitId, unitIds: [] }
      if (s.unitId) row.unitIds.push(s.unitId)
      groups.set(key, row)
    }
    const current = Array.from(groups.values()).sort((a, b) => Number(a.allUnits) - Number(b.allUnits))
    setSalarios(current.length ? current : [emptySalaryRow()])
    setFormError('')
    setModalOpen(true)
  }

  function openAliases(pos: PositionData) {
    setAliasTarget(pos)
    setNewAlias('')
    setAliasError('')
    setAliasModalOpen(true)
  }

  // Sync aliasTarget with fresh data after reload
  useEffect(() => {
    if (aliasTarget) {
      const fresh = positions.find((p) => p.id === aliasTarget.id)
      if (fresh) setAliasTarget(fresh)
    }
  }, [positions])

  // Criando um cargo com nome já cadastrado: o servidor soma as unidades ao cargo existente.
  const existingMatch = !editPosition && name.trim()
    ? positions.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null
    : null
  // Unidades que o cargo existente já tem ficam bloqueadas: o salário delas só muda pelo "Editar".
  const existingSalaries = new Map((existingMatch?.salarios ?? []).map((s) => [slotKey(s.unitId, s.cargaHorariaMensal ? String(s.cargaHorariaMensal) : ''), s.salario] as const))

  const stats = {
    total: positions.length,
    active: positions.filter((p) => p.active).length,
    inactive: positions.filter((p) => !p.active).length,
  }

  return (
    <>
      <Header title="Gestão de Cargos" subtitle="Cargos padronizados para vagas e headcount" />
      <div className="p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total de cargos', value: stats.total, color: '#15AFA4', bg: 'bg-[#15AFA4]/10' },
            { label: 'Cargos ativos', value: stats.active, color: '#10B981', bg: 'bg-green-50' },
            { label: 'Cargos inativos', value: stats.inactive, color: '#94A3B8', bg: 'bg-gray-100' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                    <Briefcase className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabela completa */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Todos os Cargos</CardTitle>
              <div className="flex gap-2">
                <button onClick={loadPositions} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <Button variant="outline" icon={<Download className="w-4 h-4" />} isLoading={exporting} onClick={handleExport}>
                  Exportar
                </Button>
                {isAdmin && (
                  <Button variant="outline" icon={<Upload className="w-4 h-4" />} onClick={() => setImportOpen(true)}>
                    Importar
                  </Button>
                )}
                <Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>
                  Novo Cargo
                </Button>
              </div>
            </div>
          </CardHeader>

          <div className="px-5 pb-4 flex gap-3 border-b border-gray-50">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cargo, unidade, alias ou categoria..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4]"
              />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white">
              <option value="">Todos os status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
            <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white">
              <option value="">Todas as unidades</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-100">
                  <tr>
                    {['#', 'Cargo', 'Unidade', 'Carga horária', 'Salário', 'Categoria', 'Aliases', 'Vagas', 'Status', 'Ações'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Nenhum cargo encontrado</td></tr>
                  )}
                  {rows.map(({ pos, salario }, i) => (
                    <tr key={salario?.id ?? pos.id} className={`hover:bg-gray-50/50 ${!pos.active ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-gray-400 text-xs w-8">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${pos.active ? 'bg-[#15AFA4]' : 'bg-gray-300'}`} />
                          <span className="font-medium text-gray-900">{pos.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {salario ? <span className="text-gray-700">{salario.unit?.name ?? 'Todas as unidades'}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {salario?.cargaHorariaMensal ? <span className="text-gray-700">{salario.cargaHorariaMensal}h</span> : salario ? <span className="text-gray-400">Qualquer</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <button onClick={() => openEdit(pos)} className="text-left hover:text-[#15AFA4] transition-colors">
                          {salario ? <span className="text-gray-700 font-medium">R$ {formatMoney(salario.salario)}</span> : <span className="text-gray-300">+ unidade e salário</span>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{pos.categoria || '—'}</td>
                      <td className="px-4 py-3">
                        {pos.aliases && pos.aliases.length > 0 ? (
                          <button onClick={() => openAliases(pos)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                            <Tag className="w-3 h-3" />
                            {pos.aliases.length}
                          </button>
                        ) : (
                          <button onClick={() => openAliases(pos)}
                            className="text-xs text-gray-300 hover:text-amber-500 transition-colors">
                            + alias
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs font-medium">{vagasDaLinha(pos, salario)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={pos.active ? 'success' : 'secondary'}>
                          {pos.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => openEdit(pos)}>
                            Editar
                          </Button>
                          <button
                            onClick={() => { setToggleTarget(pos); setConfirmOpen(true) }}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              pos.active ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            {pos.active ? 'Desativar' : 'Ativar'}
                          </button>
                          {isAdmin && (pos._count?.vagas ?? 0) === 0 && (
                            <button
                              onClick={() => handleDelete(pos)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
              {filtered.length} cargo{filtered.length !== 1 ? 's' : ''} · {rows.length} linha{rows.length !== 1 ? 's' : ''} de unidade e salário
            </div>
          )}
        </Card>
      </div>

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditPosition(null) }}
        title={editPosition ? `Editar — ${editPosition.name}` : 'Novo Cargo'}
        size="lg"
      >
        <div className="p-6 space-y-4">
          <Input
            label="Nome oficial do cargo *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Técnico de Enfermagem"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Unidade e salário</p>
              <p className="text-xs text-gray-400">
                Informe o salário, a carga horária mensal e marque as unidades que o recebem. Para outro valor (outra unidade ou outra carga, ex.: 180h e 200h), adicione outro salário. &quot;Todas as unidades&quot; vale para as unidades sem valor próprio; &quot;Qualquer carga&quot; vale quando não há valor para a carga escolhida na admissão.
              </p>
            </div>
            {salarios.map((row, index) => {
              const update = (patch: Partial<SalaryRow>) => setSalarios((list) => list.map((item, i) => i === index ? { ...item, ...patch } : item))
              // Uma unidade só fica bloqueada se já tiver salário com a MESMA carga horária desta faixa.
              const sameHours = (item: SalaryRow) => item.cargaHoraria === row.cargaHoraria
              const usedElsewhere = new Set(salarios.flatMap((item, i) => i === index || !sameHours(item) ? [] : item.unitIds))
              const defaultElsewhere = salarios.some((item, i) => i !== index && item.allUnits && sameHours(item)) || existingSalaries.has(slotKey(null, row.cargaHoraria))
              const existingFor = (unitId: string) => existingSalaries.get(slotKey(unitId, row.cargaHoraria))
              const available = units.filter((u) => !usedElsewhere.has(u.id) && existingFor(u.id) === undefined)
              return (
                <div key={index} className="rounded-xl border border-gray-200 p-3 space-y-2.5">
                  <div className="flex gap-2 items-center">
                    <div className="relative w-40 shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                      <input
                        inputMode="decimal"
                        aria-label="Salário"
                        value={row.salario}
                        onChange={(e) => update({ salario: e.target.value })}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4]"
                      />
                    </div>
                    <select
                      aria-label="Carga horária mensal"
                      title="Carga horária mensal"
                      value={row.cargaHoraria}
                      onChange={(e) => update({ cargaHoraria: e.target.value, unitIds: [], allUnits: false })}
                      className="w-32 shrink-0 px-2.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white"
                    >
                      <option value="">Qualquer carga</option>
                      {ADMISSION_MONTHLY_HOURS_OPTIONS.map((h) => <option key={h} value={h}>{h}h mensais</option>)}
                    </select>
                    <label className={`flex items-center gap-2 text-xs flex-1 min-w-0 ${defaultElsewhere ? 'text-gray-300' : 'text-gray-600 cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={row.allUnits}
                        disabled={defaultElsewhere}
                        onChange={(e) => update({ allUnits: e.target.checked, unitIds: e.target.checked ? [] : row.unitIds })}
                        className="accent-[#15AFA4]"
                      />
                      Todas as unidades (padrão)
                    </label>
                    <button
                      type="button"
                      aria-label="Remover salário"
                      onClick={() => setSalarios((list) => list.filter((_, i) => i !== index))}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {!row.allUnits && (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{row.unitIds.length ? `${row.unitIds.length} unidade${row.unitIds.length > 1 ? 's' : ''} com este salário` : 'Marque as unidades com este salário'}</span>
                        <div className="flex gap-3">
                          <button type="button" className="text-[#15AFA4] hover:underline" onClick={() => update({ unitIds: available.map((u) => u.id) })}>Marcar todas</button>
                          <button type="button" className="text-gray-400 hover:underline" onClick={() => update({ unitIds: [] })}>Limpar</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 max-h-44 overflow-y-auto pr-1">
                        {units.map((u) => {
                          const existingValue = existingFor(u.id)
                          const taken = usedElsewhere.has(u.id) || existingValue !== undefined
                          return (
                            <label key={u.id} className={`flex items-center gap-2 py-1 text-xs ${taken ? 'text-gray-300' : 'text-gray-700 cursor-pointer'}`} title={existingValue !== undefined ? `Já cadastrada neste cargo com R$ ${formatMoney(existingValue)} — altere pelo Editar` : taken ? 'Já tem salário em outra faixa' : undefined}>
                              <input
                                type="checkbox"
                                disabled={taken}
                                checked={row.unitIds.includes(u.id)}
                                onChange={(e) => update({ unitIds: e.target.checked ? [...row.unitIds, u.id] : row.unitIds.filter((id) => id !== u.id) })}
                                className="accent-[#15AFA4]"
                              />
                              <span className="truncate">{u.name}{existingValue !== undefined ? ` · já tem R$ ${formatMoney(existingValue)}` : ''}</span>
                            </label>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => setSalarios((list) => [...list, emptySalaryRow()])}
              className="flex items-center gap-1.5 text-xs font-medium text-[#15AFA4] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar outro salário
            </button>
          </div>
          <Input
            label="Categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ex: Assistencial, Administrativo... (opcional)"
          />
          <Input
            label="Departamento"
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value)}
            placeholder="Ex: Enfermagem (usado na admissão digital)"
          />


          <p className="text-xs text-gray-400">
            O nome oficial será exibido nos formulários de vaga, headcount e admissão. Use alias para mapear variações antigas.
          </p>
          {existingMatch && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800">
              O cargo <strong>{existingMatch.name}</strong> já existe. Ao salvar, as unidades marcadas serão adicionadas a ele com o salário informado.
              As unidades que ele já tem aparecem bloqueadas e mantêm o salário atual; para alterar uma delas, use Editar.
            </div>
          )}
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{formError}</div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button className="flex-1" isLoading={isSaving} onClick={handleSave}>
              {editPosition ? 'Salvar' : existingMatch ? 'Adicionar ao cargo existente' : 'Criar Cargo'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal aliases */}
      <Modal
        open={aliasModalOpen}
        onClose={() => { setAliasModalOpen(false); setAliasTarget(null) }}
        title={`Aliases — ${aliasTarget?.name}`}
        size="md"
      >
        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-500">
            Aliases são nomes antigos ou variações do cargo. O sistema usa essa lista para reconhecer e agrupar variações durante a migração de dados.
          </p>

          {/* Lista de aliases existentes */}
          {aliasTarget?.aliases && aliasTarget.aliases.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {aliasTarget.aliases.map((a) => (
                <span key={a.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800">
                  <Tag className="w-3 h-3" />
                  {a.alias}
                  {isAdmin && (
                    <button onClick={() => handleRemoveAlias(a.id)}
                      className="ml-0.5 text-amber-400 hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-3">Nenhum alias cadastrado</p>
          )}

          {/* Adicionar alias */}
          {isAdmin && (
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <div className="flex-1">
                <Input
                  label=""
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  placeholder="Ex: Tec. Enfermagem, TÉCNICO DEENFERMAGEM..."
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
                />
                {aliasError && <p className="text-xs text-red-500 mt-1">{aliasError}</p>}
              </div>
              <div className="pt-0 flex items-end pb-0.5">
                <Button onClick={handleAddAlias} icon={<Plus className="w-4 h-4" />}>
                  Adicionar
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setAliasModalOpen(false)}>Fechar</Button>
          </div>
        </div>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={loadPositions} />

      {/* Confirm toggle */}
      <Modal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setToggleTarget(null) }}
        title={toggleTarget?.active ? 'Desativar Cargo' : 'Ativar Cargo'}
        size="sm"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            {toggleTarget?.active
              ? `Desativar "${toggleTarget?.name}"? O cargo não aparecerá mais nos formulários de vaga e headcount, mas os registros históricos são mantidos.`
              : `Reativar "${toggleTarget?.name}"? O cargo voltará a aparecer nos formulários.`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button className="flex-1"
              style={{ background: toggleTarget?.active ? '#F97316' : undefined }}
              onClick={handleToggle}>
              {toggleTarget?.active ? 'Desativar' : 'Ativar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// Uma faixa salarial: um valor para uma carga horária ('' = qualquer), aplicado às unidades marcadas (ou a todas, como padrão).
type SalaryRow = { salario: string; cargaHoraria: string; allUnits: boolean; unitIds: string[] }

function emptySalaryRow(): SalaryRow {
  return { salario: '', cargaHoraria: '', allUnits: false, unitIds: [] }
}

const slotKey = (unitId: string | null, cargaHoraria: string) => `${unitId ?? '*'}|${cargaHoraria || '*'}`

// Aceita "3.886,36", "3886,36" ou "3886.36".
function parseMoney(value: string) {
  const clean = value.replace(/[^\d,.]/g, '')
  return Number(clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean)
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}


// Vagas da linha: da unidade da linha; o salário padrão conta as unidades sem salário próprio; sem salário, o total do cargo.
function vagasDaLinha(pos: PositionData, salario: NonNullable<PositionData['salarios']>[number] | null) {
  const porUnidade = pos.vagasPorUnidade ?? {}
  if (!salario) return pos._count?.vagas ?? 0
  if (salario.unitId) return porUnidade[salario.unitId] ?? 0
  const proprias = new Set((pos.salarios ?? []).map((s) => s.unitId).filter(Boolean))
  return Object.entries(porUnidade).reduce((total, [unitId, count]) => proprias.has(unitId) ? total : total + count, 0)
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type ImportPreview = {
  summary: { cargosNovos: number; cargosAtualizados: number; salariosNovos: number; salariosAtualizados: number; aliasesNovos: number; linhas: number; semAlteracao: number }
  errors: { line: number; message: string }[]
  totalErrors: number
  changes: { name: string; isNew: boolean; fields: string[]; aliases: string[]; salaries: { unit: string; salario: number; previous: number | null }[] }[]
  applied?: boolean
  error?: string
}

const FIELD_LABEL: Record<string, string> = { categoria: 'categoria', departamento: 'departamento', codigoInterno: 'código interno', active: 'status' }

// Importação em duas etapas: o servidor valida e devolve a prévia; só grava após a confirmação.
function ImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  function close() { setFile(null); setPreview(null); setError(''); onClose() }

  async function send(apply: boolean) {
    if (!file) { setError('Selecione a planilha.'); return }
    setBusy(true); setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      if (apply) form.append('apply', 'true')
      const res = await fetch('/api/positions/importar', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({ error: 'Resposta inválida do servidor.' }))
      if (data.summary) setPreview(data)
      if (!res.ok) { setError(data.error || 'Não foi possível processar a planilha.'); return }
      if (apply) onImported()
    } catch {
      setError('Não foi possível enviar a planilha.')
    } finally {
      setBusy(false)
    }
  }

  async function downloadTemplate() {
    setDownloading(true)
    try {
      const res = await fetch('/api/positions/planilha?tipo=modelo')
      if (!res.ok) throw new Error()
      downloadBlob(await res.blob(), 'modelo-importacao-cargos.xlsx')
    } catch {
      setError('Não foi possível baixar o modelo.')
    } finally {
      setDownloading(false)
    }
  }

  const s = preview?.summary
  const hasChanges = !!preview?.changes.length
  const canApply = !!preview && !preview.applied && preview.totalErrors === 0 && hasChanges

  return (
    <Modal open={open} onClose={close} title="Importar cargos e salários" size="lg">
      <div className="p-6 space-y-4 overflow-y-auto">
        {preview?.applied && s ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto"><CheckCircle2 className="w-6 h-6" /></div>
            <p className="font-semibold text-gray-900">Importação concluída</p>
            <p className="text-sm text-gray-500">
              {s.cargosNovos} cargo(s) criado(s), {s.cargosAtualizados} atualizado(s), {s.salariosNovos} salário(s) novo(s) e {s.salariosAtualizados} alterado(s).
            </p>
            <Button onClick={close}>Fechar</Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-[#15AFA4]/20 bg-[#15AFA4]/5 p-4 flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-[#15AFA4] mt-0.5 shrink-0" />
              <div className="text-xs text-gray-600 space-y-1.5 flex-1">
                <p>Uma linha por cargo e unidade. Cargos existentes são atualizados; novos são criados. <strong>Nada é excluído</strong>: salários e aliases que não estiverem na planilha continuam como estão.</p>
                <p>Você também pode usar o arquivo do botão <strong>Exportar</strong>, editar e importar de volta.</p>
                <button type="button" onClick={downloadTemplate} disabled={downloading} className="inline-flex items-center gap-1.5 font-medium text-[#15AFA4] hover:underline disabled:opacity-50">
                  <Download className="w-3.5 h-3.5" /> {downloading ? 'Gerando modelo…' : 'Baixar planilha modelo'}
                </button>
              </div>
            </div>

            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#15AFA4] p-6 cursor-pointer transition-colors">
              <Upload className="w-6 h-6 text-gray-400" />
              <span className="text-sm text-gray-700">{file ? file.name : 'Clique para escolher a planilha (.xlsx)'}</span>
              {file && <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>}
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setError(''); e.target.value = '' }} />
            </label>

            {preview && s && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    ['Cargos novos', s.cargosNovos], ['Cargos atualizados', s.cargosAtualizados],
                    ['Salários novos', s.salariosNovos], ['Salários alterados', s.salariosAtualizados],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-gray-50 px-3 py-2">
                      <p className="text-lg font-bold text-gray-900">{value}</p>
                      <p className="text-[11px] text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  {s.linhas} linha(s) lida(s){s.aliasesNovos ? ` · ${s.aliasesNovos} alias(es) novo(s)` : ''}{s.semAlteracao ? ` · ${s.semAlteracao} cargo(s) sem alteração` : ''}
                </p>

                {preview.totalErrors > 0 && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-3 space-y-1.5">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-red-700"><AlertTriangle className="w-4 h-4" /> {preview.totalErrors} erro(s): corrija a planilha e valide de novo</p>
                    <ul className="max-h-40 overflow-y-auto text-xs text-red-700 space-y-0.5">
                      {preview.errors.map((item, index) => <li key={index}>{item.line ? <strong>Linha {item.line}: </strong> : null}{item.message}</li>)}
                    </ul>
                  </div>
                )}

                {hasChanges && (
                  <div className="rounded-xl border border-gray-100 max-h-56 overflow-y-auto divide-y divide-gray-50">
                    {preview.changes.map((change) => (
                      <div key={change.name} className="px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{change.name}</span>
                          <Badge variant={change.isNew ? 'success' : 'secondary'}>{change.isNew ? 'Novo' : 'Atualizar'}</Badge>
                        </div>
                        <div className="text-gray-500 mt-0.5 space-y-0.5">
                          {change.salaries.map((salary) => (
                            <p key={salary.unit}>
                              {salary.unit}:{' '}
                              {salary.previous !== null && <><span className="line-through text-gray-300">R$ {formatMoney(salary.previous)}</span> → </>}
                              <span className="text-gray-800 font-medium">R$ {formatMoney(salary.salario)}</span>
                            </p>
                          ))}
                          {!change.isNew && change.fields.length > 0 && <p>Altera {change.fields.map((field) => FIELD_LABEL[field] ?? field).join(', ')}</p>}
                          {change.aliases.length > 0 && <p>Novos aliases: {change.aliases.join(', ')}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!hasChanges && preview.totalErrors === 0 && <p className="text-sm text-gray-500 text-center py-2">A planilha não traz nenhuma alteração em relação ao cadastro atual.</p>}
              </div>
            )}

            {error && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={close}>Cancelar</Button>
              {canApply ? (
                <Button className="flex-1" isLoading={busy} onClick={() => send(true)}>Confirmar importação</Button>
              ) : (
                <Button className="flex-1" isLoading={busy} disabled={!file} onClick={() => send(false)}>Validar planilha</Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
