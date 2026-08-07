'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Position {
  id: string
  name: string
  categoria?: string | null
}

interface Props {
  value: string        // positionId (pode ser vazio quando usando valueByName)
  valueByName?: string // fallback: destaca pelo nome quando não há positionId
  onChange: (id: string, name: string) => void
  label?: string
  required?: boolean
  error?: string
  placeholder?: string
}

export function CargoCombobox({ value, valueByName, onChange, label, required, error, placeholder = 'Selecionar cargo...' }: Props) {
  const [positions, setPositions] = useState<Position[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/positions')
      .then((r) => r.json())
      .then((data) => setPositions(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const selected = positions.find((p) => p.id === value)
    ?? (valueByName ? positions.find((p) => p.name === valueByName) : undefined)

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return positions
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const q = norm(query)
    return positions.filter((p) => norm(p.name).includes(q))
  }, [positions, query])

  const grouped = useMemo(() => {
    const groups: Record<string, Position[]> = {}
    filtered.forEach((p) => {
      const cat = p.categoria || 'Outros'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(p)
    })
    return groups
  }, [filtered])

  const hasCategories = filtered.some((p) => p.categoria)

  function handleSelect(pos: Position) {
    onChange(pos.id, pos.name)
    setOpen(false)
    setQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('', '')
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setTimeout(() => inputRef.current?.focus(), 50) }}
          className={cn(
            'w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm text-left transition-all',
            error ? 'border-red-400 focus-within:border-red-500' : 'border-gray-200 focus-within:border-[#15AFA4]',
            open ? 'border-[#15AFA4] ring-2 ring-[#15AFA4]/10' : '',
            'bg-white hover:border-gray-300'
          )}
        >
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className={cn('flex-1 truncate', selected ? 'text-gray-900 font-medium' : 'text-gray-400')}>
            {selected ? selected.name : placeholder}
          </span>
          {value && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform flex-shrink-0', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pesquisar cargo..."
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-[#15AFA4]"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-sm text-center text-gray-400">Nenhum cargo encontrado</p>
              ) : hasCategories ? (
                Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{cat}</p>
                    {items.map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => handleSelect(pos)}
                        className={cn(
                          'w-full text-left px-4 py-2.5 text-sm transition-colors',
                          value === pos.id
                            ? 'bg-[#15AFA4]/10 text-[#15AFA4] font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        {pos.name}
                      </button>
                    ))}
                  </div>
                ))
              ) : (
                filtered.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => handleSelect(pos)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm transition-colors',
                      value === pos.id
                        ? 'bg-[#15AFA4]/10 text-[#15AFA4] font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {pos.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
