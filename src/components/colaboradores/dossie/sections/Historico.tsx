'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api, errorMessage } from '../api'
import { useDossie } from '../context'
import { EmptyState, fmtDate, Notice, SectionTitle } from '../parts'
import type { TimelineItem } from '../types'

const GRUPOS = [
  { id: 'todos', label: 'Linha do tempo' }, { id: 'salario', label: 'Salarial' }, { id: 'cargo', label: 'Cargo' },
  { id: 'jornada', label: 'Jornada / escala' }, { id: 'unidade', label: 'Unidade / setor' },
]
const PAGE = 30

/** Histórico funcional (somente leitura, append-only) com paginação "carregar mais". */
export function Historico() {
  const { id, version } = useDossie()
  const [grupo, setGrupo] = useState('todos')
  const [items, setItems] = useState<TimelineItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (reset: boolean, skip: number) => {
    setLoading(true); setError('')
    try {
      const data = await api<{ items: TimelineItem[]; total: number }>(`/api/colaboradores/${id}/dossie/historico?grupo=${grupo}&skip=${skip}&take=${PAGE}`)
      setItems((cur) => (reset ? data.items : [...cur, ...data.items])); setTotal(data.total)
    } catch (e) { setError(errorMessage(e)) } finally { setLoading(false) }
  }, [id, grupo])

  useEffect(() => { load(true, 0) }, [load, version])
  const money = grupo === 'salario'

  return (
    <div className="space-y-4">
      <SectionTitle title="Histórico funcional" description="Registro permanente de admissão, contratos, avaliações e alterações de salário, cargo, jornada e unidade." />
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
        {GRUPOS.map((g) => (
          <button key={g.id} onClick={() => setGrupo(g.id)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${grupo === g.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{g.label}</button>
        ))}
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {!loading && !items.length ? (
        <Card><EmptyState title="Nenhum registro neste histórico." description="Os eventos aparecem aqui automaticamente conforme documentos e aditivos são gerados." /></Card>
      ) : (
        <Card className="divide-y divide-gray-50">
          {items.map((e) => (
            <div key={e.id} className="flex gap-4 p-4">
              <div className="w-24 flex-shrink-0 text-xs text-gray-400 pt-0.5">{fmtDate(e.dataEvento)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{e.titulo}</p>
                {(e.anterior || e.novo) && <p className="text-sm text-gray-600 mt-0.5"><span className="text-gray-400">{e.anterior || '—'}</span> → <span>{e.novo || '—'}</span></p>}
                <p className="text-xs text-gray-400 mt-1">{e.tipoLabel}{e.motivo && !money ? ` · ${e.motivo}` : ''}{e.motivo && money ? ` · Motivo: ${e.motivo}` : ''}{e.documentoTitulo ? ` · Documento: ${e.documentoTitulo}` : ''}{e.responsavelNome ? ` · ${e.responsavelNome}` : ''}</p>
              </div>
            </div>
          ))}
          {loading && <div className="p-4 text-sm text-gray-400">Carregando…</div>}
        </Card>
      )}
      {items.length < total && !loading && <div className="flex justify-center"><Button variant="outline" size="sm" onClick={() => load(false, items.length)}>Carregar mais ({total - items.length})</Button></div>}
    </div>
  )
}
