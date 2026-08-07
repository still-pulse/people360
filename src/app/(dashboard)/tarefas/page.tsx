'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import {
  Plus, MoreHorizontal, Calendar, MessageSquare, Clock, Trash2, Lock, Building2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TaskStatus,
  TaskPriority,
} from '@/types'
import { getPriorityColor, formatDate, formatDatetime } from '@/lib/utils'
import { AuditTrail } from '@/components/audit/AuditTrail'

interface TaskResponsible {
  userId: string
  user: { id: string; name: string }
}

interface TaskData {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  position: number
  dueDate?: string | null
  unitId?: string | null
  createdAt: string
  responsibles: TaskResponsible[]
  createdBy?: { id: string; name: string } | null
  unit?: { id: string; name: string; color: string } | null
  comments?: { id: string; content: string; createdAt: string; user: { id: string; name: string } }[]
  history?: { id: string; fromStatus: TaskStatus; toStatus: TaskStatus; createdAt: string; user: { id: string; name: string } }[]
}

const COLUMNS: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'WAITING', 'DONE']

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface Competencia {
  id: string
  mes: number
  ano: number
}

const COLUMN_COLORS: Record<TaskStatus, string> = {
  BACKLOG:     '#94A3B8',
  TODO:        '#3B82F6',
  IN_PROGRESS: '#F59E0B',
  WAITING:     '#8B5CF6',
  DONE:        '#10B981',
}

