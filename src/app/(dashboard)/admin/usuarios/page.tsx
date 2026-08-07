'use client'

import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Edit2, UserX, UserCheck2, Search, Users,
  ShieldCheck, UserCircle, Eye, EyeOff, RefreshCw,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AuditTrail } from '@/components/audit/AuditTrail'

interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'ANALYST' | 'SUPERINTENDENT' | 'GERENTE' | 'JURIDICO'
  active: boolean
  unitId?: string | null
  createdAt: string
  unit?: { id: string; name: string; color: string } | null
  managedUnits?: { unitId: string; unit: { id: string; name: string; color: string } }[]
}

interface Unit { id: string; name: string; color: string }

const roleOptions = [
  { value: 'ANALYST', label: 'Analista de RH' },
  { value: 'SUPERINTENDENT', label: 'Superintendente' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'JURIDICO', label: 'Jurídico' },
  { value: 'ADMIN', label: 'Administrador' },
]

const filterRoleOptions = [
  { value: '', label: 'Todos os perfis' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'SUPERINTENDENT', label: 'Superintendente' },
  { value: 'JURIDICO', label: 'Jurídico' },
  { value: 'ANALYST', label: 'Analista de RH' },
]

const filterStatusOptions = [
  { value: '', label: 'Todos os status' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
]

const EMPTY_FORM = {
  name: '', email: '', password: '', confirmPassword: '',
  role: 'ANALYST', unitIds: [] as string[], active: true,
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [toggleTarget, setToggleTarget] = useState<User | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Filtros
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  async function loadUsers() {
    setIsLoading(true)
    const res = await fetch('/api/users')
    setUsers(await res.json())
    setIsLoading(false)
  }

  useEffect(() => {
    loadUsers()
    fetch('/api/units').then((r) => r.json()).then(setUnits)
  }, [])

  // Filtragem local
  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false
      if (filterRole && u.role !== filterRole) return false
      if (filterUnit && !u.managedUnits?.some(mu => mu.unitId === filterUnit) && u.unitId !== filterUnit) return false
      if (filterStatus === 'active' && !u.active) return false
      if (filterStatus === 'inactive' && u.active) return false
      return true
    })
  }, [users, search, filterRole, filterUnit, filterStatus])

  // Stats
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.active).length,
    admins: users.filter((u) => u.role === 'ADMIN').length,
    analysts: users.filter((u) => u.role === 'ANALYST').length,
  }), [users])

  function validate() {
    if (!form.name.trim()) return 'Nome é obrigatório.'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'E-mail inválido.'
    if (!editUser && !form.password) return 'Senha é obrigatória.'
    if (form.password && form.password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.'
    if (form.password && form.password !== form.confirmPassword) return 'As senhas não coincidem.'
    return ''
  }

  async function handleSave() {
    const err = validate()
    if (err) { setFormError(err); return }
    setFormError('')
    setIsSaving(true)

    const url = editUser ? `/api/users/${editUser.id}` : '/api/users'
    const method = editUser ? 'PUT' : 'POST'
    const body: any = {
      name: form.name,
      email: form.email,
      role: form.role,
      unitIds: form.unitIds,
      active: form.active,
    }
    if (form.password) body.password = form.password

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setIsSaving(false)
    if (res.ok) {
      setModalOpen(false)
      setEditUser(null)
      loadUsers()
    } else {
      const data = await res.json()
      setFormError(data.error || 'Erro ao salvar usuário.')
    }
  }

  async function handleToggle() {
    if (!toggleTarget) return
    const unitIds = toggleTarget.managedUnits?.map(mu => mu.unitId) ?? (toggleTarget.unitId ? [toggleTarget.unitId] : [])
    await fetch(`/api/users/${toggleTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...toggleTarget, unitIds, active: !toggleTarget.active }),
    })
    setConfirmOpen(false)
    setToggleTarget(null)
    loadUsers()
  }

  function openNew() {
    setEditUser(null)
    setForm({ ...EMPTY_FORM })
    setFormError('')
    setShowPassword(false)
    setModalOpen(true)
  }

  function openEdit(user: User) {
    setEditUser(user)
    const existingUnitIds = user.managedUnits?.map(mu => mu.unitId) ?? (user.unitId ? [user.unitId] : [])
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      role: user.role,
      unitIds: existingUnitIds,
      active: user.active,
    })
    setFormError('')
    setShowPassword(false)
    setModalOpen(true)
  }

  const passwordStrength = (pw: string) => {
    if (!pw) return null
    if (pw.length < 6) return { label: 'Fraca', color: '#EF4444', pct: 25 }
    if (pw.length < 8 || !/[0-9]/.test(pw)) return { label: 'Média', color: '#F59E0B', pct: 60 }
    return { label: 'Forte', color: '#10B981', pct: 100 }
  }
  const strength = passwordStrength(form.password)

  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }))
  const unitFilterOptions = [{ value: '', label: 'Todas as unidades' }, ...unitOptions]

  return (
    <>
      <Header title="Gestão de Usuários" subtitle="Cadastro e controle de acessos" />
      <div className="p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total de Usuários', value: stats.total, icon: Users, color: '#15AFA4' },
            { label: 'Usuários Ativos', value: stats.active, icon: UserCheck2, color: '#10B981' },
            { label: 'Administradores', value: stats.admins, icon: ShieldCheck, color: '#8B5CF6' },
            { label: 'Analistas de RH', value: stats.analysts, icon: UserCircle, color: '#3B82F6' },
          ].map((s) => {
            const Icon = s.icon
            return (
              <Card key={s.label}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.color + '15' }}>
                      <Icon className="w-5 h-5" style={{ color: s.color }} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                      <p className="text-xs text-gray-500">{s.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários</CardTitle>
            <Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>
              Novo Usuário
            </Button>
          </CardHeader>

          {/* Filtros */}
          <div className="px-5 pb-4 flex flex-wrap gap-3 border-b border-gray-50">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
              />
            </div>
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white">
              {filterRoleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white">
              {unitFilterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] bg-white">
              {filterStatusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={loadUsers} className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-100">
                  <tr>
                    {['Usuário', 'E-mail', 'Perfil', 'Unidade', 'Status', 'Cadastro', 'Ações'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nenhum usuário encontrado</td></tr>
                  )}
                  {filtered.map((user) => (
                    <tr key={user.id} className={`hover:bg-gray-50/50 transition-colors ${!user.active ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: user.active ? 'linear-gradient(135deg, #15AFA4, #0d8c83)' : '#CBD5E1' }}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={user.role === 'ADMIN' ? 'default' : user.role === 'GERENTE' ? 'warning' : user.role === 'SUPERINTENDENT' ? 'outline' : user.role === 'JURIDICO' ? 'outline' : 'secondary'}>
                          {user.role === 'ADMIN' ? 'Administrador' : user.role === 'GERENTE' ? 'Gerente' : user.role === 'SUPERINTENDENT' ? 'Superintendente' : user.role === 'JURIDICO' ? 'Jurídico' : 'Analista de RH'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {(user.managedUnits && user.managedUnits.length > 0) ? (
                          <div className="flex flex-wrap gap-1">
                            {user.managedUnits.map(mu => (
                              <span key={mu.unitId} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: mu.unit.color }} />
                                {mu.unit.name}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.active ? 'success' : 'danger'}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => openEdit(user)}>
                            Editar
                          </Button>
                          <button
                            onClick={() => { setToggleTarget(user); setConfirmOpen(true) }}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              user.active
                                ? 'text-red-500 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {user.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck2 className="w-3.5 h-3.5" />}
                            {user.active ? 'Desativar' : 'Ativar'}
                          </button>
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
              Exibindo {filtered.length} de {users.length} usuários
            </div>
          )}
        </Card>
      </div>

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditUser(null) }}
        title={editUser ? `Editar — ${editUser.name}` : 'Novo Usuário'}
        size="md"
      >
        <div className="p-6 space-y-4">
          <Input
            label="Nome completo *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Ana Silva"
          />
          <Input
            label="E-mail *"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="ana.silva@bhcl.com.br"
          />

          {/* Senha */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              {editUser ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editUser ? 'Nova senha...' : 'Mínimo 6 caracteres'}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Barra de força */}
            {form.password && strength && (
              <div className="space-y-1">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${strength.pct}%`, background: strength.color }} />
                </div>
                <p className="text-xs font-medium" style={{ color: strength.color }}>
                  Força da senha: {strength.label}
                </p>
              </div>
            )}
          </div>

          {(form.password) && (
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Confirmar senha"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
              />
              {form.confirmPassword && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium">
                  {form.password === form.confirmPassword
                    ? <span className="text-green-600">✓ Coincidem</span>
                    : <span className="text-red-500">✗ Diferem</span>}
                </span>
              )}
            </div>
          )}

          <Select
            label="Perfil de acesso *"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={roleOptions}
          />

          {/* Multi-unidade */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Unidades gerenciadas
              {form.unitIds.length > 0 && (
                <span className="ml-2 text-xs font-normal text-[#15AFA4]">{form.unitIds.length} selecionada{form.unitIds.length > 1 ? 's' : ''}</span>
              )}
            </label>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
              {units.map(u => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.unitIds.includes(u.id)}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...form.unitIds, u.id]
                        : form.unitIds.filter(id => id !== u.id)
                      setForm({ ...form, unitIds: next })
                    }}
                    className="w-4 h-4 accent-[#15AFA4] rounded"
                  />
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: u.color }} />
                  <span className="text-sm text-gray-700">{u.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Descrição dos perfis */}
          <div className="p-3 rounded-xl border border-gray-100 bg-gray-50 text-xs text-gray-600 space-y-1">
            <p><strong>Administrador:</strong> acesso total, incluindo gestão de usuários e configurações.</p>
            <p><strong>Superintendente:</strong> acesso restrito — visualiza Evidências PCD, Controle de Vagas, Calendário e Tarefas.</p>
            <p><strong>Jurídico:</strong> acesso restrito — visualização do Controle de Vagas, Indicador PCD e Evidências PCD, sem permissão de edição.</p>
            <p><strong>Analista de RH:</strong> acesso operacional — lança indicadores, gerencia tarefas e calendário da sua unidade.</p>
          </div>

          {editUser && (
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="userActive" checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 accent-[#15AFA4] rounded" />
              <label htmlFor="userActive" className="text-sm text-gray-700">Usuário ativo</label>
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {formError}
            </div>
          )}

          {editUser && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Histórico de Alterações</label>
              <div className="max-h-48 overflow-y-auto scrollbar-thin">
                <AuditTrail entity="Usuário" entityId={editUser.id} />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button className="flex-1" isLoading={isSaving} onClick={handleSave}>
              {editUser ? 'Salvar Alterações' : 'Criar Usuário'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm toggle */}
      <Modal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setToggleTarget(null) }}
        title={toggleTarget?.active ? 'Desativar Usuário' : 'Ativar Usuário'}
        size="sm"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            {toggleTarget?.active
              ? `Deseja desativar o usuário <strong>${toggleTarget?.name}</strong>? O acesso será bloqueado imediatamente.`
              : `Deseja reativar o usuário <strong>${toggleTarget?.name}</strong>?`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button
              className="flex-1"
              style={{ background: toggleTarget?.active ? '#EF4444' : undefined }}
              onClick={handleToggle}
            >
              {toggleTarget?.active ? 'Desativar' : 'Ativar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
