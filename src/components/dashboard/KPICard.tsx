'use client'

import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { SparklineChart } from './SparklineChart'

type ChangeType = 'percent' | 'pp' | 'value'

interface KPICardProps {
  title: string
  value: string
  change: number
  previousLabel: string
  changeType?: ChangeType
  sparkline: { month: string; value: number }[]
  icon: ReactNode
  color: string
  positiveIsGood?: boolean
  isLoading?: boolean
}

function formatChange(change: number, type: ChangeType): string {
  const sign = change > 0 ? '+' : ''
  if (type === 'pp') return `${sign}${change.toFixed(1).replace('.', ',')} p.p.`
  if (type === 'percent') return `${sign}${change.toFixed(1).replace('.', ',')}%`
  return `${sign}${change}`
}

export function KPICard({
  title, value, change, previousLabel, changeType = 'percent',
  sparkline, icon, color, positiveIsGood = true, isLoading,
}: KPICardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse" style={{ minHeight: 168 }}>
        <div className="w-10 h-10 bg-gray-100 rounded-xl mb-3" />
        <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
        <div className="h-7 bg-gray-100 rounded w-1/2 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-full mb-3" />
        <div className="h-9 bg-gray-100 rounded" />
      </div>
    )
  }

  const isPos = change > 0
  const isNeg = change < 0
  const isGood = positiveIsGood ? isPos : isNeg
  const isBad = positiveIsGood ? isNeg : isPos
  const textColor = isGood ? 'text-green-600' : isBad ? 'text-red-500' : 'text-gray-500'
  const bgColor = isGood ? 'bg-green-50' : isBad ? 'bg-red-50' : 'bg-gray-50'
  const Icon = isGood ? TrendingUp : isBad ? TrendingDown : Minus

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium leading-tight">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold self-start ${bgColor} ${textColor}`}>
        <Icon className="w-3 h-3" />
        <span>{formatChange(change, changeType)} vs. {previousLabel}</span>
      </div>
      <div className="-mx-1 mt-auto">
        <SparklineChart data={sparkline} color={color} height={36} />
      </div>
    </div>
  )
}
