'use client'

import { AlertTriangle, ArrowRight, FileSignature, FileText, GraduationCap, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AdmissaoImportBanner } from '../AdmissaoImportBanner'
import { useDossie } from '../context'
import { useResource } from '../hooks'
import { fmtDate, SectionTitle } from '../parts'
import type { TimelineItem } from '../types'

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

export function Visao() {
  const { id, overview, catalog, version, goTo, openNovoDocumento, openAditivo, can } = useDossie()
  const { data: timeline } = useResource<{ items: TimelineItem[] }>(`/api/colaboradores/${id}/dossie/historico?take=5`, version)
  const c = overview.colaborador
  const k = overview.contadores

  const missing = Array.from(new Set(catalog.types.flatMap((t) => t.missing)))
  const admissao = c.admissao ? new Date(c.admissao) : null
  const today = new Date()
  const milestones = admissao ? [45, 90].map((d) => {
    const end = new Date(admissao.getTime() + (d - 1) * 86_400_000)
    return { d, end, left: daysBetween(today, end) }
  }) : []

  const stats = [
    { label: 'Documentos', value: k.documentos, icon: FileText, go: 'documentos' as const },
    { label: 'Aditivos', value: k.aditivos, icon: FileSignature, go: 'aditivos' as const },
    { label: 'Dependentes ativos', value: k.dependentes, icon: Users, go: 'dependentes' as const },
    { label: 'Avaliações', value: k.avaliacoes, icon: GraduationCap, go: 'avaliacoes' as const },
  ]

  return (
    <div className="space-y-5">
      <SectionTitle title="Visão geral" description="Situação documental do colaborador em um só lugar." />
      <AdmissaoImportBanner />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <button key={s.label} onClick={() => goTo(s.go)} className="text-left">
            <Card className="p-4 hover:border-[#15AFA4]/40 transition-all">
              <s.icon className="w-4 h-4 text-[#15AFA4] mb-2" />
              <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </Card>
          </button>
        ))}
      </div>

      {missing.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/50">
          <div className="flex gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-800">Cadastro incompleto para gerar alguns documentos</p>
              <p className="text-sm text-amber-700 mt-0.5">Falta informar: {missing.join(', ')}.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => goTo('cadastro')}>Completar dados cadastrais</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Período de experiência</p>
          {admissao ? (
            <div className="space-y-3">
              {milestones.map((m) => (
                <div key={m.d} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{m.d} dias — {fmtDate(m.end.toISOString())}</span>
                  <span className={m.left < 0 ? 'text-gray-400' : m.left <= 10 ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                    {m.left < 0 ? 'concluído' : m.left === 0 ? 'vence hoje' : `em ${m.left} dia${m.left === 1 ? '' : 's'}`}
                  </span>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => goTo('experiencia')}>Ver período de experiência <ArrowRight className="w-3.5 h-3.5" /></Button>
            </div>
          ) : <p className="text-sm text-gray-400">Sem data de admissão cadastrada.</p>}
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Ações rápidas</p>
          <div className="flex flex-wrap gap-2">
            {can('employee.documents.create') && <Button variant="outline" size="sm" onClick={() => openNovoDocumento('CONTRATO_EXPERIENCIA')}>Contrato de experiência</Button>}
            {can('employee.documents.create') && <Button variant="outline" size="sm" onClick={() => openNovoDocumento()}>Novo documento</Button>}
            {can('employee.amendments.create') && <Button variant="outline" size="sm" onClick={openAditivo}>Novo aditivo</Button>}
            <Button variant="outline" size="sm" onClick={() => goTo('dependentes')}>Dependentes</Button>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-800">Últimos eventos</p>
          <button onClick={() => goTo('historico')} className="text-xs text-[#0d8c83] hover:underline">Ver histórico completo</button>
        </div>
        {timeline?.items.length ? (
          <ul className="space-y-2.5">
            {timeline.items.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm"><span className="text-xs text-gray-400 w-20 flex-shrink-0 pt-0.5">{fmtDate(e.dataEvento)}</span><span className="text-gray-800 min-w-0 break-words">{e.titulo}</span></li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-400">Nenhum evento registrado ainda.</p>}
      </Card>
    </div>
  )
}
