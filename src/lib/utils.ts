import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { MONTHS_PT } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMonthYear(year: number, month: number): string {
  return `${MONTHS_PT[month - 1]}/${year}`
}

export function formatMonthShort(year: number, month: number): string {
  return `${MONTHS_PT[month - 1].slice(0, 3)}/${String(year).slice(2)}`
}

export function calculateTurnoverRate(
  admissions: number,
  dismissals: number,
  headcountStart: number,
  headcountEnd: number
): number {
  const avgHeadcount = (headcountStart + headcountEnd) / 2
  if (avgHeadcount === 0) return 0
  return ((admissions + dismissals) / 2 / avgHeadcount) * 100
}

export function calculateAbsenteeismRate(
  totalDaysLost: number,
  totalEmployees: number,
  workingDays: number
): number {
  const totalWorkDays = totalEmployees * workingDays
  if (totalWorkDays === 0) return 0
  return (totalDaysLost / totalWorkDays) * 100
}

export function calculatePCDMinimum(totalEmployees: number, metaPercentage: number): number {
  return Math.ceil((totalEmployees * metaPercentage) / 100)
}

/** Unidade entra no indicador no mês/ano? (respeita exibirIndicadores + data limite) */
export function unitVisibleInIndicators(
  unit: {
    exibirIndicadores?: boolean | null
    indicadoresAteYear?: number | null
    indicadoresAteMonth?: number | null
  },
  year: number,
  month: number,
): boolean {
  if (unit.exibirIndicadores === false) return false
  if (unit.indicadoresAteYear == null || unit.indicadoresAteMonth == null) return true
  return year * 12 + month <= unit.indicadoresAteYear * 12 + unit.indicadoresAteMonth
}

export function getPCDStatus(current: number, required: number): 'below' | 'attention' | 'ok' {
  if (current < required) return 'below'
  if (current < required * 1.1) return 'attention'
  return 'ok'
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

const TZ = 'America/Sao_Paulo'

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDatetime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'URGENT': return 'bg-red-100 text-red-700 border-red-200'
    case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'LOW': return 'bg-green-100 text-green-700 border-green-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'BACKLOG': return 'bg-gray-100 text-gray-700'
    case 'TODO': return 'bg-blue-100 text-blue-700'
    case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700'
    case 'WAITING': return 'bg-purple-100 text-purple-700'
    case 'DONE': return 'bg-green-100 text-green-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

export function getEventTypeColor(eventType: string): string {
  switch (eventType) {
    case 'PROCESSO_SELETIVO': return '#15AFA4'
    case 'REUNIAO': return '#3B82F6'
    case 'TREINAMENTO': return '#8B5CF6'
    case 'VISITA': return '#F59E0B'
    case 'OUTRO': return '#6B7280'
    default: return '#15AFA4'
  }
}

export function generateCurrentMonths(count = 12): { year: number; month: number }[] {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
}
