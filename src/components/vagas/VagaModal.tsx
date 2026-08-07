'use client'

import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { CargoCombobox } from '@/components/ui/cargo-combobox'
import { Search, UserCheck, X, Link2, ChevronDown } from 'lucide-react'
import {
  VagaStatus, VAGA_STATUS_LABELS, TIPO_VAGA_LABELS, PERIODO_LABELS,
  TIPO_REQUISICAO_LABELS, TIPO_CONTRATO_LABELS, TIPO_RECRUTAMENTO_LABELS,
} from '@/types'
import type { VagaData } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  vaga?: VagaData | null
  defaultStatus?: VagaStatus
  units: { id: string; name: string; color: string }[]
  users: { id: string; name: string; unitId?: string | null; managedUnits?: { unitId: string }[] }[]
  isAdmin: boolean
  analystUnitIds?: string[]
}

const tipoOptions          = Object.entries(TIPO_VAGA_LABELS).map(([v, l]) => ({ value: v, label: l }))
const periodoOptions       = Object.entries(PERIODO_LABELS).map(([v, l]) => ({ value: v, label: l }))
const statusOptions        = (['ABERTA', 'ADMISSAO_EM_ANDAMENTO', 'CONTRATADA', 'CANCELADA'] as VagaStatus[]).map(v => ({ value: v, label: VAGA_STATUS_LABELS[v] }))
const tipoRequisicaoOpts   = Object.entries(TIPO_REQUISICAO_LABELS).map(([v, l]) => ({ value: v, label: l }))
const tipoContratoOpts     = Object.entries(TIPO_CONTRATO_LABELS).map(([v, l]) => ({ value: v, label: l }))
const tipoRecrutamentoOpts = Object.entries(TIPO_RECRUTAMENTO_LABELS).map(([v, l]) => ({ value: v, label: l }))

interface CandidatoResult { id: string; nome: string; telefone?: string | null; funcao?: string; status?: string }

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

const EMPTY: any = {
  cargoId: '', controleCandidatoId: '', setor: '', setorRequisitante: '', municipio: '', quantidade: 1,
  tipoVaga: 'EFETIVO', tipoRequisicao: '', tipoContrato: '', tipoRecrutamento: '',
  periodoTrabalho: '', cargaHoraria: '', horarioTrabalho: '', escala: '',
  plantaoColaboradorSaiu: '',
  salario: '',
  requisicaoNextId: '',
  nomeColaboradorSaiu: '',
  nomeColaborador: '', disponibilidadeHorario: '',
  vagaPcd: false,
  gestorRequisitante: '',
  numProcessoAdmissao: '', numProtocoloOnvio: '',
  unidadeId: '', analistaIds: [] as string[],
  dataAbertura: new Date().toISOString().slice(0, 10),
  dataPrevistaFechamento: '', dataFechamento: '', dataInicioIntegracao: '',
  observacoes: '', status: 'ABERTA',
}

