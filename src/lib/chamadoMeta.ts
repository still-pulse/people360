import { Clock, Timer, Palmtree, UserX } from 'lucide-react'

export const TIPO_META: Record<string, { label: string; icon: React.ElementType; color: string; hex: string }> = {
  HORAS_EXTRAS: { label: 'Horas extras',        icon: Clock,    color: 'text-indigo-600 bg-indigo-50', hex: '#6366F1' },
  BANCO_HORAS:  { label: 'Usar banco de horas',  icon: Timer,    color: 'text-purple-600 bg-purple-50', hex: '#A855F7' },
  FOLGA:        { label: 'Folga',               icon: Palmtree, color: 'text-teal-600 bg-teal-50',     hex: '#14B8A6' },
  AUSENCIA:     { label: 'Ausência',            icon: UserX,    color: 'text-orange-600 bg-orange-50', hex: '#F97316' },
}
