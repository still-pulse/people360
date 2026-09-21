import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { decryptAdmissionValue, hashSensitive } from '@/lib/admission/security'
import { fmtMoney } from './format'
import { addHistorico } from './history'
import { packSensivel, readSensivel } from './snapshot'
import type { Actor, Endereco, Sensivel } from './types'

const text = (max = 200) => z.string().trim().max(max).optional().nullable()

export const perfilSchema = z.object({
  nomeSocial: text(), funcao: text(), cbo: text(20), centroCusto: text(), sindicato: text(),
  jornada: text(), escala: text(), horario: text(), localTrabalho: text(),
  estadoCivil: text(60), nacionalidade: text(60), escolaridade: text(80),
  nomeMae: text(), nomePai: text(), rgOrgao: text(40), rgUf: text(2), rgEmissao: text(10),
  salario: z.number().positive('Informe um salário maior que zero.').max(9_999_999).optional().nullable(),
  pis: text(20),
  ctps: z.object({ numero: text(20), serie: text(10), uf: text(2), emissao: text(10) }).optional().nullable(),
  banco: z.object({ banco: text(80), agencia: text(20), conta: text(30), digito: text(5), tipo: text(40) }).optional().nullable(),
  endereco: z.object({ cep: text(9), logradouro: text(), numero: text(20), complemento: text(), bairro: text(), cidade: text(), uf: text(2) }).optional().nullable(),
})

export type PerfilInput = z.infer<typeof perfilSchema>

const PLAIN_KEYS = [
  'nomeSocial', 'funcao', 'cbo', 'centroCusto', 'sindicato', 'jornada', 'escala', 'horario', 'localTrabalho',
  'estadoCivil', 'nacionalidade', 'escolaridade', 'nomeMae', 'nomePai', 'rgOrgao', 'rgUf', 'rgEmissao',
] as const

/** Campos cuja alteração posterior ao cadastro inicial vira evento no histórico funcional. */
const TRACKED: Record<string, { tipo: string; label: string }> = {
  funcao: { tipo: 'FUNCAO', label: 'Função' },
  jornada: { tipo: 'JORNADA', label: 'Jornada' },
  escala: { tipo: 'ESCALA', label: 'Escala' },
  horario: { tipo: 'HORARIO', label: 'Horário' },
  centroCusto: { tipo: 'CENTRO_CUSTO', label: 'Centro de custo' },
  localTrabalho: { tipo: 'LOCAL_TRABALHO', label: 'Local de trabalho' },
}

const clean = (value: string | null | undefined) => (value == null ? null : value.trim() || null)

/** Remove chaves nulas (zod `.nullable()`) para mesclar objetos sem apagar dados existentes. */
function defined<T extends Record<string, unknown>>(value: T): { [K in keyof T]?: Exclude<T[K], null> } {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v != null)) as { [K in keyof T]?: Exclude<T[K], null> }
}

export async function getPerfilView(colaboradorId: string) {
  const perfil = await prisma.colaboradorPerfil.findUnique({ where: { colaboradorId } })
  const sensivel = readSensivel(perfil?.sensivel)
  return {
    ...Object.fromEntries(PLAIN_KEYS.map((key) => [key, perfil?.[key] ?? ''])),
    salario: sensivel.salario ?? null,
    pis: sensivel.pis ?? '',
    ctps: { numero: '', serie: '', uf: '', emissao: '', ...(sensivel.ctps ?? {}) },
    banco: { banco: '', agencia: '', conta: '', digito: '', tipo: '', ...(sensivel.banco ?? {}) },
    endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', ...(sensivel.endereco ?? {}) },
    admissionId: perfil?.admissionId ?? null,
    atualizadoEm: perfil?.updatedAt ?? null,
  }
}

export async function savePerfil(colaboradorId: string, input: PerfilInput, actor: Actor) {
  const current = await prisma.colaboradorPerfil.findUnique({ where: { colaboradorId } })
  const sensivel: Sensivel = readSensivel(current?.sensivel)
  const data: Record<string, unknown> = {}
  for (const key of PLAIN_KEYS) if (key in input) data[key] = clean(input[key] as string | null | undefined)

  const nextSensivel: Sensivel = { ...sensivel }
  if ('salario' in input) nextSensivel.salario = input.salario ?? null
  if ('pis' in input) nextSensivel.pis = clean(input.pis) ?? undefined
  if (input.ctps) nextSensivel.ctps = { ...sensivel.ctps, ...defined(input.ctps) }
  if (input.banco) nextSensivel.banco = { ...sensivel.banco, ...defined(input.banco) }
  if (input.endereco) nextSensivel.endereco = { ...sensivel.endereco, ...defined(input.endereco) } as Endereco

  const saved = await prisma.colaboradorPerfil.upsert({
    where: { colaboradorId },
    create: { colaboradorId, ...data, sensivel: packSensivel(nextSensivel), atualizadoPor: actor.name },
    update: { ...data, sensivel: packSensivel(nextSensivel), atualizadoPor: actor.name },
  })

  // Histórico: só registra mudança sobre valor já existente (o preenchimento inicial não é "alteração").
  const today = new Date()
  const changes: { tipo: string; titulo: string; anterior: string; novo: string }[] = []
  for (const [key, meta] of Object.entries(TRACKED)) {
    const before = (current?.[key as keyof typeof current] as string | null | undefined) ?? ''
    const after = (saved[key as keyof typeof saved] as string | null | undefined) ?? ''
    if (current && before && before !== after) changes.push({ tipo: meta.tipo, titulo: `${meta.label} atualizado(a) no cadastro`, anterior: before, novo: after || '—' })
  }
  if (sensivel.salario != null && nextSensivel.salario != null && sensivel.salario !== nextSensivel.salario) {
    changes.push({ tipo: 'SALARIO', titulo: 'Salário atualizado no cadastro', anterior: fmtMoney(sensivel.salario), novo: fmtMoney(nextSensivel.salario) })
  }
  for (const change of changes) {
    await addHistorico({ colaboradorId, dataEvento: today, motivo: 'Atualização cadastral', actor, ...change })
  }
  return { saved, changes: changes.length }
}

