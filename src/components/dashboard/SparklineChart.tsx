'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface SparklineChartProps {
  data: { value: number }[]
  color: string
  height?: number
}

export function SparklineChart({ data, color, height = 36 }: SparklineChartProps) {
  if (!data || data.length < 2) return <div style={{ height }} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
