'use client'

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'

interface HorizontalBarCardProps {
  title: string
  subtitle?: string
  data: { label: string; value: number }[]
  color?: string
  unit?: string
  isLoading?: boolean
  height?: number
}

export function HorizontalBarCard({
  title, subtitle, data, color = '#8B5CF6',
  unit = '%', isLoading, height,
}: HorizontalBarCardProps) {
  const computed = height ?? Math.max(180, data.length * 36 + 40)
  const isEmpty = data.length === 0

  const rechartData = data.map(d => ({ name: d.label, value: d.value }))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {isLoading ? (
        <div className="animate-pulse bg-gray-50 rounded-xl" style={{ height: computed }} />
      ) : isEmpty ? (
        <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height: computed }}>
          Sem dados disponíveis
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={computed}>
          <BarChart
            data={rechartData}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              tickFormatter={v => `${v}${unit}`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10, fill: '#6B7280' }}
              width={90}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(1).replace('.', ',')}${unit}`]}
              contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} fill={color}
              label={{ position: 'right', fontSize: 10, fill: '#6B7280', formatter: (v: number) => `${v}${unit}` }}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
