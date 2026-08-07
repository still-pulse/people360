'use client'

import { useSession, signOut } from 'next-auth/react'
import { LogOut, ChevronDown, Menu } from 'lucide-react'
import { useState } from 'react'
import { NotificationBell } from './NotificationBell'
import { useSidebar } from '@/components/providers/SidebarProvider'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession()
  const [showMenu, setShowMenu] = useState(false)
  const { toggle } = useSidebar()

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-white border-b border-gray-100 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggle}
          className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base md:text-lg font-bold text-gray-900 leading-none truncate">{title}</h1>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
              {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">
              {session?.user?.name?.split(' ')[0]}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-40 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-50 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{session?.user?.name}</p>
                  <p className="text-xs text-gray-500 truncate" title={session?.user?.email ?? ''}>{session?.user?.email}</p>
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700">
                    {(() => {
                      const r = session?.user?.actualRole ?? session?.user?.role
                      if (r === 'ADMIN') return 'Administrador'
                      if (r === 'GERENTE') return 'Gerente'
                      if (r === 'SUPERINTENDENT') return 'Superintendente'
                      if (r === 'JURIDICO') return 'Jurídico'
                      return 'Analista de RH'
                    })()}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
