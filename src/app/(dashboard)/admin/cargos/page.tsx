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
} from 'lucide-react'
import type { PositionData } from '@/types'

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
      .slice().sort((a, b) => (a.unitId ? 0 : 1) - (b.unitId ? 0 : 1) || (a.unit?.name ?? '').localeCompare(b.unit?.name ?? ''))
    return salarios.length ? salarios.map((salario) => ({ pos, salario })) : [{ pos, salario: null }]
  }), [filtered, filterUnit])

  async function handleSave() {
    if (!name.trim()) { setFormError('Nome é obrigatório.'); return }
    const filled = salarios.filter((s) => s.salario.trim())
    if (filled.some((s) => !(parseMoney(s.salario) > 0))) { setFormError('Informe salários válidos (ex.: 3.886,36).'); return }
    const unitKeys = filled.map((s) => s.unitId || '*')
    if (new Set(unitKeys).size !== unitKeys.length) { setFormError('Cada unidade só pode ter um salário.'); return }
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
        salarios: filled.map((s) => ({ unitId: s.unitId || null, salario: parseMoney(s.salario) })),
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

  function openNew() {
    setEditPosition(null)
    setName('')
    setCategoria('')
    setDepartamento('')
    setSalarios([{ unitId: '', salario: '' }])
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(pos: PositionData) {
    setEditPosition(pos)
    setName(pos.name)
    setCategoria(pos.categoria ?? '')
    setDepartamento(pos.departamento ?? '')
    const current = (pos.salarios ?? [])
      .slice().sort((a, b) => (a.unitId ? 0 : 1) - (b.unitId ? 0 : 1) || (a.unit?.name ?? '').localeCompare(b.unit?.name ?? ''))
      .map((s) => ({ unitId: s.unitId ?? '', salario: formatMoney(s.salario) }))
    setSalarios(current.length ? current : [{ unitId: '', salario: '' }])
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
                    {['#', 'Cargo', 'Unidade', 'Salário', 'Categoria', 'Aliases', 'Vagas', 'Status', 'Ações'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Nenhum cargo encontrado</td></tr>
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
                      <td className="px-4 py-3 text-gray-600 text-xs font-medium">{pos._count?.vagas ?? 0}</td>
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
        size="md"
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
                Cadastre o salário do cargo em cada unidade. &quot;Todas as unidades&quot; vale para as unidades sem valor próprio.
              </p>
            </div>
            {salarios.map((row, index) => (
              <div key={index} className="flex gap-2 items-center">
                <select
                  value={row.unitId}
                  onChange={(e) => setSalarios((list) => list.map((item, i) => i === index ? { ...item, unitId: e.target.value } : item))}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white"
                >
                  <option value="">Todas as unidades (padrão)</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <div className="relative w-36 shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                  <input
                    inputMode="decimal"
                    value={row.salario}
                    onChange={(e) => setSalarios((list) => list.map((item, i) => i === index ? { ...item, salario: e.target.value } : item))}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4]"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Remover salário"
                  onClick={() => setSalarios((list) => list.filter((_, i) => i !== index))}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSalarios((list) => [...list, { unitId: units.find((u) => !list.some((s) => s.unitId === u.id))?.id ?? '', salario: '' }])}
              className="flex items-center gap-1.5 text-xs font-medium text-[#15AFA4] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar outra unidade
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
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{formError}</div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button className="flex-1" isLoading={isSaving} onClick={handleSave}>
              {editPosition ? 'Salvar' : 'Criar Cargo'}
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

type SalaryRow = { unitId: string; salario: string }

// Aceita "3.886,36", "3886,36" ou "3886.36".
function parseMoney(value: string) {
  const clean = value.replace(/[^\d,.]/g, '')
  return Number(clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean)
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

