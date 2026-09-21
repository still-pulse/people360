'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Calendar, KanbanSquare, Users, BarChart3,
  Building2, Settings, ChevronRight, FileBarChart, UserPlus, Headphones, FileCheck, ClipboardList,
  ClipboardCheck, Brain, UserCheck, Contact,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/components/providers/SettingsProvider'
import { LastUpdateWidget } from '@/components/dashboard/LastUpdateWidget'
import { useSidebar } from '@/components/providers/SidebarProvider'

interface NavChild {
  href: string
  label: string
  allowedRoles?: string[]
  badgeKey?: string
}

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  allowedRoles?: string[]
  children?: NavChild[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['ADMIN', 'ANALYST'] },
  { href: '/calendario', label: 'Calendário', icon: Calendar, allowedRoles: ['ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE'] },
  { href: '/tarefas', label: 'Tarefas', icon: KanbanSquare, allowedRoles: ['ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE'] },
  {
    href: '/indicadores',
    label: 'Indicadores',
    icon: BarChart3,
    allowedRoles: ['ADMIN'],
    children: [
      { href: '/indicadores/pcd', label: 'PCD' },
      { href: '/indicadores/pcd/evidencias', label: 'Evidências PCD' },
      { href: '/indicadores/aprendiz', label: 'Aprendiz' },
      { href: '/indicadores/turnover', label: 'Turnover' },
      { href: '/indicadores/absenteismo', label: 'Absenteísmo' },
      { href: '/indicadores/engajamento', label: 'Engajamento' },
      { href: '/indicadores/nps', label: 'NPS / eNPS' },
      { href: '/indicadores/custo-rh', label: 'Custo de RH' },
      { href: '/indicadores/custo-contratacao', label: 'Custo de Contratação' },
      { href: '/indicadores/tempo-empresa', label: 'Tempo de Empresa' },
      { href: '/indicadores/treinamento', label: 'Treinamento & Dev.' },
    ],
  },
  // Item exclusivo para Superintendente — acesso direto às Evidências PCD
  { href: '/indicadores/pcd/evidencias', label: 'Evidências PCD', icon: FileCheck, allowedRoles: ['SUPERINTENDENT'] },
  // Itens exclusivos para Jurídico — Indicador PCD e Evidências PCD (Controle de Vagas usa o menu compartilhado)
  { href: '/indicadores/pcd', label: 'Indicador PCD', icon: BarChart3, allowedRoles: ['JURIDICO'] },
  { href: '/indicadores/pcd/evidencias', label: 'Evidências PCD', icon: FileCheck, allowedRoles: ['JURIDICO'] },
  { href: '/headcount', label: 'Headcount', icon: Users, allowedRoles: ['ADMIN'] },
  {
    href: '/colaboradores',
    label: 'Colaboradores',
    icon: Contact,
    allowedRoles: ['ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE'],
  },
  {
    href: '/vagas',
    label: 'Controle de Vagas',
    icon: UserPlus,
    allowedRoles: ['ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE', 'JURIDICO'],
    children: [
      { href: '/vagas', label: 'Dashboard' },
      { href: '/vagas/lista', label: 'Lista de Vagas' },
      { href: '/vagas/controle', label: 'Controle' },
      { href: '/vagas/pendentes', label: 'Pendentes de Aprovação', allowedRoles: ['ADMIN', 'SUPERINTENDENT', 'GERENTE', 'ANALYST'], badgeKey: 'pendentes' },
    ],
  },
  { href: '/candidatos', label: 'Controle de Candidatos', icon: ClipboardList, allowedRoles: ['ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE'] },
  {
    href: '/admissao-digital',
    label: 'Admissão Digital',
    icon: UserCheck,
    allowedRoles: ['ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE'],
    children: [
      { href: '/admissao-digital', label: 'Visão Geral' },
      { href: '/admissao-digital/admissoes', label: 'Admissões' },
      { href: '/admissao-digital/pendencias', label: 'Pendências' },
      { href: '/admissao-digital/revisao', label: 'Revisão de Documentos' },
      { href: '/admissao-digital/modelos', label: 'Modelos de Documentos' },
      { href: '/admissao-digital/configuracoes', label: 'Configurações', allowedRoles: ['ADMIN'] },
      { href: '/admissao-digital/auditoria', label: 'Logs e Auditoria', allowedRoles: ['ADMIN', 'GERENTE'] },
    ],
  },
  { href: '/pareceres', label: 'Pareceres', icon: ClipboardCheck, allowedRoles: ['ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE'] },
  { href: '/testes', label: 'Testes', icon: Brain, allowedRoles: ['ADMIN', 'ANALYST'] },
  {
    href: '/relatorios',
    label: 'Relatórios',
    icon: FileBarChart,
    allowedRoles: ['ADMIN'],
    children: [
      { href: '/relatorios',        label: 'Relatórios RH' },
      { href: '/relatorios/equipe', label: 'Desempenho da Equipe' },
    ],
  },
  { href: '/chamados',   label: 'Chamados',   icon: Headphones, allowedRoles: ['ADMIN', 'ANALYST'] },
  {
    href: '/admin',
    label: 'Administração',
    icon: Settings,
    allowedRoles: ['ADMIN'],
    children: [
      { href: '/admin/usuarios', label: 'Usuários' },
      { href: '/admin/unidades', label: 'Unidades' },
      { href: '/admin/cargos', label: 'Cargos' },
      { href: '/admin/configuracoes', label: 'Configurações' },
      { href: '/admin/logs', label: 'Logs de Auditoria' },
      { href: '/admin/email-logs', label: 'Logs de E-mails' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role ?? 'ANALYST'
  const actualRole = session?.user?.actualRole ?? role
  const isAdmin = role === 'ADMIN'
  const { settings } = useSettings()
  const logoUrl = settings.logoUrl
  const companyName = settings.companyName || 'People 360'
  const [chamadosUnread, setChamadosUnread] = useState(0)
  const [pendentesCount, setPendentesCount] = useState(0)
  const { isOpen, close } = useSidebar()

  useEffect(() => {
    const fetch_ = () => fetch('/api/chamados/unread').then((r) => r.json()).then((d) => setChamadosUnread(d.count)).catch(() => {})
    fetch_()
    const id = setInterval(fetch_, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const fetch_ = () => fetch('/api/vagas/pendentes').then((r) => r.json()).then((d) => setPendentesCount(Array.isArray(d) ? d.length : 0)).catch(() => {})
    fetch_()
    const id = setInterval(fetch_, 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={close}
        />
      )}
      <aside
      className={cn(
        'fixed left-0 top-0 h-screen w-60 flex flex-col z-50 bg-white border-r border-gray-100 transition-transform duration-200',
        'md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100 min-h-[96px]">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName}
            className="max-h-20 max-w-[192px] object-contain"
          />
        ) : (
          <>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-gray-900 font-bold text-sm leading-none">{companyName}</p>
              <p className="text-gray-400 text-xs mt-0.5">Gestão de Pessoas</p>
            </div>
          </>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin space-y-0.5">
        {navItems.map((item) => {
          if (item.allowedRoles && !item.allowedRoles.includes(role)) return null

          const hasChildren = !!item.children?.length
          const Icon = item.icon

          if (hasChildren) {
            const isParentActive =
              pathname === item.href ||
              pathname.startsWith(item.href + '/') ||
              item.children!.some((c) => pathname === c.href)

            return (
              <div key={item.href}>
                {/* Clica e navega para o primeiro filho */}
                <Link
                  href={item.children![0].href}
                  onClick={close}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                    isParentActive
                      ? 'text-gray-900'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  )}
                >
                  <Icon className={cn('w-4 h-4 flex-shrink-0',
                    isParentActive ? 'text-[#15AFA4]' : 'text-gray-400')} />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className={cn(
                    'w-3.5 h-3.5 transition-transform text-gray-400',
                    isParentActive && 'rotate-90 text-[#15AFA4]'
                  )} />
                </Link>

                {/* Sub-itens — visíveis quando parent ativo */}
                {isParentActive && (
                  <div className="ml-3 pl-4 border-l-2 border-[#15AFA4]/20 space-y-0.5 mt-0.5 mb-1">
                    {item.children!.map((child) => {
                      if (child.allowedRoles && !child.allowedRoles.includes(role)) return null
                      const isChildActive = pathname === child.href
                      const badge = child.badgeKey === 'pendentes' ? pendentesCount : 0
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={close}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                            isChildActive
                              ? 'text-[#15AFA4] bg-[#15AFA4]/10 font-semibold'
                              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                          )}
                        >
                          <span className="flex-1">{child.label}</span>
                          {badge > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                              {badge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'text-[#15AFA4] bg-[#15AFA4]/10 font-semibold'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0',
                isActive ? 'text-[#15AFA4]' : 'text-gray-400')} />
              <span className="flex-1">{item.label}</span>
              {item.href === '/chamados' && chamadosUnread > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                  style={{ background: '#15AFA4' }}>
                  {chamadosUnread > 99 ? '99+' : chamadosUnread}
                </span>
              )}
              {isActive && chamadosUnread === 0 && <div className="w-1.5 h-1.5 rounded-full bg-[#15AFA4]" />}
            </Link>
          )
        })}
      </nav>

      {/* Widget de última atualização */}
      <LastUpdateWidget />

      {/* Perfil */}
      <div className="p-3 border-t border-gray-100">
        <Link href="/perfil" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
          {session?.user?.avatarUrl ? (
            <img
              src={session.user.avatarUrl}
              alt={session.user.name ?? ''}
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
              {session?.user?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-gray-800 text-xs font-semibold truncate group-hover:text-[#15AFA4] transition-colors">{session?.user?.name}</p>
            <p className="text-gray-400 text-xs truncate">
              {actualRole === 'ADMIN' ? 'Administrador' : actualRole === 'GERENTE' ? 'Gerente' : actualRole === 'SUPERINTENDENT' ? 'Superintendente' : actualRole === 'JURIDICO' ? 'Jurídico' : 'Analista de RH'}
            </p>
          </div>
        </Link>
      </div>
    </aside>
    </>
  )
}
