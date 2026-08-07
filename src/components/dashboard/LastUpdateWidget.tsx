'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { RefreshCw, Clock } from 'lucide-react'

const LS_KEY = 'dashboard:lastUpdated'

function fmtDatetime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function LastUpdateWidget() {
  const pathname = usePathname()
  const isDashboard = pathname === '/dashboard'
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) setLastUpdated(stored)
  }, [])

  useEffect(() => {
    const onRefreshed = (e: Event) => {
      const ts = (e as CustomEvent<string>).detail
      setLastUpdated(ts)
      localStorage.setItem(LS_KEY, ts)
      setIsRefreshing(false)
    }
    window.addEventListener('dashboard:refreshed', onRefreshed)
    return () => window.removeEventListener('dashboard:refreshed', onRefreshed)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return
    setIsRefreshing(true)
    window.dispatchEvent(new CustomEvent('dashboard:refresh'))
    // fallback: if no dashboard page responds in 5s, stop loading
    setTimeout(() => setIsRefreshing(false), 5000)
  }, [isRefreshing])

  return (
    <div className="px-3 pb-3">
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 leading-none">Dados atualizados em:</p>
              <p className="text-[11px] font-semibold text-gray-600 mt-0.5 leading-none">
                {lastUpdated ? fmtDatetime(lastUpdated) : '—'}
              </p>
            </div>
          </div>
          {isDashboard && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Atualizar agora"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#15AFA4] hover:bg-[#15AFA4]/10 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        {isDashboard && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold text-[#15AFA4] bg-[#15AFA4]/10 hover:bg-[#15AFA4]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar Agora'}
          </button>
        )}
      </div>
      {toast && (
        <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium ${
          toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
