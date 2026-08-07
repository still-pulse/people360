'use client'

import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Search, Link2, X, ChevronDown } from 'lucide-react'
import {
  ControleCandidatoStatus, CONTROLE_CANDIDATO_STATUS_LABELS,
} from '@/types'
import type { ControleCandidatoData } from '@/types'
import { CargoCombobox } from '@/components/ui/cargo-combobox'

interface VagaOption {
  id: string
  titulo: string
  cargo: string
  municipio?: string | null
  dataAbertura: string
  unit?: { name: string; color: string } | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  candidato?: ControleCandidatoData | null
  users: { id: string; name: string }[]
  isAdmin: boolean
}

const statusOptions = (Object.keys(CONTROLE_CANDIDATO_STATUS_LABELS) as ControleCandidatoStatus[]).map((v) => ({
  value: v,
  label: CONTROLE_CANDIDATO_STATUS_LABELS[v],
}))

const EMPTY = {
  nome: '',
  telefone: '',
  funcao: '',
  dataProcesso: new Date().toISOString().slice(0, 10),
  analistaIds: [] as string[],
  municipio: '',
  status: 'BANCO_TALENTOS' as ControleCandidatoStatus,
  observacoes: '',
}

function AnalistasMultiSelect({
  users,
  value,
  onChange,
}: {
  users: { id: string; name: string }[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div ref={ref} className="relative space-y-1.5">
      <label className="text-sm font-medium text-gray-700">Analistas Responsáveis</label>
      <div
        onClick={() => setOpen((o) => !o)}
        className="min-h-[42px] flex flex-wrap gap-1.5 px-3 py-2 rounded-xl border border-gray-200 cursor-pointer hover:border-[#15AFA4]/60 transition-colors"
      >
        {value.length === 0 ? (
          <span className="text-sm text-gray-400 self-center flex-1">Sem analista</span>
        ) : (
          value.map((id) => {
            const u = users.find((u) => u.id === id)
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#15AFA4]/10 text-[#15AFA4] text-xs font-medium">
                {u?.name ?? id}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(id) }}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 self-center ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {users.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">Nenhum analista disponível</p>
            ) : (
              users.map((u) => (
                <label key={u.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value.includes(u.id)}
                    onChange={() => toggle(u.id)}
                    className="w-4 h-4 rounded accent-[#15AFA4]"
                  />
                  <span className="text-sm text-gray-700">{u.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function CandidatoControleModal({ open, onClose, onSaved, candidato, users, isAdmin }: Props) {
  const isEdit = !!candidato
  const [form, setForm] = useState({ ...EMPTY })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [funcaoCargoId, setFuncaoCargoId] = useState('')

  // Busca de vaga para auto-preenchimento
  const [vagaQuery, setVagaQuery] = useState('')
  const [vagaResults, setVagaResults] = useState<VagaOption[]>([])
  const [showVagaSearch, setShowVagaSearch] = useState(false)
  const [selectedVaga, setSelectedVaga] = useState<VagaOption | null>(null)
  const vagaSearchRef = useRef<HTMLDivElement>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (vagaSearchRef.current && !vagaSearchRef.current.contains(e.target as Node)) {
        setShowVagaSearch(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Busca vagas com debounce
  useEffect(() => {
    if (!vagaQuery.trim() || vagaQuery.length < 2) { setVagaResults([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/vagas?search=${encodeURIComponent(vagaQuery)}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setVagaResults(Array.isArray(data) ? data.slice(0, 15) : [])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [vagaQuery])

  useEffect(() => {
    if (open) {
      setVagaQuery('')
      setVagaResults([])
      setShowVagaSearch(false)
      setSelectedVaga(null)
      setFuncaoCargoId('')
      if (candidato) {
        setForm({
          nome: candidato.nome,
          telefone: candidato.telefone ?? '',
          funcao: candidato.funcao,
          dataProcesso: candidato.dataProcesso?.slice(0, 10) ?? '',
          analistaIds: candidato.analistas?.map((a) => a.id) ?? [],
          municipio: candidato.municipio ?? '',
          status: candidato.status,
          observacoes: (candidato as any).observacoes ?? '',
        })
      } else {
        setForm({ ...EMPTY })
      }
      setError('')
    }
  }, [open, candidato])

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }))

  function selectVaga(v: VagaOption) {
    setSelectedVaga(v)
    setShowVagaSearch(false)
    setVagaQuery('')
    setVagaResults([])
    setFuncaoCargoId('')
    set('funcao', v.cargo)
    set('dataProcesso', v.dataAbertura.slice(0, 10))
    if (v.municipio) set('municipio', v.municipio)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { setError('Nome é obrigatório'); return }
    if (!form.funcao.trim()) { setError('Função é obrigatória'); return }
    if (!form.dataProcesso) { setError('Data do processo é obrigatória'); return }

    setIsSaving(true)
    setError('')
    try {
      const url = isEdit ? `/api/candidatos-controle/${candidato!.id}` : '/api/candidatos-controle'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Erro ao salvar')
        return
      }
      onSaved()
      onClose()
    } finally {
      setIsSaving(false)
    }
  }


  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Candidato' : 'Novo Candidato'} size="lg">
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">

          {/* Identificação */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identificação</p>
            <div className="space-y-3">
              <Input
                label="Nome completo *"
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Nome do candidato"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Telefone"
                  value={form.telefone}
                  onChange={(e) => set('telefone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
                <Input
                  label="Município"
                  value={form.municipio}
                  onChange={(e) => set('municipio', e.target.value)}
                  placeholder="Cidade do candidato"
                />
              </div>
            </div>
          </div>

          {/* Processo Seletivo */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Processo Seletivo</p>
            <div className="space-y-3">

              {/* Vincular à Vaga (auto-preenche função e data) */}
              <div className="space-y-1.5" ref={vagaSearchRef}>
                <label className="text-sm font-medium text-gray-700">Vincular à Vaga (opcional)</label>

                {selectedVaga ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#15AFA4] bg-[#15AFA4]/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{selectedVaga.cargo}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {selectedVaga.unit?.name ?? ''}{selectedVaga.municipio ? ` · ${selectedVaga.municipio}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedVaga(null)}
                      className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        value={vagaQuery}
                        onChange={(e) => { setVagaQuery(e.target.value); setShowVagaSearch(true) }}
                        onFocus={() => setShowVagaSearch(true)}
                        placeholder="Buscar vaga pelo cargo ou título..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      Selecionar preenche automaticamente Função e Data do Processo
                    </p>

                    {showVagaSearch && vagaQuery.length >= 2 && (
                      <div className="absolute z-50 top-[calc(100%-4px)] left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                        <div className="max-h-48 overflow-y-auto">
                          {vagaResults.length === 0 ? (
                            <p className="px-3 py-4 text-xs text-gray-400 text-center">Nenhuma vaga encontrada</p>
                          ) : (
                            vagaResults.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => selectVaga(v)}
                                className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-[#15AFA4]/5 text-left transition-colors border-b border-gray-50 last:border-0"
                              >
                                {v.unit && (
                                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: v.unit.color }} />
                                )}
                                <div>
                                  <p className="text-sm font-medium text-gray-800">{v.cargo}</p>
                                  <p className="text-xs text-gray-500">
                                    {v.unit?.name ?? ''}{v.municipio ? ` · ${v.municipio}` : ''}
                                  </p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CargoCombobox
                  label="Função / Cargo *"
                  required
                  value={funcaoCargoId}
                  valueByName={form.funcao}
                  onChange={(id, name) => {
                    setFuncaoCargoId(id)
                    set('funcao', name)
                  }}
                />
                <Input
                  label="Data do Processo *"
                  type="date"
                  value={form.dataProcesso}
                  onChange={(e) => set('dataProcesso', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Classificação */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Classificação</p>
            <div className="grid grid-cols-2 gap-3">
              {isAdmin ? (
                <AnalistasMultiSelect
                  users={users}
                  value={form.analistaIds}
                  onChange={(ids) => set('analistaIds', ids)}
                />
              ) : (
                <div />
              )}
              <Select
                label="Status"
                value={form.status}
                onChange={(e) => set('status', e.target.value as ControleCandidatoStatus)}
                options={statusOptions}
              />
            </div>
          </div>

          <Textarea
            label="Observações"
            value={form.observacoes}
            onChange={(e) => set('observacoes', e.target.value)}
            placeholder="Notas sobre o candidato..."
            rows={3}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {isEdit ? 'Salvar alterações' : 'Criar Candidato'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