function UserAvatar({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold border-2 border-white flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={name}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function ResponsibleAvatars({ responsibles, size = 20 }: { responsibles: TaskResponsible[]; size?: number }) {
  if (responsibles.length === 0) return null
  const shown = responsibles.slice(0, 3)
  const extra = responsibles.length - 3
  return (
    <div className="flex -space-x-1.5">
      {shown.map((r) => <UserAvatar key={r.userId} name={r.user.name} size={size} />)}
      {extra > 0 && (
        <div
          className="rounded-full bg-gray-200 flex items-center justify-center font-bold border-2 border-white text-gray-600 flex-shrink-0"
          style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

function KanbanCard({
  task,
  onClick,
  isDragging,
}: {
  task: TaskData
  onClick: () => void
  isDragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id })

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0 : 1 }
    : undefined

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-900 leading-snug flex-1">{task.title}</p>
        <button
          onClick={(e) => { e.stopPropagation(); onClick() }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-all flex-shrink-0"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        <Badge className={getPriorityColor(task.priority)} variant="outline">
          {TASK_PRIORITY_LABELS[task.priority]}
        </Badge>
        {task.unit && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
            style={{ background: task.unit.color + '20', color: task.unit.color, borderColor: task.unit.color + '40' }}
          >
            {task.unit.name}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-50">
        <div className="flex items-center gap-2">
          <ResponsibleAvatars responsibles={task.responsibles} size={20} />
          {task.comments && task.comments.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <MessageSquare className="w-3 h-3" />
              {task.comments.length}
            </span>
          )}
        </div>
        {task.dueDate && (
          <span className={`flex items-center gap-1 text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
            <Calendar className="w-3 h-3" />
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({
  status,
  tasks,
  onCardClick,
  onAddClick,
  activeId,
}: {
  status: TaskStatus
  tasks: TaskData[]
  onCardClick: (task: TaskData) => void
  onAddClick: (status: TaskStatus) => void
  activeId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col w-full md:w-72 md:flex-shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLUMN_COLORS[status] }} />
          <span className="text-sm font-semibold text-gray-700">{TASK_STATUS_LABELS[status]}</span>
          <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddClick(status)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2.5 flex-1 min-h-[200px] rounded-xl p-2 transition-colors ${isOver ? 'bg-teal-50 border-2 border-dashed border-teal-300' : 'bg-gray-50/50'}`}
      >
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            onClick={() => onCardClick(task)}
            isDragging={activeId === task.id}
          />
        ))}
      </div>
    </div>
  )
}

function MultiSelect({
  label,
  users,
  selected,
  onChange,
}: {
  label: string
  users: { id: string; name: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
        {users.length === 0 && (
          <div className="px-3.5 py-2.5 text-sm text-gray-400">Nenhum usuário disponível</div>
        )}
        {users.map((u) => (
          <label
            key={u.id}
            className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 select-none"
          >
            <input
              type="checkbox"
              checked={selected.includes(u.id)}
              onChange={() => toggle(u.id)}
              className="w-4 h-4 rounded accent-[#15AFA4] flex-shrink-0"
            />
            <UserAvatar name={u.name} size={24} />
            <span className="text-sm text-gray-700">{u.name}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-[#15AFA4] font-medium">
          {selected.length} selecionado{selected.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

export default function TarefasPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdmin = session?.user?.role === 'ADMIN'
  const analystUnitIds: string[] = (session?.user as any)?.unitIds?.length
    ? (session?.user as any).unitIds
    : (session?.user?.unitId ? [session?.user?.unitId] : [])
  const analystUnitId = analystUnitIds[0] ?? null

  const [competencias, setCompetencias]           = useState<Competencia[]>([])
  const [selectedCompetenciaId, setSelectedCompetenciaId] = useState('')

  const [tasks, setTasks]           = useState<TaskData[]>([])
  const [units, setUnits]           = useState<{ id: string; name: string; color: string }[]>([])
  const [users, setUsers]           = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [activeId, setActiveId]     = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [filterUnit, setFilterUnit] = useState('')

  const [form, setForm] = useState({
    title:          '',
    description:    '',
    priority:       'MEDIUM' as TaskPriority,
    responsibleIds: [] as string[],
    unitId:         '',
    dueDate:        '',
    status:         'BACKLOG' as TaskStatus,
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function loadTasks() {
    if (!selectedCompetenciaId) return
    setIsLoading(true)
    const params = new URLSearchParams({ competenciaId: selectedCompetenciaId })
    if (filterUnit) params.set('unitId', filterUnit)
    const res = await fetch(`/api/tasks?${params}`)
    const data = await res.json()
    setTasks(data)
    setIsLoading(false)
  }

  useEffect(() => { loadTasks() }, [filterUnit, isAdmin, selectedCompetenciaId])

  useEffect(() => {
    fetch('/api/competencias').then((r) => r.json()).then((data) => {
      setCompetencias(data.competencias)
      setSelectedCompetenciaId((prev) => prev || data.current.id)
    })
  }, [])

  // Abre automaticamente a tarefa indicada via notificação (?taskId=...)
  useEffect(() => {
    const taskId = searchParams.get('taskId')
    if (!taskId || tasks.length === 0) return
    const task = tasks.find((t) => t.id === taskId)
    if (task) {
      setSelectedTask(task)
      setDetailOpen(true)
    }
    router.replace('/tarefas')
  }, [tasks, searchParams, router])

  useEffect(() => {
    fetch('/api/units').then((r) => r.json()).then(setUnits)
  }, [])

  useEffect(() => {
    const params = isAdmin && filterUnit ? `?unitId=${filterUnit}` : ''
    fetch(`/api/users${params}`).then((r) => r.json()).then((data) =>
      setUsers(data.filter((u: any) => u.role === 'ANALYST' || u.role === 'GERENTE'))
    )
  }, [filterUnit, isAdmin])

  function getColumnTasks(status: TaskStatus) {
    return tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const taskId   = active.id as string
    const newStatus = over.id as TaskStatus

    if (!COLUMNS.includes(newStatus)) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return

    const previousStatus = task.status
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))

    const res = await fetch(`/api/tasks/${taskId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus, newPosition: 0 }),
    })

    if (!res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t)))
      alert('Não foi possível mover a tarefa.')
    }
  }

  async function handleSaveTask() {
    const url    = selectedTask ? `/api/tasks/${selectedTask.id}` : '/api/tasks'
    const method = selectedTask ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        dueDate:        form.dueDate || null,
        responsibleIds: form.responsibleIds,
        unitId:         form.unitId || null,
        competenciaId:  selectedCompetenciaId || null,
      }),
    })

    if (res.ok) {
      setModalOpen(false)
      setSelectedTask(null)
      loadTasks()
    } else {
      const data = await res.json().catch(() => null)
      alert(data?.error ?? 'Não foi possível salvar a tarefa.')
    }
  }

  async function handleAddComment() {
    if (!selectedTask || !newComment.trim()) return
    const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment }),
    })
    if (res.ok) {
      setNewComment('')
      loadTasks()
      const updated = tasks.find((t) => t.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!selectedTask || !confirm('Excluir este comentário?')) return
    await fetch(`/api/tasks/${selectedTask.id}/comments/${commentId}`, { method: 'DELETE' })
    loadTasks()
    setSelectedTask((prev) =>
      prev ? { ...prev, comments: prev.comments?.filter((c) => c.id !== commentId) } : prev,
    )
  }

  async function handleDeleteTask(id: string) {
    if (!confirm('Excluir esta tarefa?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setDetailOpen(false)
    loadTasks()
  }

  function openNew(status: TaskStatus = 'BACKLOG') {
    setSelectedTask(null)
    setForm({
      title: '', description: '', priority: 'MEDIUM',
      responsibleIds: [],
      unitId: !isAdmin && analystUnitIds.length === 1 ? analystUnitIds[0] : (filterUnit || ''),
      dueDate: '', status,
    })
    setModalOpen(true)
  }

  function openEdit(task: TaskData) {
    setSelectedTask(task)
    setForm({
      title:          task.title,
      description:    task.description ?? '',
      priority:       task.priority,
      responsibleIds: task.responsibles.map((r) => r.userId),
      unitId:         task.unitId ?? '',
      dueDate:        task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '',
      status:         task.status,
    })
    setDetailOpen(false)
    setModalOpen(true)
  }

  const activeTask = tasks.find((t) => t.id === activeId)

  return (
    <>
      <Header title="Tarefas" subtitle="Gestão de atividades da equipe de RH" />
      <div className="p-3 md:p-6 flex flex-col gap-3 md:gap-4 flex-1">

          {/* Seletor de competência mensal */}
        {competencias.length > 0 && (() => {
          const idx = competencias.findIndex((c) => c.id === selectedCompetenciaId)
          const isCurrentMonth = idx === 0
          return (
            <div className="flex items-center gap-1 self-start px-3 py-2 rounded-xl border border-gray-200 bg-white shadow-sm">
              <button
                onClick={() => idx < competencias.length - 1 && setSelectedCompetenciaId(competencias[idx + 1].id)}
                disabled={idx >= competencias.length - 1}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={selectedCompetenciaId}
                onChange={(e) => setSelectedCompetenciaId(e.target.value)}
                className="text-sm font-semibold text-gray-800 bg-transparent outline-none cursor-pointer px-1"
              >
                {competencias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {MONTH_NAMES[c.mes - 1]}/{c.ano}
                  </option>
                ))}
              </select>
              <button
                onClick={() => idx > 0 && setSelectedCompetenciaId(competencias[idx - 1].id)}
                disabled={isCurrentMonth}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {isCurrentMonth && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#15AFA4]/10 text-[#15AFA4]">
                  Atual
                </span>
              )}
            </div>
          )
        })()}

        {!isAdmin && (
          analystUnitIds.length > 1 ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-600 font-medium">Unidade:</span>
              <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-700 outline-none">
                <option value="">Todas as minhas unidades</option>
                {units.filter((u) => analystUnitIds.includes(u.id)).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          ) : analystUnitId && (() => {
            const u = units.find((u) => u.id === analystUnitId)
            return u ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                style={{ background: u.color + '12', borderColor: u.color + '30' }}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: u.color }} />
                <p className="text-sm font-medium" style={{ color: u.color }}>
                  Visualizando tarefas da unidade: <strong>{u.name}</strong>
                </p>
                <Lock className="w-3.5 h-3.5 ml-auto" style={{ color: u.color }} />
              </div>
            ) : null
          })()
        )}

        <div className="flex items-center gap-3">
          {isAdmin && (
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 outline-none focus:border-[#15AFA4]"
            >
              <option value="">Todas as unidades</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <div className="ml-auto">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => openNew()}>
              Nova Tarefa
            </Button>
          </div>
        </div>

        <div className="pb-4 md:overflow-x-auto">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col gap-4 md:flex-row md:gap-5 md:min-w-max">
              {COLUMNS.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={getColumnTasks(status)}
                  onCardClick={(task) => { setSelectedTask(task); setDetailOpen(true) }}
                  onAddClick={openNew}
                  activeId={activeId}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xl rotate-3 opacity-90 w-72">
                  <p className="text-sm font-medium text-gray-900">{activeTask.title}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Modal criar/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={selectedTask ? 'Editar Tarefa' : 'Nova Tarefa'} size="md">
        <div className="p-6 space-y-4">
          <Input
            label="Título *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Título da tarefa"
          />
          <Textarea
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            placeholder={"Descrição opcional.\nDica: use Enter para separar itens — cada linha vira um ponto da lista."}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Prioridade"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              options={Object.entries(TASK_PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
              options={Object.entries(TASK_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </div>

          <MultiSelect
            label="Responsável(is) *"
            users={users}
            selected={form.responsibleIds}
            onChange={(ids) => setForm((f) => ({ ...f, responsibleIds: ids }))}
          />
          {form.responsibleIds.length === 0 && (
            <p className="text-xs text-red-500 font-medium -mt-2">Selecione ao menos um responsável.</p>
          )}

          {isAdmin ? (
            <Select
              label="Unidade"
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              options={units.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="Sem unidade"
            />
          ) : analystUnitIds.length > 1 ? (
            <Select
              label="Unidade"
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              options={units.filter((u) => analystUnitIds.includes(u.id)).map((u) => ({ value: u.id, label: u.name }))}
              placeholder="Selecionar unidade"
            />
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Unidade</label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50">
                {units.find((u) => u.id === analystUnitId) && (
                  <div className="w-3 h-3 rounded-full" style={{ background: units.find((u) => u.id === analystUnitId)?.color }} />
                )}
                <span className="text-sm text-gray-700">{units.find((u) => u.id === analystUnitId)?.name ?? '—'}</span>
                <Lock className="w-3.5 h-3.5 text-gray-400 ml-auto" />
              </div>
            </div>
          )}

          <Input
            label="Prazo"
            type="datetime-local"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTask} disabled={!form.title || form.responsibleIds.length === 0}>
              {selectedTask ? 'Salvar' : 'Criar Tarefa'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal detalhes */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Detalhes da Tarefa" size="lg">
        {selectedTask && (
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{selectedTask.title}</h3>
                {selectedTask.description && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    {selectedTask.description.includes('\n') ? (
                      <ul className="space-y-1">
                        {selectedTask.description.split('\n').filter((l) => l.trim()).map((line, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#15AFA4] flex-shrink-0" />
                            {line.trim()}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTask.description}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(selectedTask)}>Editar</Button>
                {(isAdmin || selectedTask.createdBy?.id === session?.user?.id) && (
                  <Button size="sm" variant="danger" onClick={() => handleDeleteTask(selectedTask.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Status',    value: <Badge>{TASK_STATUS_LABELS[selectedTask.status]}</Badge> },
                { label: 'Prioridade', value: <Badge className={getPriorityColor(selectedTask.priority)} variant="outline">{TASK_PRIORITY_LABELS[selectedTask.priority]}</Badge> },
                { label: 'Unidade',   value: selectedTask.unit?.name ?? '—' },
                { label: 'Prazo',     value: selectedTask.dueDate ? formatDate(selectedTask.dueDate) : '—' },
                { label: 'Criado em', value: formatDate(selectedTask.createdAt) },
                { label: 'Criado por', value: selectedTask.createdBy?.name ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500 font-medium">{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
              ))}
              {/* Responsáveis — linha cheia */}
              <div className="col-span-2 flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500 font-medium">Responsável(is)</span>
                {selectedTask.responsibles.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <ResponsibleAvatars responsibles={selectedTask.responsibles} size={22} />
                    <span className="text-sm font-medium text-gray-900">
                      {selectedTask.responsibles.map((r) => r.user.name).join(', ')}
                    </span>
                  </div>
                ) : (
                  <span className="font-medium text-gray-900">—</span>
                )}
              </div>
            </div>

            {selectedTask.history && selectedTask.history.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Histórico de Movimentações
                </h4>
                <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin">
                  {selectedTask.history.map((h) => (
                    <div key={h.id} className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                      <span className="font-medium text-gray-700">{h.user?.name}</span>
                      <span>moveu de</span>
                      <Badge variant="secondary">{TASK_STATUS_LABELS[h.fromStatus]}</Badge>
                      <span>para</span>
                      <Badge>{TASK_STATUS_LABELS[h.toStatus]}</Badge>
                      <span className="ml-auto">{formatDatetime(h.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Alterações
              </h4>
              <div className="max-h-40 overflow-y-auto scrollbar-thin">
                <AuditTrail entity="Tarefa" entityId={selectedTask.id} />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> Comentários
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin mb-3">
                {selectedTask.comments?.length === 0 && (
                  <p className="text-xs text-gray-400 py-2">Nenhum comentário ainda.</p>
                )}
                {selectedTask.comments?.map((c) => (
                  <div key={c.id} className="bg-gray-50 rounded-xl p-3 group/comment">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-700">{c.user?.name}</span>
                      <span className="text-xs text-gray-400">{formatDatetime(c.createdAt)}</span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="ml-auto opacity-0 group-hover/comment:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                          title="Excluir comentário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{c.content}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && handleAddComment()}
                  placeholder="Adicionar comentário..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
                />
                <Button onClick={handleAddComment} disabled={!newComment.trim()}>Enviar</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