const SENSITIVE_IMPORT_LABELS: Record<string, string> = {
  nomeMae: 'nome da mãe', nomePai: 'nome do pai', estadoCivil: 'estado civil', escolaridade: 'escolaridade',
  rgOrgao: 'órgão emissor', rgEmissao: 'emissão do RG', pis: 'PIS', endereco: 'endereço', banco: 'dados bancários',
  salario: 'salário', jornada: 'jornada', horario: 'horário', funcao: 'função',
}

/**
 * Localiza a admissão digital que originou o colaborador: primeiro pelo vínculo de sincronização
 * (employeeId = erpnextId), depois pelo hash do CPF. Só aceita admissões já concluídas/assinadas.
 */
export async function findLinkedAdmissionId(colaborador: { erpnextId: string; cpf: string | null }): Promise<string | null> {
  const bySync = await prisma.eRPNextSync.findFirst({
    where: { employeeId: colaborador.erpnextId }, orderBy: { createdAt: 'desc' }, select: { admissionId: true },
  })
  if (bySync) return bySync.admissionId
  const digits = (colaborador.cpf ?? '').replace(/\D/g, '')
  if (digits.length !== 11) return null
  const byCpf = await prisma.admissionField.findFirst({
    where: { key: 'cpf', searchHash: hashSensitive(digits), admission: { status: { in: ['SIGNED', 'READY_FOR_ERPNEXT', 'SYNCING', 'SYNCED', 'ERPNEXT_ERROR', 'COMPLETED'] } } },
    orderBy: { updatedAt: 'desc' }, select: { admissionId: true },
  })
  return byCpf?.admissionId ?? null
}

/** Importa da admissão os dados AINDA vazios no perfil. Nunca sobrescreve o que já foi preenchido. */
export async function importFromAdmission(colaborador: { id: string; erpnextId: string; cpf: string | null }, actor: Actor) {
  const admissionId = await findLinkedAdmissionId(colaborador)
  if (!admissionId) return { admissionId: null, imported: [] as string[] }
  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, include: { fields: true } })
  if (!admission) return { admissionId: null, imported: [] as string[] }
  const fields: Record<string, string> = {}
  for (const field of admission.fields) {
    const value = field.sensitive ? decryptAdmissionValue(field.value) : field.value
    if (typeof value === 'string' && value.trim()) fields[field.key] = value.trim()
  }
  const current = await getPerfilView(colaborador.id)
  const input: Record<string, unknown> = {}
  const imported: string[] = []
  const fill = (key: string, value: string | number | null | undefined) => {
    const existing = (current as Record<string, unknown>)[key]
    if (value == null || value === '' || (existing != null && existing !== '')) return
    input[key] = value
    imported.push(SENSITIVE_IMPORT_LABELS[key] ?? key)
  }
  fill('nomeMae', fields.motherName); fill('nomePai', fields.fatherName)
  fill('estadoCivil', fields.maritalStatus); fill('escolaridade', fields.education)
  fill('rgOrgao', fields.rgIssuer); fill('rgEmissao', fields.rgIssuedAt)
  fill('pis', fields.pis); fill('salario', admission.salary)
  fill('jornada', admission.monthlyHours ? `${admission.monthlyHours} horas mensais` : admission.weeklyHours ? `${admission.weeklyHours} horas semanais` : admission.workSchedule)
  fill('horario', admission.workSchedule); fill('funcao', admission.jobTitle)
  const emptyEndereco = Object.values(current.endereco).every((v) => !v)
  if (emptyEndereco && (fields.street || fields.zipCode)) {
    input.endereco = { cep: fields.zipCode, logradouro: fields.street, numero: fields.number, complemento: fields.complement, bairro: fields.district, cidade: fields.city, uf: fields.state }
    imported.push(SENSITIVE_IMPORT_LABELS.endereco)
  }
  const emptyBanco = Object.values(current.banco).every((v) => !v)
  if (emptyBanco && fields.bank) {
    input.banco = { banco: fields.bank, agencia: fields.agency, conta: fields.account, digito: fields.accountDigit, tipo: fields.accountType }
    imported.push(SENSITIVE_IMPORT_LABELS.banco)
  }
  const parsed = perfilSchema.safeParse(input)
  if (imported.length && parsed.success) {
    await savePerfil(colaborador.id, parsed.data, actor)
    await prisma.colaboradorPerfil.update({ where: { colaboradorId: colaborador.id }, data: { admissionId } })
  }
  return { admissionId, imported: parsed.success ? imported : [] }
}
