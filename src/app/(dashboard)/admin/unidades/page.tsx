'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit2, Power, Building2, Users, RefreshCw, CheckCircle2 } from 'lucide-react'

interface Unit {
  id: string
  name: string
  color: string
  description?: string | null
  active: boolean
  exibirIndicadores: boolean
  indicadoresAteYear?: number | null
  indicadoresAteMonth?: number | null
}

interface UnitStats {
  unitId: string
  userCount: number
}

const PRESET_COLORS = [
  // Verdes / Teais
  '#15AFA4', '#14B8A6', '#10B981', '#22C55E', '#84CC16', '#06B6D4',
  // Azuis / Roxos
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E',
  // Quentes
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#D97706', '#DC2626',
  // Escuros / Neutros
  '#64748B', '#475569', '#1E293B', '#0F172A', '#7C3AED', '#BE185D',
]

const EMPTY_FORM = {
  name: '',
  color: '#15AFA4',
  description: '',
  active: true,
  exibirIndicadores: true,
  indicadoresAteYear: '' as string | number,
  indicadoresAteMonth: '' as string | number,
}

const MONTH_OPTS = [
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' }, { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' }, { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
]

export default function UnidadesPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editUnit, setEditUnit] = useState<Unit | null>(null)
  const [toggleTarget, setToggleTarget] = useState<Unit | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function loadUnits() {
    setIsLoading(true)
    // busca todas (incluindo inativas) via admin
    const res = await fetch('/api/units?all=true')
    const data = await res.json()
    setUnits(data)

    // stats de usuários por unidade
    const usersRes = await fetch('/api/users')
    const users = await usersRes.json()
    const map: Record<string, number> = {}
    for (const u of users) {
      if (u.unitId) map[u.unitId] = (map[u.unitId] ?? 0) + 1
    }
    setStats(map)
    setIsLoading(false)
  }

  useEffect(() => { loadUnits() }, [])

  function validate() {
    if (!form.name.trim()) return 'Nome é obrigatório.'
    if (!form.color) return 'Selecione uma cor.'
    const hasYear = form.indicadoresAteYear !== '' && form.indicadoresAteYear != null
    const hasMonth = form.indicadoresAteMonth !== '' && form.indicadoresAteMonth != null
    if (hasYear !== hasMonth) {
      return 'Informe mês e ano do limite juntos, ou deixe ambos em branco (sem limite).'
    }
    return ''
  }

  async function handleSave() {
    const err = validate()
    if (err) { setFormError(err); return }
    setFormError('')
    setIsSaving(true)

    const url = editUnit ? `/api/units/${editUnit.id}` : '/api/units'
    const method = editUnit ? 'PUT' : 'POST'
    const ateYear = form.indicadoresAteYear === '' || form.indicadoresAteYear == null
      ? null
      : Number(form.indicadoresAteYear)
    const ateMonth = form.indicadoresAteMonth === '' || form.indicadoresAteMonth == null
      ? null
      : Number(form.indicadoresAteMonth)

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        color: form.color,
        description: form.description || null,
        active: form.active,
        exibirIndicadores: form.exibirIndicadores,
        indicadoresAteYear: ateYear,
        indicadoresAteMonth: ateMonth,
      }),
    })

    setIsSaving(false)
    if (res.ok) {
      setModalOpen(false)
      setEditUnit(null)
      loadUnits()
    } else {
      const data = await res.json()
      setFormError(data.error || 'Erro ao salvar unidade.')
    }
  }

  async function handleToggle() {
    if (!toggleTarget) return
    await fetch(`/api/units/${toggleTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...toggleTarget, active: !toggleTarget.active }),
    })
    setConfirmOpen(false)
    setToggleTarget(null)
    loadUnits()
  }

  function openNew() {
    setEditUnit(null)
    setForm({ ...EMPTY_FORM })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(unit: Unit) {
    setEditUnit(unit)
    setForm({
      name: unit.name,
      color: unit.color,
      description: unit.description ?? '',
      active: unit.active,
      exibirIndicadores: unit.exibirIndicadores ?? true,
      indicadoresAteYear: unit.indicadoresAteYear ?? '',
      indicadoresAteMonth: unit.indicadoresAteMonth ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const activeUnits = units.filter((u) => u.active)
  const inactiveUnits = units.filter((u) => !u.active)

  return (
    <>
      <Header title="Gestão de Unidades" subtitle="Cadastro e configuração das unidades monitoradas" />
      <div className="p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#15AFA4]/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[#15AFA4]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{units.length}</p>
                  <p className="text-xs text-gray-500">Total de unidades</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{activeUnits.length}</p>
                  <p className="text-xs text-gray-500">Unidades ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {Object.values(stats).reduce((a, b) => a + b, 0)}
                  </p>
                  <p className="text-xs text-gray-500">Analistas vinculados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grid de unidades ativas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Unidades Ativas</h2>
            <div className="flex gap-2">
              <button onClick={loadUnits} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
              <Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>
                Nova Unidade
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-40 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {activeUnits.map((unit) => (
                <div key={unit.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  {/* Topo colorido */}
                  <div className="h-2" style={{ background: unit.color }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: unit.color + '20' }}>
                          <Building2 className="w-5 h-5" style={{ color: unit.color }} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{unit.name}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            <Badge variant="success">Ativa</Badge>
                            {unit.indicadoresAteYear && unit.indicadoresAteMonth ? (
                              <Badge variant="secondary">
                                Indic. até {MONTH_OPTS.find((m) => m.value === String(unit.indicadoresAteMonth))?.label.slice(0, 3)}/{unit.indicadoresAteYear}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    {unit.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{unit.description}</p>
                    )}

                    <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-500">
                      <div className="w-4 h-4 rounded" style={{ background: unit.color }} />
                      <span className="font-mono">{unit.color}</span>
                      <span className="ml-auto flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {stats[unit.id] ?? 0} analista{(stats[unit.id] ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" icon={<Edit2 className="w-3.5 h-3.5" />}
                        className="flex-1" onClick={() => openEdit(unit)}>
                        Editar
                      </Button>
                      <button
                        onClick={() => { setToggleTarget(unit); setConfirmOpen(true) }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors border border-red-100"
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Card adicionar */}
              <button onClick={openNew}
                className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-5 flex flex-col items-center justify-center gap-2 hover:border-[#15AFA4] hover:bg-teal-50/20 transition-all group min-h-[160px]">
                <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-[#15AFA4]/10 flex items-center justify-center transition-colors">
                  <Plus className="w-5 h-5 text-gray-400 group-hover:text-[#15AFA4]" />
                </div>
                <p className="text-sm font-medium text-gray-400 group-hover:text-[#15AFA4]">Nova Unidade</p>
              </button>
            </div>
          )}
        </div>

        {/* Tabela completa */}
        <Card>
          <CardHeader>
            <CardTitle>Todas as Unidades</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>
                  {['Cor', 'Nome', 'Descrição', 'Analistas', 'Status', 'Ações'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {units.map((unit) => (
                  <tr key={unit.id} className={`hover:bg-gray-50/50 ${!unit.active ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="w-8 h-8 rounded-lg" style={{ background: unit.color }} />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{unit.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                      {unit.description || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        {stats[unit.id] ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={unit.active ? 'success' : 'secondary'}>
                        {unit.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => openEdit(unit)}>
                          Editar
                        </Button>
                        <button
                          onClick={() => { setToggleTarget(unit); setConfirmOpen(true) }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            unit.active ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {unit.active ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditUnit(null) }}
        title={editUnit ? `Editar — ${editUnit.name}` : 'Nova Unidade'}
        size="md"
      >
        <div className="p-6 space-y-4">
          <Input
            label="Nome da unidade *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: UPA Cumbica"
          />
          <Input
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descrição opcional da unidade"
          />

          {/* Cor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Cor de identificação *</label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className="relative w-full aspect-square rounded-xl transition-transform hover:scale-110"
                  style={{ background: color }}
                >
                  {form.color === color && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* Input de cor personalizada */}
            <div className="flex items-center gap-3 mt-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-1"
              />
              <div className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono text-gray-600 bg-gray-50">
                {form.color}
              </div>
              {/* Preview */}
              <div className="w-10 h-10 rounded-xl border border-gray-100 flex items-center justify-center"
                style={{ background: form.color }}>
                <Building2 className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {editUnit && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="unitActive" checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 accent-[#15AFA4] rounded" />
                <label htmlFor="unitActive" className="text-sm text-gray-700">Unidade ativa</label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="unitIndicadores" checked={form.exibirIndicadores}
                onChange={(e) => setForm({ ...form, exibirIndicadores: e.target.checked })}
                className="w-4 h-4 accent-[#15AFA4] rounded" />
              <label htmlFor="unitIndicadores" className="text-sm text-gray-700">
                Exibir nos Indicadores (PCD, Aprendiz, Turnover, Absenteísmo)
              </label>
            </div>
            {form.exibirIndicadores && (
              <div className="pl-6 space-y-2">
                <p className="text-xs text-gray-500">
                  Opcional: último mês no indicador. Depois disso some das telas atuais, mas o histórico até a data permanece (ex.: Osasco até jul/2026).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mês limite</label>
                    <select
                      value={String(form.indicadoresAteMonth ?? '')}
                      onChange={(e) => setForm({ ...form, indicadoresAteMonth: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#15AFA4]"
                    >
                      <option value="">Sem limite</option>
                      {MONTH_OPTS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ano limite</label>
                    <input
                      type="number"
                      min={2020}
                      max={2100}
                      placeholder="Ex: 2026"
                      value={form.indicadoresAteYear}
                      onChange={(e) => setForm({ ...form, indicadoresAteYear: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#15AFA4]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {formError}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button className="flex-1" isLoading={isSaving} onClick={handleSave}>
              {editUnit ? 'Salvar Alterações' : 'Criar Unidade'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm toggle */}
      <Modal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setToggleTarget(null) }}
        title={toggleTarget?.active ? 'Desativar Unidade' : 'Ativar Unidade'}
        size="sm"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl"
            style={{ background: (toggleTarget?.color ?? '#15AFA4') + '15' }}>
            <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ background: toggleTarget?.color }}>
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{toggleTarget?.name}</p>
              {toggleTarget?.description && (
                <p className="text-xs text-gray-500 mt-0.5">{toggleTarget.description}</p>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600">
            {toggleTarget?.active
              ? 'Desativar esta unidade irá ocultá-la dos filtros e dashboards, mas os dados históricos serão preservados.'
              : 'Reativar esta unidade a tornará visível novamente em todos os módulos.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button className="flex-1"
              style={{ background: toggleTarget?.active ? '#EF4444' : undefined }}
              onClick={handleToggle}>
              {toggleTarget?.active ? 'Desativar' : 'Ativar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
