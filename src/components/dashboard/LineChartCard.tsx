'use client'

import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'

interface LineChartCardProps {
  title: string
  subtitle?: string
  data: { month: string; value: number }[]
  color?: string
  unit?: string
  isLoading?: boolean
  referenceValue?: number
  referenceLabel?: string
  height?: number
}

const CustomDot = (props: any) => {
  const { cx, cy, index, data, color } = props
  if (index !== data?.length - 1) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill={color} fillOpacity={0.15} />
      <circle cx={cx} cy={cy} r={5} fill={color} />
      <text x={cx} y={cy - 16} textAnchor="middle" fill={color} fontSize={11} fontWeight={700}>
        {data[index]?.value.toFixed(1).replace('.', ',')}%
      </text>
    </g>
  )
}

export function LineChartCard({
  title, subtitle, data, color = '#15AFA4', unit = '%',
  isLoading, referenceValue, referenceLabel, height = 260,
}: LineChartCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {isLoading ? (
        <div className="animate-pulse bg-gray-50 rounded-xl" style={{ height }} />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 24, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} />
            <YAxis
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              tickFormatter={v => `${v}${unit}`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(1).replace('.', ',')}${unit}`, title]}
              contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }}
            />
            {referenceValue !== undefined && (
              <ReferenceLine y={referenceValue} stroke="#94A3B8" strokeDasharray="4 4"
                label={{ value: referenceLabel ?? `${referenceValue}${unit}`, position: 'insideTopRight', fontSize: 10, fill: '#94A3B8' }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={(props) => <CustomDot {...props} data={data} color={color} />}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
