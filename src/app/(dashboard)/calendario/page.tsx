'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/pt-br'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Header } from '@/components/layout/Header'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Building2, Lock, Check, Users, Link2, ExternalLink, ClipboardList } from 'lucide-react'
import { EVENT_TYPE_LABELS, EventType } from '@/types'
import { formatDatetime } from '@/lib/utils'

moment.locale('pt-br')
const localizer = momentLocalizer(moment)

interface EventData {
  id: string
  title: string
  description?: string | null
  pauta?: string | null
  meetingLink?: string | null
  startDate: string
  endDate: string
  allDay: boolean
  eventType: EventType
  reminders: number[]
  unitId?: string | null
  userId: string
  unit?: { id: string; name: string; color: string } | null
  user?: { id: string; name: string }
  participants?: { userId: string; user: { id: string; name: string } }[]
}

interface UserOption { id: string; name: string; role: string }

interface UnitData { id: string; name: string; color: string }

const messages = {
  allDay: 'Dia inteiro', previous: '‹', next: '›', today: 'Hoje',
  month: 'Mês', week: 'Semana', day: 'Dia', agenda: 'Agenda',
  date: 'Data', time: 'Hora', event: 'Evento',
  noEventsInRange: 'Nenhum evento neste período',
  showMore: (total: number) => `+${total} mais`,
}

const eventTypeOptions = Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))

