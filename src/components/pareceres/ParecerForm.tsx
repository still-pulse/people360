'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TraitBars, buildTypeCode } from '@/components/pareceres/TraitBars'
import { CompetenciasRadar } from '@/components/pareceres/CompetenciasRadar'
import { CandidatoCombobox } from '@/components/pareceres/CandidatoCombobox'
import {
  EMPTY_COMPETENCIAS,
  PARECER_APRESENTACAO_PARES,
  PARECER_VERBALIZACAO_PARES,
  PARECER_VERBALIZACAO_EXTRA,
  PARECER_TECNICAS,
  PARECER_RESULTADO_LABELS,
  TIPO_VINCULO_PARECER_LABELS,
  type ControleCandidatoData,
  type ParecerCompetencias,
  type ParecerData,
  type ParecerResultado,
  type TipoVinculoParecer,
} from '@/types'
import { cn } from '@/lib/utils'
import { calcularTraços, toggleExclusivePair } from '@/lib/parecerTraits'
import { Save, ArrowLeft, FileText, Lock, Sparkles } from 'lucide-react'

interface UnitOpt {
  id: string
  name: string
  color: string
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toggleInList(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

function toggleOptionalFlag(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

interface ParecerFormProps {
  initial?: ParecerData | null
  mode: 'create' | 'edit'
}

export function ParecerForm({ initial, mode }: ParecerFormProps) {
  const router = useRouter()
  const [units, setUnits] = useState<UnitOpt[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [razaoSocial, setRazaoSocial] = useState(
    initial?.razaoSocial || 'Beneficência Hospitalar de Cesário Lange - BHCL'
  )
  const [cnpj, setCnpj] = useState(initial?.cnpj || '50.351.626/0001-10')
  const [unitId, setUnitId] = useState(initial?.unitId || '')
  const [controleCandidatoId, setControleCandidatoId] = useState(initial?.controleCandidatoId || '')
  const [candidatoNome, setCandidatoNome] = useState(initial?.candidatoNome || '')
  const [cargo, setCargo] = useState(initial?.cargo || '')
  const [dataAvaliacao, setDataAvaliacao] = useState(
    toDateInput(initial?.dataAvaliacao) || toDateInput(new Date().toISOString())
  )
  const [idade, setIdade] = useState(initial?.idade != null ? String(initial.idade) : '')
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculoParecer>(initial?.tipoVinculo || 'CLT')
  const [apresentacao, setApresentacao] = useState<string[]>(initial?.apresentacao || [])
  const [verbalizacao, setVerbalizacao] = useState<string[]>(initial?.verbalizacao || [])
  const [tecnicas, setTecnicas] = useState<string[]>(initial?.tecnicas || [])
  const [tecnicasOutros, setTecnicasOutros] = useState(initial?.tecnicasOutros || '')
  const traits = useMemo(
    () => calcularTraços(apresentacao, verbalizacao),
    [apresentacao, verbalizacao]
  )
  const [competencias, setCompetencias] = useState<ParecerCompetencias>({
    ...EMPTY_COMPETENCIAS,
    ...(initial?.competencias as Partial<ParecerCompetencias>),
  })
  const [analiseTexto, setAnaliseTexto] = useState(initial?.analiseTexto || '')
  const [resultado, setResultado] = useState<ParecerResultado | ''>(initial?.resultado || '')
  const [dataAssinatura, setDataAssinatura] = useState(
    toDateInput(initial?.dataAssinatura) || toDateInput(new Date().toISOString())
  )

  useEffect(() => {
    fetch('/api/units')
      .then((r) => r.json())
      .then((d) => setUnits(Array.isArray(d) ? d.filter((u: UnitOpt & { active?: boolean }) => u.active !== false) : []))
      .catch(() => {})
  }, [])

  function handleCandidatoChange(c: ControleCandidatoData | null) {
    if (!c) {
      setControleCandidatoId('')
      setCandidatoNome('')
      setCargo('')
      return
    }
    setControleCandidatoId(c.id)
    setCandidatoNome(c.nome)
    setCargo(c.funcao)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!controleCandidatoId || !candidatoNome.trim()) {
      setError('Selecione um candidato do Controle de Candidatos')
      return
    }

    setSaving(true)

    const payload = {
      razaoSocial,
      cnpj,
      unitId: unitId || null,
      controleCandidatoId,
      candidatoNome,
      cargo,
      dataAvaliacao,
      idade: idade ? parseInt(idade, 10) : null,
      tipoVinculo,
      apresentacao,
      verbalizacao,
      tecnicas,
      tecnicasOutros,
      ...traits,
      competencias,
      analiseTexto,
      resultado: resultado || null,
      dataAssinatura: dataAssinatura || null,
    }

    try {
      const url = mode === 'edit' && initial ? `/api/pareceres/${initial.id}` : '/api/pareceres'
      const method = mode === 'edit' ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar parecer')
        setSaving(false)
        return
      }
      router.push(`/pareceres/${data.id}`)
      router.refresh()
    } catch {
      setError('Falha de rede ao salvar')
      setSaving(false)
    }
  }

  const typeCode = buildTypeCode(traits)

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-5xl">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button type="button" variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => router.push('/pareceres')}>
          Voltar
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-mono">FP.RH.09.001-00</span>
          <Button type="submit" isLoading={saving} icon={<Save className="w-4 h-4" />}>
            {mode === 'edit' ? 'Salvar alterações' : 'Salvar parecer'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* 1. Dados da Contratante */}
      <Card>
        <CardHeader>
          <CardTitle>1. Dados da Contratante</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Razão Social" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} required />
          <Input label="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          <Select
            label="Unidade"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            placeholder="Selecione a unidade"
            options={units.map((u) => ({ value: u.id, label: u.name }))}
          />
        </CardContent>
      </Card>

      {/* 2. Dados do Candidato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            2. Dados do Candidato
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3" />
              Controle de Candidatos
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CandidatoCombobox
            value={controleCandidatoId}
            onChange={handleCandidatoChange}
            required
            label="Candidato"
            error={!controleCandidatoId && error.includes('candidato') ? error : undefined}
            initialCandidato={
              initial?.controleCandidato
                ? initial.controleCandidato
                : initial?.controleCandidatoId
                  ? {
                      id: initial.controleCandidatoId,
                      nome: initial.candidatoNome,
                      funcao: initial.cargo,
                    }
                  : null
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                Nome
                <Lock className="w-3 h-3 text-gray-400" />
              </label>
              <input
                value={candidatoNome}
                readOnly
                tabIndex={-1}
                placeholder="Preenchido ao selecionar o candidato"
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                Cargo / Função
                <Lock className="w-3 h-3 text-gray-400" />
              </label>
              <input
                value={cargo}
                readOnly
                tabIndex={-1}
                placeholder="Preenchido ao selecionar o candidato"
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Data da Avaliação"
              type="date"
              value={dataAvaliacao}
              onChange={(e) => setDataAvaliacao(e.target.value)}
              required
            />
            <Input
              label="Idade"
              type="number"
              min={14}
              max={100}
              value={idade}
              onChange={(e) => setIdade(e.target.value)}
              placeholder="anos"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Tipo de vínculo</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TIPO_VINCULO_PARECER_LABELS) as TipoVinculoParecer[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTipoVinculo(k)}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-sm font-medium border transition-all',
                    tipoVinculo === k
                      ? 'bg-[#15AFA4] text-white border-[#15AFA4] shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#15AFA4]/40'
                  )}
                >
                  {TIPO_VINCULO_PARECER_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Apresentação — pares exclusivos */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Apresentou-se de Forma</CardTitle>
            <p className="text-xs text-gray-400 mt-1 font-normal">
              Em cada linha, escolha um lado ou nenhum — não dá para marcar os dois opostos.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {PARECER_APRESENTACAO_PARES.map((pair) => {
            const leftOn = apresentacao.includes(pair.left)
            const rightOn = apresentacao.includes(pair.right)
            return (
              <div
                key={pair.id}
                className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center rounded-xl border border-gray-100 bg-gray-50/50 p-2"
              >
                <button
                  type="button"
                  onClick={() =>
                    setApresentacao(toggleExclusivePair(apresentacao, pair.left, pair.right, pair.left))
                  }
                  className={cn(
                    'px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium border text-center transition-all',
                    leftOn
                      ? 'bg-[#15AFA4] text-white border-[#15AFA4] shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#15AFA4]/40'
                  )}
                >
                  {pair.left}
                </button>
                <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold px-1">
                  ou
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setApresentacao(toggleExclusivePair(apresentacao, pair.left, pair.right, pair.right))
                  }
                  className={cn(
                    'px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium border text-center transition-all',
                    rightOn
                      ? 'bg-[#15AFA4] text-white border-[#15AFA4] shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#15AFA4]/40'
                  )}
                >
                  {pair.right}
                </button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Verbalização — pares exclusivos */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Verbalização</CardTitle>
            <p className="text-xs text-gray-400 mt-1 font-normal">
              Em cada par, escolha um lado ou nenhum. “Tranquila/segura” é opcional.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {PARECER_VERBALIZACAO_PARES.map((pair) => {
            const leftOn = verbalizacao.includes(pair.left)
            const rightOn = verbalizacao.includes(pair.right)
            return (
              <div
                key={pair.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-stretch sm:items-center rounded-xl border border-gray-100 bg-gray-50/50 p-2"
              >
                <button
                  type="button"
                  onClick={() =>
                    setVerbalizacao(toggleExclusivePair(verbalizacao, pair.left, pair.right, pair.left))
                  }
                  className={cn(
                    'px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium border text-left transition-all',
                    leftOn
                      ? 'bg-[#15AFA4] text-white border-[#15AFA4] shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#15AFA4]/40'
                  )}
                >
                  {pair.leftShort}
                </button>
                <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold text-center hidden sm:block">
                  ou
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setVerbalizacao(toggleExclusivePair(verbalizacao, pair.left, pair.right, pair.right))
                  }
                  className={cn(
                    'px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium border text-left transition-all',
                    rightOn
                      ? 'bg-[#15AFA4] text-white border-[#15AFA4] shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#15AFA4]/40'
                  )}
                >
                  {pair.rightShort}
                </button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => setVerbalizacao(toggleOptionalFlag(verbalizacao, PARECER_VERBALIZACAO_EXTRA))}
            className={cn(
              'w-full px-3 py-2.5 rounded-xl text-sm font-medium border text-left transition-all',
              verbalizacao.includes(PARECER_VERBALIZACAO_EXTRA)
                ? 'bg-violet-50 text-violet-700 border-violet-300'
                : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
            )}
          >
            {PARECER_VERBALIZACAO_EXTRA}
            <span className="text-xs text-gray-400 font-normal ml-2">(opcional)</span>
          </button>
        </CardContent>
      </Card>

      {/* Perfil comportamental — calculado automaticamente */}
      <Card>
        <CardHeader className="flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#15AFA4]" />
            Avaliação — Perfil Comportamental
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0d8c83] bg-[#15AFA4]/10 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" />
              Automático
            </span>
          </CardTitle>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-gray-900 text-white">
            {typeCode}
          </span>
        </CardHeader>
        <CardContent>
          <TraitBars
            values={traits}
            readOnly
            hint="Calculado a partir da apresentação e da verbalização"
          />
        </CardContent>
      </Card>

      {/* Competências — Radar */}
      <Card>
        <CardContent className="pt-5">
          <CompetenciasRadar
            values={competencias}
            onChange={(key, value) => setCompetencias((prev) => ({ ...prev, [key]: value }))}
          />
        </CardContent>
      </Card>

      {/* Técnicas */}
      <Card>
        <CardHeader>
          <CardTitle>Técnicas Utilizadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PARECER_TECNICAS.map((item) => {
              const active = tecnicas.includes(item)
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTecnicas(toggleInList(tecnicas, item))}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    active
                      ? 'bg-violet-50 text-violet-700 border-violet-300'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  )}
                >
                  {item}
                </button>
              )
            })}
          </div>
          <Input
            label="Outros"
            value={tecnicasOutros}
            onChange={(e) => setTecnicasOutros(e.target.value)}
            placeholder="Descreva outras técnicas, se houver"
          />
        </CardContent>
      </Card>

      {/* Análise / Parecer */}
      <Card>
        <CardHeader>
          <CardTitle>Análise Seleção — Parecer do Candidato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            label="Parecer descritivo"
            value={analiseTexto}
            onChange={(e) => setAnaliseTexto(e.target.value)}
            rows={10}
            placeholder="Descreva a análise do candidato, pontos fortes, desenvolvimento, conclusão..."
          />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Parecer Seleção</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(PARECER_RESULTADO_LABELS) as ParecerResultado[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setResultado(k)}
                  className={cn(
                    'px-4 py-3 rounded-xl text-sm font-medium border text-left transition-all',
                    resultado === k
                      ? 'border-[#15AFA4] bg-[#15AFA4]/10 text-[#0d8c83] ring-2 ring-[#15AFA4]/20'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {PARECER_RESULTADO_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Data da assinatura"
            type="date"
            value={dataAssinatura}
            onChange={(e) => setDataAssinatura(e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-8">
        <Button type="button" variant="outline" onClick={() => router.push('/pareceres')}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={saving} icon={<Save className="w-4 h-4" />}>
          {mode === 'edit' ? 'Salvar alterações' : 'Salvar parecer'}
        </Button>
      </div>
    </form>
  )
}
