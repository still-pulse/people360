'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Bell, Clock, Calendar, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

interface ReminderEvent {
  id: string
  title: string
  startDate: string
  allDay: boolean
  reminders: number[]
  unit?: { name: string; color: string } | null
}

interface PopupItem {
  id: string
  event: ReminderEvent
  minutesBefore: number
}

const PREFIX = 'rmd_'
const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function getKey(eventId: string, minutes: number) {
  return `${PREFIX}${eventId}_${minutes}`
}

function markFired(key: string) {
  localStorage.setItem(key, Date.now().toString())
}

function isFired(key: string) {
  return !!localStorage.getItem(key)
}

function cleanupOldKeys() {
  const now = Date.now()
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (!k?.startsWith(PREFIX)) continue
    const ts = parseInt(localStorage.getItem(k) ?? '0')
    if (now - ts > ONE_DAY_MS * 2) localStorage.removeItem(k)
  }
}

function timeLabel(minutes: number) {
  if (minutes < 60) return `${minutes} minuto${minutes > 1 ? 's' : ''}`
  if (minutes === 60) return '1 hora'
  if (minutes === 1440) return '1 dia'
  return `${minutes / 60} horas`
}

export function ReminderEngine() {
  const { status } = useSession()
  const [queue, setQueue] = useState<PopupItem[]>([])
  const permissionAsked = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated' || permissionAsked.current) return
    permissionAsked.current = true
    cleanupOldKeys()
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [status])

  const checkReminders = useCallback(async () => {
    if (status !== 'authenticated') return
    try {
      const now = new Date()
      const tomorrow = new Date(now.getTime() + ONE_DAY_MS)
      const res = await fetch(`/api/calendar?start=${now.toISOString()}&end=${tomorrow.toISOString()}`)
      if (!res.ok) return
      const events: ReminderEvent[] = await res.json()

      const toShow: PopupItem[] = []

      for (const event of events) {
        if (event.allDay || !event.reminders?.length) continue
        const startMs = new Date(event.startDate).getTime()
        const nowMs = now.getTime()

        for (const minutes of event.reminders) {
          const key = getKey(event.id, minutes)
          if (isFired(key)) continue

          const reminderMs = startMs - minutes * 60 * 1000
          const diff = reminderMs - nowMs

          if (diff <= 0 && nowMs < startMs && nowMs - reminderMs < TWO_HOURS_MS) {
            markFired(key)
            toShow.push({ id: key, event, minutesBefore: minutes })

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`⏰ ${event.title}`, {
                body: `Começa em ${timeLabel(minutes)}`,
                icon: '/favicon.ico',
                tag: key,
              })
            }
          }
        }
      }

      if (toShow.length > 0) {
        setQueue((prev) => [...prev, ...toShow])
      }
    } catch {
      // falha silenciosa
    }
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return
    checkReminders()
    const id = setInterval(checkReminders, 60_000)
    return () => clearInterval(id)
  }, [checkReminders, status])

  function dismiss() {
    setQueue((prev) => prev.slice(1))
  }

  if (!queue.length) return null

  const current = queue[0]
  const remaining = queue.length

  return (
    <ReminderModal
      item={current}
      remaining={remaining}
      onDismiss={dismiss}
    />
  )
}

function ReminderModal({
  item,
  remaining,
  onDismiss,
}: {
  item: PopupItem
  remaining: number
  onDismiss: () => void
}) {
  const { event, minutesBefore } = item
  const color = event.unit?.color ?? '#15AFA4'
  const label = timeLabel(minutesBefore)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Faixa colorida no topo */}
        <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

        <div className="p-8 flex flex-col items-center text-center gap-5">
          {/* Ícone pulsando */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse"
            style={{ backgroundColor: color + '20' }}
          >
            <Bell className="w-8 h-8" style={{ color }} />
          </div>

          {/* Textos */}
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
              Lembrete de Evento
            </p>
            <h2 className="text-xl font-bold text-gray-900 leading-snug">{event.title}</h2>
            {event.unit && (
              <p className="text-sm text-gray-400">{event.unit.name}</p>
            )}
          </div>

          {/* Tempo restante */}
          <div
            className="flex items-center gap-2 px-5 py-3 rounded-2xl"
            style={{ backgroundColor: color + '15' }}
          >
            <Clock className="w-5 h-5 flex-shrink-0" style={{ color }} />
            <p className="text-sm font-semibold" style={{ color }}>
              Começa em <strong>{label}</strong>
            </p>
          </div>

          {/* Botões */}
          <div className="w-full flex flex-col gap-2 pt-1">
            <button
              onClick={onDismiss}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-95"
              style={{ backgroundColor: color }}
            >
              <CheckCircle2 className="w-4 h-4" />
              OK, Ciente
            </button>
            <Link
              href="/calendario"
              onClick={onDismiss}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Ver no Calendário
            </Link>
          </div>

          {/* Contador de fila */}
          {remaining > 1 && (
            <p className="text-xs text-gray-400">
              +{remaining - 1} lembrete{remaining - 1 > 1 ? 's' : ''} na fila
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
