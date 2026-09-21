'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { api, errorMessage } from '../api'
import { useDossie } from '../context'
import { inputCls, Notice, toInput } from '../parts'
import type { DependenteRow } from '../types'

const empty = { nome: '', cpf: '', nascimento: '', parentesco: '', sexo: '', dependenteIr: false, salarioFamilia: false, planoSaude: false, inclusaoEm: '', exclusaoEm: '' }

function maskCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function DependenteModal({ open, editing, onClose }: { open: boolean; editing: DependenteRow | null; onClose: () => void }) {
  const { id, catalog, reload, toast } = useDossie()
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(editing ? {
      nome: editing.nome, cpf: '', nascimento: toInput(editing.nascimento), parentesco: editing.parentesco, sexo: editing.sexo,
      dependenteIr: editing.dependenteIr, salarioFamilia: editing.salarioFamilia, planoSaude: editing.planoSaude,
      inclusaoEm: toInput(editing.inclusaoEm), exclusaoEm: toInput(editing.exclusaoEm),
    } : { ...empty, inclusaoEm: new Date().toISOString().slice(0, 10) })
  }, [open, editing])

  const set = <K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    setBusy(true); setError('')
    try {
      const payload = { ...form, cpf: form.cpf || null, sexo: form.sexo || null, inclusaoEm: form.inclusaoEm || null, exclusaoEm: form.exclusaoEm || null }
      const url = `/api/colaboradores/${id}/dossie/dependentes`
      if (editing) await api(`${url}/${editing.id}`, { method: 'PUT', body: payload })
      else await api(url, { body: payload })
      toast('success', editing ? 'Dependente atualizado.' : 'Dependente adicionado.')
      onClose(); await reload()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }

  const check = (key: 'dependenteIr' | 'salarioFamilia' | 'planoSaude', label: string) => (
    <label className="flex items-center gap-2 text-sm text-gray-700 rounded-xl border border-gray-200 px-3.5 py-2.5">
      <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} className="accent-[#15AFA4] w-4 h-4" />{label}
    </label>
  )

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar dependente' : 'Adicionar dependente'} size="lg">
      <div className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block space-y-1.5 sm:col-span-2"><span className="text-sm font-medium text-gray-700">Nome completo <span className="text-red-500">*</span></span>
            <input value={form.nome} onChange={(e) => set('nome', e.target.value)} className={inputCls} /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">CPF{editing && ' (deixe em branco para manter)'}</span>
            <input value={form.cpf} inputMode="numeric" onChange={(e) => set('cpf', maskCpf(e.target.value))} placeholder={editing ? '•••.•••.•••-••' : '000.000.000-00'} className={inputCls} /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Data de nascimento <span className="text-red-500">*</span></span>
            <input type="date" value={form.nascimento} onChange={(e) => set('nascimento', e.target.value)} className={inputCls} /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Parentesco <span className="text-red-500">*</span></span>
            <select value={form.parentesco} onChange={(e) => set('parentesco', e.target.value)} className={inputCls}>
              <option value="">Selecione…</option>{catalog.parentescos.map((p) => <option key={p}>{p}</option>)}
            </select></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Sexo</span>
            <select value={form.sexo} onChange={(e) => set('sexo', e.target.value)} className={inputCls}>
              <option value="">Não informado</option><option>Feminino</option><option>Masculino</option>
            </select></label>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {check('dependenteIr', 'Dependente para IR')}{check('salarioFamilia', 'Salário-família')}{check('planoSaude', 'Plano de saúde')}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Data de inclusão</span>
            <input type="date" value={form.inclusaoEm} onChange={(e) => set('inclusaoEm', e.target.value)} className={inputCls} /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium text-gray-700">Data de exclusão</span>
            <input type="date" value={form.exclusaoEm} onChange={(e) => set('exclusaoEm', e.target.value)} className={inputCls} /></label>
        </div>
        <p className="text-xs text-gray-400">Dependentes nunca são apagados: ao informar a data de exclusão, o registro fica no histórico como inativo.</p>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" isLoading={busy} onClick={save}>{editing ? 'Salvar' : 'Adicionar dependente'}</Button>
        </div>
      </div>
    </Modal>
  )
}
