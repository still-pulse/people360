'use client'

import { useState } from 'react'
import { FilePlus2, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDossie } from '../context'
import { useResource } from '../hooks'
import { EmptyState, fmtDate, Notice, SectionTitle } from '../parts'
import { DependenteModal } from '../modals/Dependente'
import type { DependenteRow } from '../types'

const yn = (v: boolean) => (v ? <Badge variant="success">Sim</Badge> : <span className="text-gray-300">—</span>)

export function Dependentes() {
  const { id, version, can, openNovoDocumento } = useDossie()
  const { data, loading, error } = useResource<{ items: DependenteRow[] }>(`/api/colaboradores/${id}/dossie/dependentes`, version)
  const [modal, setModal] = useState<{ open: boolean; editing: DependenteRow | null }>({ open: false, editing: null })
  const canEdit = can('employee.dependents.edit')
  const addButton = canEdit ? <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setModal({ open: true, editing: null })}>Adicionar dependente</Button> : null
  const docs = [
    { tipo: 'DECLARACAO_DEPENDENTES_IR', label: 'Declaração para IR' },
    { tipo: 'TERMO_RESPONSABILIDADE', label: 'Termo de responsabilidade' },
    { tipo: 'FICHA_SALARIO_FAMILIA', label: 'Ficha de salário-família' },
  ]

  return (
    <div className="space-y-4">
      <SectionTitle title="Dependentes" description="Base para a declaração de IR, o termo de responsabilidade e a ficha de salário-família." action={addButton} />
      {error && <Notice tone="danger">{error}</Notice>}
      {loading && !data ? <Card className="p-6 text-sm text-gray-400">Carregando…</Card> : !data?.items.length ? (
        <Card><EmptyState title="Nenhum dependente cadastrado." description="Cadastre os dependentes para gerar automaticamente as declarações e termos." action={addButton} /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Nome</th><th className="px-4 py-3 font-medium">CPF</th><th className="px-4 py-3 font-medium">Nascimento</th><th className="px-4 py-3 font-medium">Parentesco</th>
              <th className="px-4 py-3 font-medium">IR</th><th className="px-4 py-3 font-medium">Sal. família</th><th className="px-4 py-3 font-medium">Plano</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3" />
            </tr></thead>
            <tbody>
              {data.items.map((d) => (
                <tr key={d.id} className={`border-b border-gray-50 last:border-0 ${d.ativo ? '' : 'opacity-60'}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{d.nome}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.cpfMascarado || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDate(d.nascimento)}</td>
                  <td className="px-4 py-3">{d.parentesco}</td>
                  <td className="px-4 py-3">{yn(d.dependenteIr)}</td><td className="px-4 py-3">{yn(d.salarioFamilia)}</td><td className="px-4 py-3">{yn(d.planoSaude)}</td>
                  <td className="px-4 py-3">{d.ativo ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Excluído {fmtDate(d.exclusaoEm)}</Badge>}</td>
                  <td className="px-4 py-3 text-right">{canEdit && <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setModal({ open: true, editing: d })}>Editar</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {can('employee.documents.create') && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-gray-800 mb-1">Gerar documentos dos dependentes</p>
          <p className="text-xs text-gray-400 mb-3">Os dependentes cadastrados são inseridos automaticamente.</p>
          <div className="flex flex-wrap gap-2">{docs.map((d) => <Button key={d.tipo} variant="outline" size="sm" icon={<FilePlus2 className="w-3.5 h-3.5" />} onClick={() => openNovoDocumento(d.tipo)}>{d.label}</Button>)}</div>
        </Card>
      )}
      <DependenteModal open={modal.open} editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} />
    </div>
  )
}
