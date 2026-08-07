'use client'

import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts'

interface MetricWithChartCardProps {
  title: string
  icon: ReactNode
  iconColor: string
  value: string
  valueLabel?: string
  target?: string
  change: number
  changeLabel: string
  changeType?: 'percent' | 'pp' | 'days' | 'value'
  positiveIsGood?: boolean
  chartData: { month: string; value: number }[]
  chartType?: 'bar' | 'line'
  chartColor?: string
  referenceValue?: number
  isLoading?: boolean
  unit?: string
}

function fmtChange(change: number, type: string) {
  const sign = change > 0 ? '+' : ''
  if (type === 'pp') return `${sign}${change.toFixed(1).replace('.', ',')} p.p.`
  if (type === 'percent') return `${sign}${change.toFixed(1).replace('.', ',')}%`
  if (type === 'days') return `${sign}${change} dias`
  return `${sign}${change}`
}

export function MetricWithChartCard({
  title, icon, iconColor, value, valueLabel, target,
  change, changeLabel, changeType = 'value', positiveIsGood = true,
  chartData, chartType = 'bar', chartColor, referenceValue, isLoading, unit = '%',
}: MetricWithChartCardProps) {
  const color = chartColor ?? iconColor
  const isPos = change > 0
  const isNeg = change < 0
  const isGood = positiveIsGood ? isPos : isNeg
  const isBad = positiveIsGood ? isNeg : isPos
  const textColor = isGood ? 'text-green-600' : isBad ? 'text-red-500' : 'text-gray-500'
  const bgColor = isGood ? 'bg-green-50' : isBad ? 'bg-red-50' : 'bg-gray-50'
  const ChangeIcon = isGood ? TrendingUp : isBad ? TrendingDown : Minus

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
      {isLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-12 bg-gray-100 rounded" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
          <div className="h-28 bg-gray-50 rounded" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${iconColor}18` }}>
              <span style={{ color: iconColor }}>{icon}</span>
            </div>
            <div>
              <p className="text-3xl font-black text-gray-900 leading-none">{value}</p>
              {valueLabel && <p className="text-xs text-gray-500 mt-0.5">{valueLabel}</p>}
            </div>
          </div>
          {target && (
            <p className="text-xs text-gray-400 mb-2">Meta: {target}</p>
          )}
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold self-start mb-3 ${bgColor} ${textColor}`}>
            <ChangeIcon className="w-3 h-3" />
            <span>{fmtChange(change, changeType)} vs. {changeLabel}</span>
          </div>
          <div className="flex-1" style={{ minHeight: 110 }}>
            <ResponsiveContainer width="100%" height={110}>
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} />
                  <Tooltip
                    formatter={(v: number) => [`${v}`]}
                    contentStyle={{ borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                  />
                  {referenceValue !== undefined && (
                    <ReferenceLine y={referenceValue} stroke="#94A3B8" strokeDasharray="4 4" />
                  )}
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={color} fillOpacity={i === chartData.length - 1 ? 1 : 0.6} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} domain={['auto', 'auto']} />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(1).replace('.', ',')}${unit}`]}
                    contentStyle={{ borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                  />
                  {referenceValue !== undefined && (
                    <ReferenceLine y={referenceValue} stroke="#94A3B8" strokeDasharray="4 4" />
                  )}
                  <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
