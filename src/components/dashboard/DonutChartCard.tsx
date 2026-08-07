'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface DonutItem {
  label: string
  value: number
  color: string
  percentage?: number
}

interface DonutChartCardProps {
  title: string
  subtitle?: string
  data: DonutItem[]
  unit?: string
  isLoading?: boolean
  height?: number
  showPercentInLegend?: boolean
}

export function DonutChartCard({
  title, subtitle, data, unit = '%',
  isLoading, height = 220, showPercentInLegend = false,
}: DonutChartCardProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const isEmpty = data.length === 0 || total === 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {isLoading ? (
        <div className="animate-pulse bg-gray-50 rounded-xl flex-1" style={{ minHeight: height }} />
      ) : isEmpty ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm" style={{ minHeight: height }}>
          Sem dados disponíveis
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={height * 0.28}
                outerRadius={height * 0.42}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((item, i) => (
                  <Cell key={i} fill={item.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, name: string) => [
                  `${v.toFixed(1).replace('.', ',')}${unit}`,
                  name,
                ]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="w-full space-y-2">
            {data.map((item, i) => {
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <span className="text-xs text-gray-600 font-medium truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs font-bold text-gray-800">
                      {showPercentInLegend
                        ? `${item.value.toFixed(1).replace('.', ',')}${unit}`
                        : item.value.toLocaleString('pt-BR')}
                    </span>
                    {!showPercentInLegend && (
                      <span className="text-xs text-gray-400">({pct}%)</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
