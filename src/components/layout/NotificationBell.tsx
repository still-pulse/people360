'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, KanbanSquare, Calendar, Briefcase, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  body?: string | null
  href: string
  read: boolean
  createdAt: string
}

const TYPE_ICON: Record<string, React.ElementType> = {
  TASK:     KanbanSquare,
  CALENDAR: Calendar,
  VAGA:     Briefcase,
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  return `${days}d atrás`
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {}
  }, [])

  // Polling a cada 30s + ao focar a janela
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    const onFocus = () => fetchNotifications()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [fetchNotifications])

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  async function handleClick(notif: Notification) {
    if (!notif.read) await markRead(notif.id)
    setOpen(false)
    router.push(notif.href)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-xl border border-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors relative"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Notificações</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-[#15AFA4] hover:bg-gray-50 rounded-lg transition-colors">
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todas
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">Nenhuma notificação ainda</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
                      !n.read && 'bg-[#15AFA4]/5'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                      n.read ? 'bg-gray-100' : 'bg-[#15AFA4]/15'
                    )}>
                      <Icon className={cn('w-4 h-4', n.read ? 'text-gray-400' : 'text-[#15AFA4]')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm leading-tight', n.read ? 'text-gray-600' : 'text-gray-900 font-semibold')}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                        style={{ background: '#15AFA4' }} />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
