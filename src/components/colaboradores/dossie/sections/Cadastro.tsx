'use client'

import { useEffect, useState } from 'react'
import { DownloadCloud, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api, errorMessage } from '../api'
import { useDossie } from '../context'
import { summarizeImport, type ImportResult } from '../AdmissaoImportBanner'
import { Field, fmtDate, inputCls, Notice, SectionTitle } from '../parts'
import type { Perfil } from '../types'

function Text({ label, value, onChange, placeholder, type = 'text', className }: { label: string; value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string }) {
  return (
    <label className={`block space-y-1.5 ${className ?? ''}`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input type={type} step={type === 'number' ? '0.01' : undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4"><p className="text-sm font-semibold text-gray-800">{title}</p>{hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </Card>
  )
}

/** Cadastro complementar: só os campos que o ERPNext não fornece. Os já existentes aparecem em modo leitura. */
export function Cadastro() {
  const { id, overview, can, reload, toast } = useDossie()
  const [form, setForm] = useState<Perfil>(overview.perfil)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canEdit = can('employee.documents.edit')
  useEffect(() => setForm(overview.perfil), [overview.perfil])
  const c = overview.colaborador

  const set = <K extends keyof Perfil>(key: K, value: Perfil[K]) => setForm((f) => ({ ...f, [key]: value }))
  const nested = <K extends 'ctps' | 'banco' | 'endereco'>(group: K, key: keyof Perfil[K], value: string) => setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }))

  async function save() {
    setBusy(true); setError('')
    try {
      const { admissionId: _admissionId, salario, ...rest } = form
      void _admissionId
      await api(`/api/colaboradores/${id}/dossie/perfil`, { method: 'PUT', body: { ...rest, salario: salario === null || Number.isNaN(Number(salario)) || Number(salario) <= 0 ? null : Number(salario) } })
      toast('success', 'Dados cadastrais salvos.'); await reload()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }

  async function importar() {
    setBusy(true); setError('')
    try {
      const result = await api<ImportResult>(`/api/colaboradores/${id}/dossie/admissao`, { method: 'POST', body: {} })
      toast('success', summarizeImport(result))
      await reload()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Dados cadastrais" description="Preencha uma única vez: os documentos usam estes dados automaticamente."
        action={<>
          {overview.admissaoVinculada && canEdit && <Button variant="outline" size="sm" icon={<DownloadCloud className="w-4 h-4" />} disabled={busy} onClick={importar}>Importar da admissão</Button>}
          {canEdit && <Button size="sm" icon={<Save className="w-4 h-4" />} isLoading={busy} onClick={save}>Salvar</Button>}
        </>} />
      {error && <Notice tone="danger">{error}</Notice>}
      {!canEdit && <Notice>Você tem acesso somente leitura a este cadastro.</Notice>}

      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Já cadastrado no ERPNext</p>
        <p className="text-xs text-gray-400 mb-4">Estes dados são sincronizados e não precisam ser digitados novamente. Para corrigi-los, altere no ERPNext e use “Atualizar do ERPNext”.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Nome" value={c.nome} /><Field label="CPF" value={c.cpf} mono /><Field label="Matrícula" value={c.matricula} mono /><Field label="Admissão" value={fmtDate(c.admissao)} />
          <Field label="Cargo" value={c.cargo} /><Field label="Setor" value={c.setor} /><Field label="Unidade" value={c.unidade} /><Field label="Gestor" value={c.gestor} />
        </div>
      </Card>

      <Group title="Dados pessoais">
        <Text label="Nome social" value={form.nomeSocial} onChange={(v) => set('nomeSocial', v)} />
        <Text label="Estado civil" value={form.estadoCivil} onChange={(v) => set('estadoCivil', v)} />
        <Text label="Nacionalidade" value={form.nacionalidade} onChange={(v) => set('nacionalidade', v)} />
        <Text label="Escolaridade" value={form.escolaridade} onChange={(v) => set('escolaridade', v)} />
        <Text label="Nome da mãe" value={form.nomeMae} onChange={(v) => set('nomeMae', v)} />
        <Text label="Nome do pai" value={form.nomePai} onChange={(v) => set('nomePai', v)} />
        <Text label="RG — órgão emissor" value={form.rgOrgao} onChange={(v) => set('rgOrgao', v)} />
        <Text label="RG — UF" value={form.rgUf} onChange={(v) => set('rgUf', v.toUpperCase().slice(0, 2))} />
        <Text label="RG — data de emissão" type="date" value={form.rgEmissao} onChange={(v) => set('rgEmissao', v)} />
        <Text label="PIS/PASEP" value={form.pis} onChange={(v) => set('pis', v)} />
        <Text label="CTPS — número" value={form.ctps.numero} onChange={(v) => nested('ctps', 'numero', v)} />
        <Text label="CTPS — série" value={form.ctps.serie} onChange={(v) => nested('ctps', 'serie', v)} />
        <Text label="CTPS — UF" value={form.ctps.uf} onChange={(v) => nested('ctps', 'uf', v.toUpperCase().slice(0, 2))} />
      </Group>

      <Group title="Endereço">
        <Text label="CEP" value={form.endereco.cep} onChange={(v) => nested('endereco', 'cep', v)} />
        <Text label="Logradouro" value={form.endereco.logradouro} onChange={(v) => nested('endereco', 'logradouro', v)} className="lg:col-span-2" />
        <Text label="Número" value={form.endereco.numero} onChange={(v) => nested('endereco', 'numero', v)} />
        <Text label="Complemento" value={form.endereco.complemento} onChange={(v) => nested('endereco', 'complemento', v)} />
        <Text label="Bairro" value={form.endereco.bairro} onChange={(v) => nested('endereco', 'bairro', v)} />
        <Text label="Cidade" value={form.endereco.cidade} onChange={(v) => nested('endereco', 'cidade', v)} />
        <Text label="UF" value={form.endereco.uf} onChange={(v) => nested('endereco', 'uf', v.toUpperCase().slice(0, 2))} />
      </Group>

      <Group title="Dados funcionais" hint="Alterações posteriores de salário, cargo, jornada, unidade etc. devem ser feitas por aditivo contratual, para manter o histórico.">
        <Text label="Salário (R$)" type="number" value={form.salario ?? ''} onChange={(v) => set('salario', v === '' ? null : Number(v))} />
        <Text label="Função" value={form.funcao} onChange={(v) => set('funcao', v)} />
        <Text label="CBO" value={form.cbo} onChange={(v) => set('cbo', v)} />
        <Text label="Centro de custo" value={form.centroCusto} onChange={(v) => set('centroCusto', v)} />
        <Text label="Sindicato" value={form.sindicato} onChange={(v) => set('sindicato', v)} />
        <Text label="Local de trabalho" value={form.localTrabalho} onChange={(v) => set('localTrabalho', v)} />
        <Text label="Jornada" value={form.jornada} onChange={(v) => set('jornada', v)} placeholder="Ex.: 180 horas mensais" />
        <Text label="Escala" value={form.escala} onChange={(v) => set('escala', v)} placeholder="Ex.: 12x36" />
        <Text label="Horário" value={form.horario} onChange={(v) => set('horario', v)} placeholder="Ex.: 18:00 às 06:00" />
      </Group>

      <Group title="Dados bancários">
        <Text label="Banco" value={form.banco.banco} onChange={(v) => nested('banco', 'banco', v)} />
        <Text label="Agência" value={form.banco.agencia} onChange={(v) => nested('banco', 'agencia', v)} />
        <Text label="Conta" value={form.banco.conta} onChange={(v) => nested('banco', 'conta', v)} />
        <Text label="Dígito" value={form.banco.digito} onChange={(v) => nested('banco', 'digito', v)} />
        <Text label="Tipo de conta" value={form.banco.tipo} onChange={(v) => nested('banco', 'tipo', v)} />
      </Group>
    </div>
  )
}
