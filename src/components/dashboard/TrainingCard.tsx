'use client'

import { BookOpen, Clock, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface TrainingCardProps {
  totalHours: number
  avgHoursPerEmployee: number
  participationRate: number
  hrsChange: number
  avgChange: number
  rateChange: number
  isLoading?: boolean
}

function Metric({
  icon, label, value, change,
}: { icon: React.ReactNode; label: string; value: string; change: number }) {
  const isPos = change > 0
  const isNeg = change < 0
  const textColor = isPos ? 'text-green-600' : isNeg ? 'text-red-500' : 'text-gray-400'
  const ChangeIcon = isPos ? TrendingUp : isNeg ? TrendingDown : Minus
  const sign = change > 0 ? '+' : ''

  return (
    <div className="flex flex-col items-center text-center gap-1.5">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#15AFA4]/10">
        <span className="text-[#15AFA4]">{icon}</span>
      </div>
      <p className="text-xs text-gray-500 font-medium leading-tight">{label}</p>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <div className={`flex items-center gap-0.5 text-xs font-semibold ${textColor}`}>
        <ChangeIcon className="w-3 h-3" />
        <span>{sign}{change.toFixed(1).replace('.', ',')} vs. anterior</span>
      </div>
    </div>
  )
}

export function TrainingCard({
  totalHours, avgHoursPerEmployee, participationRate,
  hrsChange, avgChange, rateChange, isLoading,
}: TrainingCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-800">Treinamento e Desenvolvimento</h3>
      </div>
      {isLoading ? (
        <div className="animate-pulse flex gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gray-100 rounded-xl" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-6 bg-gray-100 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-start justify-around gap-4 flex-1">
          <Metric
            icon={<Clock className="w-5 h-5" />}
            label="Horas de Treinamento"
            value={totalHours >= 1000 ? `${(totalHours / 1000).toFixed(1).replace('.', ',')} mil` : String(totalHours)}
            change={hrsChange}
          />
          <div className="w-px bg-gray-100 self-stretch" />
          <Metric
            icon={<BookOpen className="w-5 h-5" />}
            label="Média de Horas por Colaborador"
            value={`${avgHoursPerEmployee.toFixed(1).replace('.', ',')} h`}
            change={avgChange}
          />
          <div className="w-px bg-gray-100 self-stretch" />
          <Metric
            icon={<Target className="w-5 h-5" />}
            label="Taxa de Participação"
            value={`${participationRate.toFixed(0)}%`}
            change={rateChange}
          />
        </div>
      )}
      {!isLoading && totalHours === 0 && (
        <p className="text-xs text-gray-400 text-center mt-3">
          Dados de treinamento serão exibidos quando disponíveis
        </p>
      )}
    </div>
  )
}