export default function CalendarioPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdmin = session?.user?.role === 'ADMIN'
  const analystUnitIds: string[] = (session?.user as any)?.unitIds?.length
    ? (session?.user as any).unitIds
    : (session?.user?.unitId ? [session?.user?.unitId] : [])
  const analystUnitId = analystUnitIds[0] ?? null

  const [events, setEvents] = useState<EventData[]>([])
  const [units, setUnits] = useState<UnitData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null)
  const [filterUnit, setFilterUnit] = useState('')
  const [currentView, setCurrentView] = useState<any>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? Views.AGENDA : Views.MONTH
  )

  const [form, setForm] = useState({
    title: '', description: '', pauta: '', meetingLink: '', startDate: '', endDate: '',
    allDay: false, eventType: 'OUTRO' as EventType, unitId: '',
    reminders: [15, 5] as number[],
    participantIds: [] as string[],
  })
  const [customMin, setCustomMin] = useState('')
  const [unitUsers, setUnitUsers] = useState<UserOption[]>([])

  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterUnit) params.set('unitId', filterUnit)
    try {
      const res = await fetch(`/api/calendar?${params}`)
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : [])
    } catch {
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }, [filterUnit])

  useEffect(() => { loadEvents() }, [loadEvents])

  // Abre automaticamente o evento indicado via notificação (?eventId=...)
  useEffect(() => {
    const eventId = searchParams.get('eventId')
    if (!eventId || events.length === 0) return
    const event = events.find((e) => e.id === eventId)
    if (event) {
      setSelectedEvent(event)
      setDetailOpen(true)
    }
    router.replace('/calendario')
  }, [events, searchParams, router])

  useEffect(() => {
    fetch('/api/units').then((r) => r.json()).then(setUnits)
  }, [])

  // Carrega usuários da unidade selecionada para o seletor de participantes
  useEffect(() => {
    if (!modalOpen) return
    const uid = form.unitId || (!isAdmin && analystUnitId ? analystUnitId : null)
    if (!uid) { setUnitUsers([]); return }
    fetch(`/api/users?unitId=${uid}`)
      .then((r) => r.json())
      .then((users: UserOption[]) => {
        const others = users.filter((u) => u.id !== session?.user?.id)
        setUnitUsers(others)
        // Para evento novo: pré-seleciona todos da unidade
        if (!selectedEvent) {
          setForm((f) => ({ ...f, participantIds: others.map((u) => u.id) }))
        }
      })
  }, [form.unitId, modalOpen, analystUnitId, isAdmin, session?.user?.id, selectedEvent])

  // Unidade do analista (para mostrar no banner)
  const analystUnit = units.find((u) => u.id === analystUnitId)

  const calendarEvents = events.map((e) => ({
    id: e.id, title: e.title,
    start: new Date(e.startDate), end: new Date(e.endDate),
    allDay: e.allDay, resource: e,
  }))

  const eventStyleGetter = (event: any) => {
    const color = event.resource?.unit?.color ?? '#15AFA4'
    return {
      style: {
        backgroundColor: color, borderRadius: '6px', border: 'none',
        color: 'white', fontSize: '12px', fontWeight: '500', padding: '2px 6px',
      },
    }
  }

  async function handleSave() {
    const url = selectedEvent ? `/api/calendar/${selectedEvent.id}` : '/api/calendar'
    const method = selectedEvent ? 'PUT' : 'POST'
    const body = {
      ...form,
      pauta: form.pauta || null,
      meetingLink: form.meetingLink || null,
      startDate: brasiliaToUTC(form.startDate),
      endDate: brasiliaToUTC(form.endDate),
      unitId: !isAdmin && analystUnitIds.length === 1 && analystUnitId
        ? analystUnitId
        : (form.unitId || null),
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setModalOpen(false)
      setSelectedEvent(null)
      resetForm()
      loadEvents()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este evento?')) return
    await fetch(`/api/calendar/${id}`, { method: 'DELETE' })
    setDetailOpen(false)
    loadEvents()
  }

  function resetForm() {
    setForm({ title: '', description: '', pauta: '', meetingLink: '', startDate: '', endDate: '', allDay: false, eventType: 'OUTRO', unitId: '', reminders: [15, 5], participantIds: [] })
    setCustomMin('')
    setUnitUsers([])
  }

  // Converte um Date/string UTC para o formato datetime-local no horário de Brasília
  function toLocalInput(d: Date | string) {
    const date = typeof d === 'string' ? new Date(d) : d
    return date.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 16)
  }

  // Converte um valor "YYYY-MM-DDTHH:MM" no horário de Brasília para UTC ISO string
  function brasiliaToUTC(local: string) {
    return new Date(local + ':00-03:00').toISOString()
  }

  function openNew(slotInfo?: any) {
    resetForm()
    setSelectedEvent(null)
    if (slotInfo) {
      setForm((f) => ({ ...f, startDate: toLocalInput(slotInfo.start), endDate: toLocalInput(slotInfo.end) }))
    }
    if (!isAdmin) {
      const preset = filterUnit || (analystUnitIds.length === 1 ? analystUnitId : '') || ''
      setForm((f) => ({ ...f, unitId: preset }))
    }
    setModalOpen(true)
  }

  function openEdit(event: EventData) {
    setForm({
      title: event.title, description: event.description ?? '',
      pauta: event.pauta ?? '', meetingLink: event.meetingLink ?? '',
      startDate: toLocalInput(event.startDate), endDate: toLocalInput(event.endDate),
      allDay: event.allDay, eventType: event.eventType,
      unitId: event.unitId ?? '',
      reminders: event.reminders ?? [15, 5],
      participantIds: event.participants?.map((p) => p.userId) ?? [],
    })
    setCustomMin('')
    setSelectedEvent(event)
    setDetailOpen(false)
    setModalOpen(true)
  }

  return (
    <>
      <Header title="Calendário" subtitle="Agenda operacional das analistas de RH" />
      <div className="p-3 md:p-6 flex flex-col gap-3 md:gap-4 flex-1">

        {/* Banner para analista de unidade única */}
        {!isAdmin && analystUnitIds.length === 1 && analystUnit && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ background: analystUnit.color + '12', borderColor: analystUnit.color + '30' }}>
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: analystUnit.color }} />
            <p className="text-sm font-medium" style={{ color: analystUnit.color }}>
              Visualizando: <strong>{analystUnit.name}</strong>
            </p>
            <Lock className="w-3.5 h-3.5 ml-auto" style={{ color: analystUnit.color }} />
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col gap-2">
          {/* Linha 1: filtro de unidade + botão */}
          <div className="flex items-center gap-2">
            {(isAdmin || analystUnitIds.length > 1) && (
              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 outline-none focus:border-[#15AFA4] min-w-0"
              >
                <option value="">{isAdmin ? 'Todas as unidades' : 'Todas as minhas'}</option>
                {(isAdmin ? units : units.filter((u) => analystUnitIds.includes(u.id))).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}
            <div className="ml-auto flex-shrink-0">
              <Button icon={<Plus className="w-4 h-4" />} onClick={() => openNew()}>
                <span className="hidden sm:inline">Novo Evento</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </div>
          </div>

          {/* Linha 2: legenda de cores com scroll horizontal */}
          {(() => {
            const legendUnits = isAdmin
              ? units
              : analystUnitIds.length > 1
                ? units.filter((u) => analystUnitIds.includes(u.id))
                : analystUnit ? [analystUnit] : []
            if (!legendUnits.length) return null
            return (
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="flex items-center gap-3 min-w-max pb-0.5">
                  {legendUnits.map((u) => (
                    <div key={u.id} className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: u.color }} />
                      <span className="text-xs text-gray-600 whitespace-nowrap">{u.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Calendário */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1 md:p-4 flex-1" style={{ minHeight: '560px' }}>
          {!isLoading && (
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%', minHeight: '560px' }}
              messages={messages}
              culture="pt-BR"
              eventPropGetter={eventStyleGetter}
              onSelectEvent={(event) => { setSelectedEvent(event.resource); setDetailOpen(true) }}
              onSelectSlot={openNew}
              selectable
              view={currentView}
              onView={setCurrentView}
              popup
            />
          )}
        </div>
      </div>

      {/* Modal novo/editar */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedEvent(null); resetForm() }}
        title={selectedEvent ? 'Editar Evento' : 'Novo Evento'}
        size="md"
      >
        <div className="p-6 space-y-4">
          <Input label="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título do evento" />
          <Textarea label="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição opcional" rows={2} />

          {/* Link da reunião */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-gray-400" />
              Link da Reunião
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={form.meetingLink}
                onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
                placeholder="https://meet.google.com/... ou Teams, Zoom..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
              />
              {form.meetingLink && (
                <a href={form.meetingLink} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-[#15AFA4] hover:border-[#15AFA4]/40 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Pauta */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
              Pauta da Reunião
            </label>
            <textarea
              value={form.pauta}
              onChange={(e) => setForm({ ...form, pauta: e.target.value })}
              placeholder={"1. Boas-vindas\n2. Ponto 1\n3. Ponto 2\n4. Encerramento"}
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Início *" type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Fim *" type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <Select label="Tipo de Evento" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value as EventType })} options={eventTypeOptions} />

          {isAdmin ? (
            <Select
              label="Unidade"
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              options={units.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="Selecionar unidade"
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
                {analystUnit && <div className="w-3 h-3 rounded-full" style={{ background: analystUnit.color }} />}
                <span className="text-sm text-gray-700">{analystUnit?.name ?? '—'}</span>
                <Lock className="w-3.5 h-3.5 text-gray-400 ml-auto" />
              </div>
            </div>
          )}

          {/* Participantes */}
          {unitUsers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                Participantes
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto rounded-xl border border-gray-100 p-2">
                {/* Criador — sempre incluído */}
                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-gray-50">
                  <div className="w-4 h-4 rounded flex items-center justify-center bg-[#15AFA4] flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-sm text-gray-700 flex-1">{session?.user?.name}</span>
                  <span className="text-xs text-gray-400">criador</span>
                </div>
                {unitUsers.map((u) => {
                  const checked = form.participantIds.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          participantIds: checked
                            ? f.participantIds.filter((id) => id !== u.id)
                            : [...f.participantIds, u.id],
                        }))
                      }
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors ${
                        checked ? 'bg-[#15AFA4]/10' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          checked ? 'bg-[#15AFA4] border-[#15AFA4]' : 'border-gray-300'
                        }`}
                      >
                        {checked && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="text-sm text-gray-700 flex-1">{u.name}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400">
                {form.participantIds.length === 0
                  ? 'Nenhum participante além de você'
                  : `${form.participantIds.length + 1} participante${form.participantIds.length > 0 ? 's' : ''}`}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="allDay" checked={form.allDay}
              onChange={(e) => {
                const checked = e.target.checked
                if (checked) {
                  // Pega a data do início atual (ou hoje) e seta 07:00–19:00 BRT
                  const date = form.startDate
                    ? form.startDate.slice(0, 10)
                    : new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
                  setForm({ ...form, allDay: true, startDate: `${date}T07:00`, endDate: `${date}T19:00` })
                } else {
                  setForm({ ...form, allDay: false })
                }
              }}
              className="w-4 h-4 rounded accent-[#15AFA4]" />
            <label htmlFor="allDay" className="text-sm text-gray-700">Dia inteiro <span className="text-xs text-gray-400">(07:00–19:00)</span></label>
          </div>

          {/* Lembretes */}
          {!form.allDay && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Lembretes</label>
              <div className="flex flex-wrap gap-2 items-center">
                {[5, 15, 30, 60, 1440].map((min) => {
                  const active = form.reminders.includes(min)
                  const label = min < 60 ? `${min} min` : min === 60 ? '1 hora' : '1 dia'
                  return (
                    <button
                      key={min}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          reminders: active
                            ? f.reminders.filter((r) => r !== min)
                            : [...f.reminders, min].sort((a, b) => b - a),
                        }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-[#15AFA4] text-white border-[#15AFA4]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#15AFA4] hover:text-[#15AFA4]'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
                {/* Personalizado */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="10080"
                    value={customMin}
                    onChange={(e) => setCustomMin(e.target.value)}
                    placeholder="ex: 45"
                    className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 outline-none focus:border-[#15AFA4]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseInt(customMin)
                        if (val > 0 && !form.reminders.includes(val)) {
                          setForm((f) => ({ ...f, reminders: [...f.reminders, val].sort((a, b) => b - a) }))
                          setCustomMin('')
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = parseInt(customMin)
                      if (val > 0 && !form.reminders.includes(val)) {
                        setForm((f) => ({ ...f, reminders: [...f.reminders, val].sort((a, b) => b - a) }))
                        setCustomMin('')
                      }
                    }}
                    className="px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-600 transition-colors"
                  >
                    + min
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                {form.reminders.length === 0
                  ? 'Nenhum lembrete configurado'
                  : `Avisar ${form.reminders
                      .map((m) => (m < 60 ? `${m} min` : m === 60 ? '1h' : m === 1440 ? '1 dia' : `${m} min`))
                      .join(', ')} antes`}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm() }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.startDate || !form.endDate}>
              {selectedEvent ? 'Salvar Alterações' : 'Criar Evento'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal detalhes */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Detalhes do Evento" size="sm">
        {selectedEvent && (
          <div className="p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {selectedEvent.unit && <div className="w-3 h-3 rounded-full" style={{ background: selectedEvent.unit.color }} />}
                <h3 className="font-semibold text-gray-900">{selectedEvent.title}</h3>
              </div>
              {selectedEvent.description && <p className="text-sm text-gray-600 mt-2">{selectedEvent.description}</p>}
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between"><span className="text-gray-500">Início</span><span className="font-medium">{formatDatetime(selectedEvent.startDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Fim</span><span className="font-medium">{formatDatetime(selectedEvent.endDate)}</span></div>
              {selectedEvent.unit && <div className="flex justify-between"><span className="text-gray-500">Unidade</span><span className="font-medium">{selectedEvent.unit.name}</span></div>}
              {selectedEvent.user && <div className="flex justify-between"><span className="text-gray-500">Criado por</span><span className="font-medium">{selectedEvent.user.name}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Tipo</span><Badge>{EVENT_TYPE_LABELS[selectedEvent.eventType]}</Badge></div>
              {selectedEvent.meetingLink && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" />Link</span>
                  <a href={selectedEvent.meetingLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 font-medium text-[#15AFA4] hover:underline truncate max-w-[180px]">
                    Entrar na reunião <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              )}
              {selectedEvent.participants && selectedEvent.participants.length > 0 && (
                <div className="flex justify-between items-start gap-4">
                  <span className="text-gray-500 flex-shrink-0">Participantes</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    <span className="text-xs bg-[#15AFA4]/10 text-[#15AFA4] rounded-full px-2 py-0.5 font-medium">
                      {selectedEvent.user?.name} (criador)
                    </span>
                    {selectedEvent.participants.map((p) => (
                      <span key={p.userId} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                        {p.user.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {selectedEvent.pauta && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5" />Pauta
                </p>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {selectedEvent.pauta.includes('\n') ? (
                    <ol className="space-y-1 list-none">
                      {selectedEvent.pauta.split('\n').filter((l) => l.trim()).map((line, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-[#15AFA4] font-semibold flex-shrink-0 text-xs mt-0.5">{i + 1}.</span>
                          {line.replace(/^\d+\.\s*/, '')}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedEvent.pauta}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => openEdit(selectedEvent)}>Editar</Button>
              <Button variant="danger" className="flex-1" onClick={() => handleDelete(selectedEvent.id)}>Excluir</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
