import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { encryptAdmissionValue, isValidCpf, maskCpf } from '@/lib/admission/security'
import { fmtDate, parseDateInput } from './format'
import { addHistorico, auditDossie } from './history'
import { DossieError } from './documentos'
import { toDependenteSnap } from './snapshot'
import type { Actor } from './types'

export const PARENTESCOS = ['Filho(a)', 'Cônjuge / Companheiro(a)', 'Enteado(a)', 'Pai', 'Mãe', 'Irmão(ã)', 'Neto(a)', 'Outro'] as const

export const dependenteSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo do dependente.').max(160),
  cpf: z.string().trim().max(14).optional().nullable(),
  nascimento: z.string().min(8, 'Informe a data de nascimento.'),
  parentesco: z.string().trim().min(2, 'Informe o parentesco.').max(60),
  sexo: z.string().trim().max(20).optional().nullable(),
  dependenteIr: z.boolean().default(false),
  salarioFamilia: z.boolean().default(false),
  planoSaude: z.boolean().default(false),
  inclusaoEm: z.string().optional().nullable(),
  exclusaoEm: z.string().optional().nullable(),
})
export type DependenteInput = z.infer<typeof dependenteSchema>

function toData(input: DependenteInput) {
  const nascimento = parseDateInput(input.nascimento)
  if (!nascimento) throw new DossieError('Data de nascimento inválida.', 422)
  if (nascimento > new Date()) throw new DossieError('A data de nascimento não pode estar no futuro.', 422)
  const digits = (input.cpf ?? '').replace(/\D/g, '')
  if (digits && !isValidCpf(digits)) throw new DossieError('CPF do dependente inválido.', 422)
  const exclusao = parseDateInput(input.exclusaoEm)
  const inclusao = parseDateInput(input.inclusaoEm) ?? new Date()
  if (exclusao && exclusao < inclusao) throw new DossieError('A data de exclusão não pode ser anterior à de inclusão.', 422)
  return {
    nome: input.nome, cpfMascarado: digits ? maskCpf(digits) : null, cpfCifrado: digits ? encryptAdmissionValue(digits) : undefined,
    nascimento, parentesco: input.parentesco, sexo: input.sexo || null,
    dependenteIr: input.dependenteIr, salarioFamilia: input.salarioFamilia, planoSaude: input.planoSaude,
    inclusaoEm: inclusao, exclusaoEm: exclusao,
  }
}

export async function listDependentes(colaboradorId: string) {
  const rows = await prisma.colaboradorDependente.findMany({ where: { colaboradorId }, orderBy: [{ exclusaoEm: 'asc' }, { nascimento: 'asc' }] })
  return rows.map((row) => ({ ...toDependenteSnap(row), cpfMascarado: row.cpfMascarado, ativo: !row.exclusaoEm }))
}

export async function createDependente(params: { colaboradorId: string; input: DependenteInput; actor: Actor & { role?: string }; ip?: string | null }) {
  const data = toData(params.input)
  const created = await prisma.colaboradorDependente.create({ data: { colaboradorId: params.colaboradorId, criadoPorNome: params.actor.name, ...data } })
  await addHistorico({ colaboradorId: params.colaboradorId, tipo: 'DEPENDENTE', dataEvento: data.inclusaoEm, titulo: `Dependente incluído: ${data.nome}`, novo: data.parentesco, actor: params.actor })
  await auditDossie({ actor: params.actor, action: 'CREATE', entity: 'Dependente', entityId: created.id, colaboradorId: params.colaboradorId, ip: params.ip })
  return created
}

export async function updateDependente(params: { colaboradorId: string; id: string; input: DependenteInput; actor: Actor & { role?: string }; ip?: string | null }) {
  const current = await prisma.colaboradorDependente.findFirst({ where: { id: params.id, colaboradorId: params.colaboradorId } })
  if (!current) throw new DossieError('Dependente não encontrado.', 404)
  const data = toData(params.input)
  // Sem novo CPF informado, preserva o cifrado existente.
  const { cpfCifrado, cpfMascarado, ...rest } = data
  const updated = await prisma.colaboradorDependente.update({
    where: { id: current.id },
    data: { ...rest, ...(cpfCifrado ? { cpfCifrado, cpfMascarado } : {}) },
  })
  if (!current.exclusaoEm && data.exclusaoEm) {
    await addHistorico({ colaboradorId: params.colaboradorId, tipo: 'DEPENDENTE', dataEvento: data.exclusaoEm, titulo: `Dependente excluído: ${data.nome}`, anterior: fmtDate(current.inclusaoEm), actor: params.actor })
  }
  await auditDossie({ actor: params.actor, action: 'UPDATE', entity: 'Dependente', entityId: current.id, colaboradorId: params.colaboradorId, ip: params.ip })
  return updated
}