export function VagaModal({ open, onClose, onSaved, vaga, defaultStatus, units, users, isAdmin, analystUnitIds = [] }: Props) {
  const isEdit = !!vaga
  const [form, setForm] = useState({ ...EMPTY })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // Busca de candidato do controle
  const [candidatoQuery, setCandidatoQuery] = useState('')
  const [candidatoResults, setCandidatoResults] = useState<CandidatoResult[]>([])
  const [showCandSearch, setShowCandSearch] = useState(false)
  const [linkedCandidato, setLinkedCandidato] = useState<CandidatoResult | null>(null)
  const candSearchRef = useRef<HTMLDivElement>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (candSearchRef.current && !candSearchRef.current.contains(e.target as Node)) {
        setShowCandSearch(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Busca candidatos com debounce
  useEffect(() => {
    if (!candidatoQuery.trim() || candidatoQuery.length < 2) { setCandidatoResults([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/candidatos-controle?search=${encodeURIComponent(candidatoQuery)}`)
      if (res.ok) setCandidatoResults(await res.json())
    }, 300)
    return () => clearTimeout(t)
  }, [candidatoQuery])

  useEffect(() => {
    if (open) {
      setCandidatoQuery('')
      setCandidatoResults([])
      setShowCandSearch(false)
      setLinkedCandidato(vaga?.controleCandidato ?? null)
      if (vaga) {
        setForm({
          cargoId:               vaga.cargoId ?? '',
          controleCandidatoId:   vaga.controleCandidatoId ?? '',
          setor:                 vaga.setor ?? '',
          setorRequisitante:     vaga.setorRequisitante ?? '',
          municipio:             vaga.municipio ?? '',
          quantidade:            vaga.quantidade,
          tipoVaga:              vaga.tipoVaga,
          tipoRequisicao:        vaga.tipoRequisicao ?? '',
          tipoContrato:          vaga.tipoContrato ?? '',
          tipoRecrutamento:      vaga.tipoRecrutamento ?? '',
          periodoTrabalho:       vaga.periodoTrabalho ?? '',
          cargaHoraria:          vaga.cargaHoraria ?? '',
          horarioTrabalho:       vaga.horarioTrabalho ?? '',
          escala:                vaga.escala ?? '',
          plantaoColaboradorSaiu:vaga.plantaoColaboradorSaiu ?? '',
          salario:               vaga.salarioMin != null ? vaga.salarioMin.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
          requisicaoNextId:      vaga.requisicaoNextId ?? '',
          nomeColaboradorSaiu:   vaga.nomeColaboradorSaiu ?? '',
          nomeColaborador:       vaga.nomeColaborador ?? '',
          disponibilidadeHorario:vaga.disponibilidadeHorario ?? '',
          vagaPcd:               vaga.vagaPcd ?? false,
          gestorRequisitante:    vaga.gestorRequisitante ?? '',
          numProcessoAdmissao:   vaga.numProcessoAdmissao ?? '',
          numProtocoloOnvio:     vaga.numProtocoloOnvio ?? '',
          unidadeId:             vaga.unidadeId ?? '',
          analistaIds:           vaga.analistas?.map((a) => a.id) ?? [],
          dataAbertura:          vaga.dataAbertura.slice(0, 10),
          dataPrevistaFechamento:vaga.dataPrevistaFechamento?.slice(0, 10) ?? '',
          dataFechamento:        vaga.dataFechamento?.slice(0, 10) ?? '',
          dataInicioIntegracao:  vaga.dataInicioIntegracao?.slice(0, 10) ?? '',
          observacoes:           vaga.observacoes ?? '',
          status:                vaga.status,
        })
      } else {
        setForm({
          ...EMPTY,
          status:    defaultStatus ?? 'ABERTA',
          unidadeId: !isAdmin && analystUnitIds.length === 1 ? analystUnitIds[0] : '',
        })
      }
      setError('')
    }
  }, [open, vaga, defaultStatus, isAdmin, analystUnitIds.join(',')])

  function f(key: string, value: any) { setForm((p: any) => ({ ...p, [key]: value })) }

  async function handleSave() {
    if (!form.cargoId) { setError('Cargo é obrigatório.'); return }
    setError('')
    setIsSaving(true)

    const url    = isEdit ? `/api/vagas/${vaga!.id}` : '/api/vagas'
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cargoId:               form.cargoId,
        controleCandidatoId:   form.controleCandidatoId || null,
        setor:                 form.setor || null,
        setorRequisitante:     form.setorRequisitante || null,
        municipio:             form.municipio || null,
        quantidade:            Number(form.quantidade),
        tipoVaga:              form.tipoVaga,
        tipoRequisicao:        form.tipoRequisicao || null,
        tipoContrato:          form.tipoContrato || null,
        tipoRecrutamento:      form.tipoRecrutamento || null,
        periodoTrabalho:       form.periodoTrabalho || null,
        cargaHoraria:          form.cargaHoraria || null,
        horarioTrabalho:       form.horarioTrabalho || null,
        escala:                form.escala || null,
        plantaoColaboradorSaiu:form.plantaoColaboradorSaiu || null,
        salarioMin:            form.salario !== '' ? parseFloat(String(form.salario).replace(/\./g, '').replace(',', '.')) || null : null,
        salarioMax:            null,
        requisicaoNextId:      form.requisicaoNextId || null,
        nomeColaboradorSaiu:   form.nomeColaboradorSaiu || null,
        nomeColaborador:       form.nomeColaborador || null,
        disponibilidadeHorario:form.disponibilidadeHorario || null,
        vagaPcd:               form.vagaPcd,
        gestorRequisitante:    form.gestorRequisitante || null,
        numProcessoAdmissao:   form.numProcessoAdmissao || null,
        numProtocoloOnvio:     form.numProtocoloOnvio || null,
        unidadeId:             form.unidadeId || null,
        analistaIds:           form.analistaIds,
        dataAbertura:          form.dataAbertura,
        dataPrevistaFechamento:form.dataPrevistaFechamento || null,
        dataFechamento:        form.dataFechamento || null,
        dataInicioIntegracao:  form.dataInicioIntegracao || null,
        observacoes:           form.observacoes || null,
        status:                form.status,
      }),
    })

    setIsSaving(false)
    if (res.ok) { onClose(); onSaved() }
    else { const d = await res.json(); setError(d.error ?? 'Erro ao salvar.') }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Vaga' : 'Nova Vaga'} size="lg">
      <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">

        {/* Requisição NextERP */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Requisição NextERP</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="ID da Requisição (RP)"
              value={form.requisicaoNextId}
              onChange={(e) => f('requisicaoNextId', e.target.value)}
              placeholder="Ex: RP-2026-00057"
            />
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => f('vagaPcd', !form.vagaPcd)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
                    form.vagaPcd ? 'bg-[#15AFA4] border-[#15AFA4]' : 'border-gray-300 bg-white'
                  }`}
                >
                  {form.vagaPcd && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-sm font-medium text-gray-700">Vaga PCD</span>
              </label>
            </div>
          </div>
        </div>

        {/* Identificação */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identificação da Vaga</p>
          <div className="grid grid-cols-2 gap-3">
            <CargoCombobox
            label="Cargo *"
            required
            value={form.cargoId}
            onChange={(id) => f('cargoId', id)}
            placeholder="Selecionar cargo..."
          />
            <Input label="Setor / Área" value={form.setor} onChange={(e) => f('setor', e.target.value)} placeholder="Ex: Enfermagem" />
            <Input label="Município" value={form.municipio} onChange={(e) => f('municipio', e.target.value)} placeholder="Ex: Guarulhos" />
            <Input label="Quantidade de Vagas" type="number" min={1} value={form.quantidade} onChange={(e) => f('quantidade', e.target.value)} />
          </div>
        </div>

        {/* Requisição */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Detalhes da Requisição</p>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo de Requisição" value={form.tipoRequisicao} onChange={(e) => f('tipoRequisicao', e.target.value)} options={tipoRequisicaoOpts} placeholder="Selecionar" />
            <Select label="Tipo de Contrato" value={form.tipoContrato} onChange={(e) => f('tipoContrato', e.target.value)} options={tipoContratoOpts} placeholder="Selecionar" />
            <Select label="Tipo de Recrutamento" value={form.tipoRecrutamento} onChange={(e) => f('tipoRecrutamento', e.target.value)} options={tipoRecrutamentoOpts} placeholder="Selecionar" />
            <Select label="Tipo de Vaga" value={form.tipoVaga} onChange={(e) => f('tipoVaga', e.target.value)} options={tipoOptions} />
            <Input label="Gestor Requisitante" value={form.gestorRequisitante} onChange={(e) => f('gestorRequisitante', e.target.value)} placeholder="Nome do gestor" />
            <Input label="Setor Requisitante" value={form.setorRequisitante} onChange={(e) => f('setorRequisitante', e.target.value)} placeholder="Setor que abriu a vaga" />
          </div>
        </div>

        {/* Colaborador que Saiu */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Colaborador que Saiu (Substituição)</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nome do Colaborador que Saiu"
              value={form.nomeColaboradorSaiu}
              onChange={(e) => f('nomeColaboradorSaiu', e.target.value)}
              placeholder="Nome de quem está sendo substituído"
            />
            <Input
              label="Plantão (Par ou Ímpar)"
              value={form.plantaoColaboradorSaiu}
              onChange={(e) => f('plantaoColaboradorSaiu', e.target.value)}
              placeholder="Ex: Par, Ímpar"
            />
          </div>
        </div>

        {/* Condições da Vaga */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Condições da Vaga</p>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Select label="Período" value={form.periodoTrabalho} onChange={(e) => f('periodoTrabalho', e.target.value)} options={periodoOptions} placeholder="Selecionar" />
              <Input label="Horário de Trabalho" value={form.horarioTrabalho} onChange={(e) => f('horarioTrabalho', e.target.value)} placeholder="Ex: 07h00 às 19h00" />
              <Input label="Escala" value={form.escala} onChange={(e) => f('escala', e.target.value)} placeholder="Ex: 12x36, 6x1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Carga Horária Mensal" value={form.cargaHoraria} onChange={(e) => f('cargaHoraria', e.target.value)}
                options={[120,150,180,200,220].map((h) => ({ value: `${h}h`, label: `${h}h` }))} placeholder="Selecionar" />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Salário (R$)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium select-none">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.salario}
                    onChange={(e) => f('salario', e.target.value)}
                    placeholder="Ex: 1750 ou 1.750,00"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Novo Colaborador */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Candidato / Novo Colaborador</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">

              {/* Nome do Candidato Aprovado — com opção de vincular do controle */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Nome do Candidato Aprovado</label>

                {/* Candidato vinculado do controle */}
                {linkedCandidato ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#15AFA4] bg-[#15AFA4]/5">
                    <UserCheck className="w-4 h-4 text-[#15AFA4] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{linkedCandidato.nome}</p>
                      <p className="text-xs text-gray-500 truncate">{linkedCandidato.funcao}{linkedCandidato.telefone ? ` · ${linkedCandidato.telefone}` : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkedCandidato(null)
                        f('controleCandidatoId', '')
                      }}
                      className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                      title="Desvincular candidato"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={candSearchRef}>
                    <Input
                      value={form.nomeColaborador}
                      onChange={(e) => f('nomeColaborador', e.target.value)}
                      placeholder="Preencher quando aprovado"
                    />
                    {/* Botão vincular */}
                    <button
                      type="button"
                      onClick={() => setShowCandSearch((v) => !v)}
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-[#15AFA4] font-medium hover:underline"
                    >
                      <Link2 className="w-3 h-3" />
                      {showCandSearch ? 'Fechar busca' : 'Selecionar do Controle de Candidatos'}
                    </button>

                    {/* Painel de busca inline */}
                    {showCandSearch && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              autoFocus
                              value={candidatoQuery}
                              onChange={(e) => setCandidatoQuery(e.target.value)}
                              placeholder="Buscar por nome ou função..."
                              className="w-full pl-8 pr-3 py-1.5 text-sm border-0 outline-none bg-gray-50 rounded-lg"
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {candidatoQuery.length < 2 ? (
                            <p className="px-3 py-4 text-xs text-gray-400 text-center">Digite pelo menos 2 caracteres para buscar</p>
                          ) : candidatoResults.length === 0 ? (
                            <p className="px-3 py-4 text-xs text-gray-400 text-center">Nenhum candidato encontrado</p>
                          ) : (
                            candidatoResults.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setLinkedCandidato(c)
                                  setForm((p: any) => ({
                                    ...p,
                                    controleCandidatoId: c.id,
                                    nomeColaborador: c.nome,
                                    status: ['ABERTA','DIVULGACAO','TRIAGEM','ENTREVISTAS','ENCAMINHADA_GESTOR','APROVADA_CONTRATACAO'].includes(p.status)
                                      ? 'ADMISSAO_EM_ANDAMENTO'
                                      : p.status,
                                  }))
                                  setShowCandSearch(false)
                                  setCandidatoQuery('')
                                  setCandidatoResults([])
                                }}
                                className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-[#15AFA4]/5 text-left transition-colors border-b border-gray-50 last:border-0"
                              >
                                <UserCheck className="w-4 h-4 text-[#15AFA4] flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-gray-800">{c.nome}</p>
                                  <p className="text-xs text-gray-500">{c.funcao}{c.telefone ? ` · ${c.telefone}` : ''}</p>
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

              <Input
                label="Disponibilidade do Novo Colaborador"
                value={form.disponibilidadeHorario}
                onChange={(e) => f('disponibilidadeHorario', e.target.value)}
                placeholder="Ex: Diurno Par, Noturno Ímpar"
              />
            </div>
          </div>
        </div>

        {/* Admissão */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Conclusão do Processo</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="1Doc — Nº do Processo Admissional"
              value={form.numProcessoAdmissao}
              onChange={(e) => f('numProcessoAdmissao', e.target.value)}
              placeholder="Ex: ADM-2026-001"
            />
            <Input
              label="Onvio — Nº do Protocolo"
              value={form.numProtocoloOnvio}
              onChange={(e) => f('numProtocoloOnvio', e.target.value)}
              placeholder="Nº do protocolo"
            />
            <Input
              label="Data de Fechamento"
              type="date"
              value={form.dataFechamento}
              onChange={(e) => f('dataFechamento', e.target.value)}
            />
            <Input
              label="Data de Início / Integração"
              type="date"
              value={form.dataInicioIntegracao}
              onChange={(e) => f('dataInicioIntegracao', e.target.value)}
            />
          </div>
        </div>

        {/* Unidade e Responsável */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Unidade e Responsável</p>
          <div className="grid grid-cols-2 gap-3">
            {isAdmin ? (
              <>
                <Select label="Unidade" value={form.unidadeId} onChange={(e) => f('unidadeId', e.target.value)} options={units.map((u) => ({ value: u.id, label: u.name }))} placeholder="Selecionar" />
                <AnalistasMultiSelect
                  users={users}
                  value={form.analistaIds}
                  onChange={(ids) => f('analistaIds', ids)}
                />
              </>
            ) : (
              <>
                {analystUnitIds.length > 1 ? (
                  <Select
                    label="Unidade"
                    value={form.unidadeId}
                    onChange={(e) => f('unidadeId', e.target.value)}
                    options={units.filter((u) => analystUnitIds.includes(u.id)).map((u) => ({ value: u.id, label: u.name }))}
                    placeholder="Selecionar"
                  />
                ) : (
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-600 flex items-center gap-2">
                    {(() => { const u = units.find((u) => u.id === analystUnitIds[0]); return u ? (<><div className="w-3 h-3 rounded-full" style={{ background: u.color }} /><span>{u.name}</span></>) : null })()}
                  </div>
                )}
                <AnalistasMultiSelect
                  users={users.filter((u) =>
                    u.managedUnits?.some((mu) => analystUnitIds.includes(mu.unitId)) ||
                    (u.unitId && analystUnitIds.includes(u.unitId))
                  )}
                  value={form.analistaIds}
                  onChange={(ids) => f('analistaIds', ids)}
                />
              </>
            )}
            <Select label="Status" value={form.status} onChange={(e) => f('status', e.target.value)} options={statusOptions} />
            <Input label="Data de Abertura" type="date" value={form.dataAbertura} onChange={(e) => f('dataAbertura', e.target.value)} />
            <div className="col-span-2">
              <Input label="Prazo Previsto de Fechamento" type="date" value={form.dataPrevistaFechamento} onChange={(e) => f('dataPrevistaFechamento', e.target.value)} />
            </div>
          </div>
        </div>

        <Textarea label="Observações" value={form.observacoes} onChange={(e) => f('observacoes', e.target.value)} rows={2} placeholder="Informações adicionais..." />

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" isLoading={isSaving} onClick={handleSave}>
            {isEdit ? 'Salvar Alterações' : 'Criar Vaga'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
