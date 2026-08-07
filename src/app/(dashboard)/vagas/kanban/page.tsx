'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core'
import { Plus, Calendar, User, ExternalLink, Users, Lock } from 'lucide-react'
import { VagaData, VagaStatus, VAGA_STATUS_LABELS, VAGA_STATUS_COLORS, TIPO_VAGA_LABELS } from '@/types'
import { formatDate } from '@/lib/utils'
import { VagaModal } from '@/components/vagas/VagaModal'

const KANBAN_COLUMNS: VagaStatus[] = [
  'ABERTA', 'DIVULGACAO', 'TRIAGEM', 'ENTREVISTAS',
  'ENCAMINHADA_GESTOR', 'APROVADA_CONTRATACAO', 'CONTRATADA',
]
const CLOSED_COLUMNS: VagaStatus[] = ['FECHADA', 'CANCELADA']
const ALL_COLUMNS = [...KANBAN_COLUMNS, ...CLOSED_COLUMNS]

function VagaCard({ vaga, isDragging }: { vaga: VagaData; isDragging?: boolean }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: vaga.id })
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0 : 1 }
    : undefined

  const isOverdue = vaga.dataPrevistaFechamento &&
    new Date(vaga.dataPrevistaFechamento) < new Date() &&
    !['CONTRATADA', 'FECHADA', 'CANCELADA'].includes(vaga.status)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
    >
      {/* Borda esquerda colorida */}
      <div className="flex gap-2.5">
        <div className="w-1 rounded-full flex-shrink-0" style={{ background: vaga.unit?.color ?? '#15AFA4', minHeight: '40px' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-1.5">
            <p className="text-sm font-semibold text-gray-900 leading-snug">{vaga.cargo}</p>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); router.push(`/vagas/${vaga.id}`) }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#15AFA4] flex-shrink-0 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {vaga.unit && (
            <p className="text-xs text-gray-500 mb-2 truncate">{vaga.unit.name}</p>
          )}

          <div className="flex flex-wrap gap-1 mb-2">
            <Badge variant="secondary" className="text-[10px] py-0">{TIPO_VAGA_LABELS[vaga.tipoVaga]}</Badge>
            <Badge variant="secondary" className="text-[10px] py-0">{vaga.quantidade}x</Badge>
            {vaga.setor && <Badge variant="secondary" className="text-[10px] py-0">{vaga.setor}</Badge>}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {vaga._count?.candidatos ?? 0}
            </span>
            {vaga.dataPrevistaFechamento && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                <Calendar className="w-3 h-3" />
                {formatDate(vaga.dataPrevistaFechamento)}
              </span>
            )}
          </div>

          {(vaga as any).analistas?.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-50">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                {(vaga as any).analistas[0].name.charAt(0)}
              </div>
              <span className="text-xs text-gray-500 truncate">{(vaga as any).analistas.map((a: any) => a.name).join(', ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KanbanColumn({
  status, vagas, onAdd, activeId, canEdit = true,
}: {
  status: VagaStatus; vagas: VagaData[]; onAdd: () => void; activeId: string | null; canEdit?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const color = VAGA_STATUS_COLORS[status]
  const isClosed = status === 'FECHADA' || status === 'CANCELADA'

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="text-xs font-semibold text-gray-700">{VAGA_STATUS_LABELS[status]}</span>
          <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
            {vagas.length}
          </span>
        </div>
        {canEdit && !isClosed && (
          <button onClick={onAdd} className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 flex-1 min-h-[150px] rounded-xl p-2 transition-colors ${
          isOver ? 'bg-teal-50 border-2 border-dashed border-teal-300' : 'bg-gray-50/50'
        }`}
      >
        {vagas.map((v) => (
          <VagaCard key={v.id} vaga={v} isDragging={activeId === v.id} />
        ))}
      </div>
    </div>
  )
}

export default function VagasKanbanPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === 'ADMIN'
  const canEdit = session?.user?.role !== 'JURIDICO'
  const canFilterAllUnits = ['ADMIN', 'JURIDICO', 'SUPERINTENDENT', 'GERENTE'].includes(session?.user?.role ?? '')
  const analystUnitIds: string[] = (session?.user as any)?.unitIds?.length
    ? (session?.user as any).unitIds
    : (session?.user?.unitId ? [session?.user?.unitId] : [])
  const analystUnitId = analystUnitIds[0] ?? null

  const [vagas, setVagas] = useState<VagaData[]>([])
  const [units, setUnits] = useState<{ id: string; name: string; color: string }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string; unitId?: string | null; managedUnits?: { unitId: string }[] }[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filterUnit, setFilterUnit] = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [defaultStatus, setDefaultStatus] = useState<VagaStatus>('ABERTA')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function load() {
    const params = canFilterAllUnits && filterUnit ? `?unitId=${filterUnit}` : ''
    const res = await fetch(`/api/vagas${params}`)
    setVagas(await res.json())
  }

  useEffect(() => { load() }, [filterUnit, canFilterAllUnits])
  useEffect(() => {
    fetch('/api/units').then((r) => r.json()).then(setUnits)
    fetch('/api/users').then((r) => r.json()).then(setUsers)
  }, [])

  function getColVagas(status: VagaStatus) {
    return vagas.filter((v) => v.status === status).sort((a, b) => a.position - b.position)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    if (!canEdit) return
    const { active, over } = event
    if (!over) return
    const vagaId = active.id as string
    const newStatus = over.id as VagaStatus
    if (!ALL_COLUMNS.includes(newStatus)) return
    const vaga = vagas.find((v) => v.id === vagaId)
    if (!vaga || vaga.status === newStatus) return

    setVagas((prev) => prev.map((v) => v.id === vagaId ? { ...v, status: newStatus } : v))
    await fetch(`/api/vagas/${vagaId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus, newPosition: 0 }),
    })
  }

  const activeVaga = vagas.find((v) => v.id === activeId)
  const visibleColumns = showClosed ? ALL_COLUMNS : KANBAN_COLUMNS
  const analystUnit = units.find((u) => u.id === analystUnitId)

  return (
    <>
      <Header title="Controle de Vagas" subtitle="Kanban do processo seletivo" />
      <div className="p-6 flex flex-col gap-4 flex-1">

        {/* Tabs */}
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {[
              { label: 'Dashboard', href: '/vagas' },
              { label: 'Kanban', href: '/vagas/kanban' },
              { label: 'Lista', href: '/vagas/lista' },
              { label: 'Controle', href: '/vagas/controle' },
            ].map((tab) => (
              <button key={tab.href} onClick={() => router.push(tab.href)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab.href === '/vagas/kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>{tab.label}</button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {canFilterAllUnits ? (
              <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 outline-none focus:border-[#15AFA4]">
                <option value="">Todas as unidades</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            ) : analystUnit && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-xs text-gray-600">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: analystUnit.color }} />
                {analystUnit.name}
                <Lock className="w-3 h-3 text-gray-400" />
              </div>
            )}
            <button
              onClick={() => setShowClosed(!showClosed)}
              className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                showClosed ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {showClosed ? 'Ocultar encerradas' : 'Ver encerradas'}
            </button>
            {canEdit && (
              <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setDefaultStatus('ABERTA'); setModalOpen(true) }}>
                Nova Vaga
              </Button>
            )}
          </div>
        </div>

        {/* Board */}
        <div className="overflow-x-auto pb-4 flex-1">
          <DndContext
            sensors={sensors}
            onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 min-w-max">
              {visibleColumns.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  vagas={getColVagas(status)}
                  onAdd={() => { setDefaultStatus(status); setModalOpen(true) }}
                  activeId={activeId}
                  canEdit={canEdit}
                />
              ))}
            </div>
            <DragOverlay>
              {activeVaga && (
                <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xl opacity-90 w-64 rotate-2">
                  <p className="text-sm font-semibold text-gray-900">{activeVaga.cargo}</p>
                  {activeVaga.unit && <p className="text-xs text-gray-500 mt-1">{activeVaga.unit.name}</p>}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {canEdit && (
        <VagaModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={load}
          defaultStatus={defaultStatus}
          units={units}
          users={users}
          isAdmin={isAdmin}
          analystUnitIds={analystUnitIds}
        />
      )}
    </>
  )
}
