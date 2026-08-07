'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, ChevronDown, X, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CONTROLE_CANDIDATO_STATUS_LABELS,
  CONTROLE_CANDIDATO_STATUS_COLORS,
  type ControleCandidatoData,
} from '@/types'

interface Props {
  value: string
  onChange: (candidato: ControleCandidatoData | null) => void
  label?: string
  required?: boolean
  error?: string
  /** Inclui o candidato já vinculado (edição) mesmo se a lista filtrar por status */
  initialCandidato?: {
    id: string
    nome: string
    funcao: string
    telefone?: string | null
    municipio?: string | null
    status?: string
  } | null
}

export function CandidatoCombobox({
  value,
  onChange,
  label = 'Candidato',
  required,
  error,
  initialCandidato,
}: Props) {
  const [candidatos, setCandidatos] = useState<ControleCandidatoData[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/candidatos-controle')
      .then((r) => r.json())
      .then((data) => setCandidatos(Array.isArray(data) ? data : []))
      .catch(() => setCandidatos([]))
      .finally(() => setLoading(false))
  }, [])

  const selected = useMemo(() => {
    const fromList = candidatos.find((c) => c.id === value)
    if (fromList) return fromList
    if (initialCandidato && initialCandidato.id === value) {
      return {
        id: initialCandidato.id,
        nome: initialCandidato.nome,
        funcao: initialCandidato.funcao,
        telefone: initialCandidato.telefone ?? null,
        municipio: initialCandidato.municipio ?? null,
        status: (initialCandidato.status as ControleCandidatoData['status']) || 'BANCO_TALENTOS',
        dataProcesso: '',
        createdAt: '',
        updatedAt: '',
        analistas: [],
      } as ControleCandidatoData
    }
    return undefined
  }, [candidatos, value, initialCandidato])

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
    if (!query.trim()) return candidatos
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const q = norm(query)
    return candidatos.filter(
      (c) =>
        norm(c.nome).includes(q) ||
        norm(c.funcao).includes(q) ||
        norm(c.municipio || '').includes(q) ||
        norm(c.telefone || '').includes(q)
    )
  }, [candidatos, query])

  function handleSelect(c: ControleCandidatoData) {
    onChange(c)
    setOpen(false)
    setQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm text-left transition-all',
            error ? 'border-red-400' : 'border-gray-200',
            open ? 'border-[#15AFA4] ring-2 ring-[#15AFA4]/20' : 'hover:border-gray-300',
            'bg-white'
          )}
        >
          <User className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            {selected ? (
              <>
                <p className="font-medium text-gray-900 truncate">{selected.nome}</p>
                <p className="text-xs text-gray-400 truncate">
                  {selected.funcao}
                  {selected.municipio ? ` · ${selected.municipio}` : ''}
                </p>
              </>
            ) : (
              <span className="text-gray-400">
                {loading ? 'Carregando candidatos...' : 'Selecionar do Controle de Candidatos...'}
              </span>
            )}
          </div>
          {selected && (
            <span
              onClick={handleClear}
              className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
              role="button"
              title="Limpar"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome, função ou município..."
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-[#15AFA4]"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">
                  {loading
                    ? 'Carregando...'
                    : candidatos.length === 0
                      ? 'Nenhum candidato no Controle de Candidatos'
                      : 'Nenhum resultado para a busca'}
                </p>
              ) : (
                filtered.map((c) => {
                  const isActive = c.id === value
                  const statusColor = CONTROLE_CANDIDATO_STATUS_COLORS[c.status] || '#94A3B8'
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={cn(
                        'w-full flex items-start gap-3 px-3.5 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0',
                        isActive && 'bg-[#15AFA4]/5'
                      )}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                        style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}
                      >
                        {c.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.nome}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {c.funcao}
                          {c.municipio ? ` · ${c.municipio}` : ''}
                          {c.telefone ? ` · ${c.telefone}` : ''}
                        </p>
                      </div>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white shrink-0"
                        style={{ background: statusColor }}
                      >
                        {CONTROLE_CANDIDATO_STATUS_LABELS[c.status] || c.status}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
              <p className="text-[10px] text-gray-400">
                {candidatos.length} candidato(s) no Controle · cadastre novos em Controle de Candidatos
              </p>
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
