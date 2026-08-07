'use client'

import { Calendar, Building2, ChevronDown } from 'lucide-react'

export type PeriodKey = 'current_month' | 'last_3' | 'last_6' | 'last_12' | 'current_year'

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'current_month', label: 'Mês Atual' },
  { value: 'last_3', label: 'Últimos 3 Meses' },
  { value: 'last_6', label: 'Últimos 6 Meses' },
  { value: 'last_12', label: 'Últimos 12 Meses' },
  { value: 'current_year', label: 'Ano Atual' },
]

interface Unit { id: string; name: string }

interface DashboardFiltersProps {
  period: PeriodKey
  unitId: string | null
  units: Unit[]
  onPeriodChange: (p: PeriodKey) => void
  onUnitChange?: (u: string | null) => void
}

export function DashboardFilters({ period, unitId, units, onPeriodChange, onUnitChange }: DashboardFiltersProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <select
          value={period}
          onChange={e => onPeriodChange(e.target.value as PeriodKey)}
          className="appearance-none pl-8 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-xl text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#15AFA4]/30 focus:border-[#15AFA4] cursor-pointer hover:border-gray-300 transition-colors"
        >
          {PERIOD_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      </div>

      {onUnitChange && (
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <select
            value={unitId ?? ''}
            onChange={e => onUnitChange(e.target.value || null)}
            className="appearance-none pl-8 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-xl text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#15AFA4]/30 focus:border-[#15AFA4] cursor-pointer hover:border-gray-300 transition-colors"
          >
            <option value="">Todas as Unidades</option>
            {units.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      )}
    </div>
  )
}
