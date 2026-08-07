'use client'

import { PARECER_TRAITS } from '@/types'
import { cn } from '@/lib/utils'
import type { TraitValues } from '@/lib/parecerTraits'

export type { TraitValues }

type TraitKey = (typeof PARECER_TRAITS)[number]['key']

interface TraitBarsProps {
  values: TraitValues
  onChange?: (key: TraitKey, value: number) => void
  /** Somente leitura — resultado final */
  readOnly?: boolean
  /** Texto auxiliar (ex.: calculado automaticamente) */
  hint?: string
  className?: string
}

function dominantLabel(value: number, left: string, right: string) {
  const pct = value >= 50 ? value : 100 - value
  const side = value >= 50 ? right : left
  return { pct, side }
}

export function TraitBars({ values, onChange, readOnly = false, hint, className }: TraitBarsProps) {
  return (
    <div className={cn('space-y-5', className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-semibold text-gray-800">Seus Traços</h3>
        {hint ? (
          <p className="text-xs text-gray-400">{hint}</p>
        ) : !readOnly ? (
          <p className="text-xs text-gray-400">Arraste para ajustar o perfil comportamental</p>
        ) : null}
      </div>

      <div className="space-y-6 rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50/80 to-white p-5 sm:p-6">
        {PARECER_TRAITS.map((trait) => {
          const value = values[trait.key] ?? 50
          const { pct, side } = dominantLabel(value, trait.left, trait.right)
          // Posição do marcador: 0 = esquerda, 100 = direita
          const markerLeft = `${value}%`

          return (
            <div key={trait.key} className="space-y-2">
              {/* Label dominante no centro-topo */}
              <div className="flex justify-center">
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: trait.color }}
                >
                  {pct}% {side}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-[88px] sm:w-[100px] text-right text-xs sm:text-sm text-gray-500 font-medium shrink-0">
                  {trait.left}
                </span>

                <div className="relative flex-1 h-3 sm:h-3.5">
                  {/* Track */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${trait.color} 0%, ${trait.color}cc 45%, ${trait.color}55 100%)`,
                      opacity: 0.9,
                    }}
                  />
                  {/* Marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white border-[3px] shadow-md z-10 pointer-events-none"
                    style={{ left: markerLeft, borderColor: trait.color }}
                  />
                  {/* Range input (edit mode) */}
                  {!readOnly && (
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={value}
                      onChange={(e) => onChange?.(trait.key, Number(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      aria-label={`${trait.left} vs ${trait.right}`}
                    />
                  )}
                </div>

                <span className="w-[88px] sm:w-[100px] text-left text-xs sm:text-sm text-gray-500 font-medium shrink-0">
                  {trait.right}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Gera código de tipo a partir dos traços (ex: INTJ-T) */
export function buildTypeCode(values: TraitValues): string {
  const letters = PARECER_TRAITS.map((t) => {
    const v = values[t.key] ?? 50
    return v >= 50 ? t.rightKey : t.leftKey
  })
  // Identity (A/T) is last; first 4 form the type
  return `${letters.slice(0, 4).join('')}-${letters[4]}`
}
