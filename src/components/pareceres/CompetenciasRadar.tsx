'use client'

import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  PARECER_COMPETENCIAS_G1,
  PARECER_COMPETENCIAS_G2,
  COMPETENCIA_NIVEIS,
  type ParecerCompetenciaItem,
  type ParecerCompetencias,
} from '@/types'
import { cn } from '@/lib/utils'

interface CompetenciasRadarProps {
  values: ParecerCompetencias | Record<string, number>
  onChange?: (key: keyof ParecerCompetencias, value: number) => void
  readOnly?: boolean
  className?: string
}

function scoreColor(n: number) {
  if (n >= 5) return 'bg-emerald-500 text-white border-emerald-500'
  if (n >= 4) return 'bg-teal-500 text-white border-teal-500'
  if (n >= 3) return 'bg-amber-400 text-white border-amber-400'
  if (n >= 2) return 'bg-orange-400 text-white border-orange-400'
  return 'bg-red-400 text-white border-red-400'
}

function toChartData(
  items: ParecerCompetenciaItem[],
  values: ParecerCompetencias | Record<string, number>
) {
  return items.map((c) => ({
    subject: c.short,
    full: c.label,
    value: Number((values as Record<string, number>)[c.key] ?? 3),
    fullMark: 5,
  }))
}

function CompetenciaGroup({
  title,
  items,
  values,
  onChange,
  readOnly,
  stroke,
  fill,
}: {
  title: string
  items: ParecerCompetenciaItem[]
  values: ParecerCompetencias | Record<string, number>
  onChange?: (key: keyof ParecerCompetencias, value: number) => void
  readOnly?: boolean
  stroke: string
  fill: string
}) {
  const chartData = toChartData(items, values)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 bg-gradient-to-r from-gray-50/80 to-white">
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        <p className="text-[11px] text-gray-400 mt-0.5">{items.length} competências</p>
      </div>

      <div className="p-3 sm:p-4">
        <div className="rounded-xl border border-gray-100 bg-gradient-to-b from-gray-50/60 to-white p-2 min-h-[260px]">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart cx="50%" cy="50%" outerRadius="68%" data={chartData}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: '#6B7280', fontSize: 10 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 5]}
                tickCount={6}
                tick={{ fill: '#9CA3AF', fontSize: 9 }}
              />
              <Tooltip
                formatter={(value: number) => [value, 'Nota']}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ''}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  fontSize: 12,
                }}
              />
              <Radar
                name={title}
                dataKey="value"
                stroke={stroke}
                fill={fill}
                fillOpacity={0.35}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 space-y-2">
          {items.map((c) => {
            const val = Number((values as Record<string, number>)[c.key] ?? 3)
            return (
              <div
                key={c.key}
                className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/40 px-3 py-2.5 hover:border-[#15AFA4]/30 transition-colors"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border shrink-0',
                    scoreColor(val)
                  )}
                >
                  {val}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 leading-tight truncate" title={c.label}>
                    {c.label}
                  </p>
                  {!readOnly && (
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={val}
                      onChange={(e) => onChange?.(c.key, Number(e.target.value))}
                      className="w-full h-1.5 mt-1.5 accent-[#15AFA4] cursor-pointer"
                    />
                  )}
                  {readOnly && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {COMPETENCIA_NIVEIS.find((n) => n.value === val)?.label ?? ''}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function CompetenciasRadar({ values, onChange, readOnly = false, className }: CompetenciasRadarProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Competências de Suporte</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Níveis: {(COMPETENCIA_NIVEIS as readonly { value: number; label: string }[])
              .map((n) => `(${n.value}) ${n.label}`)
              .join(' · ')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CompetenciaGroup
          title="Grupo 1 — Entrega & Relacionamento"
          items={PARECER_COMPETENCIAS_G1}
          values={values}
          onChange={onChange}
          readOnly={readOnly}
          stroke="#15AFA4"
          fill="#15AFA4"
        />
        <CompetenciaGroup
          title="Grupo 2 — Liderança & Sistema"
          items={PARECER_COMPETENCIAS_G2}
          values={values}
          onChange={onChange}
          readOnly={readOnly}
          stroke="#7C3AED"
          fill="#7C3AED"
        />
      </div>
    </div>
  )
}
