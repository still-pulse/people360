import { prisma } from '@/lib/prisma'
import { erpnextConfigured } from '@/lib/erpnextClient'
import { refreshColaboradorFromErpnext } from '@/lib/erpnextEmployees'
import { importAdmissionIntoDossie } from '@/lib/dossie/admissaoImport'
import { logAdmissionEvent } from './audit'
import { erpnextEmployeeForAdmission } from './erpnextDocuments'

type Actor = { id: string; name: string }

export type CollaboratorLinkResult =
  | { ok: true; colaboradorId: string; employeeId: string; imported: { documentos: number; assinados: number; dependentes: number } | null; importError?: string }
  | { ok: false; error: string }

/** Colaborador do People360 ligado à admissão (pelo Employee criado no ERPNext), se já existir. */
export async function collaboratorForAdmission(admissionId: string) {
  const employeeId = await erpnextEmployeeForAdmission(admissionId)
  if (!employeeId) return null
  return prisma.colaborador.findUnique({ where: { erpnextId: employeeId }, select: { id: true, employeeName: true, erpnextId: true } })
}

/**
 * Depois da admissão sincronizada: traz o Employee do ERPNext para Colaboradores e importa a admissão
 * (dados, documentos aprovados, contratos assinados e dependentes) para o dossiê. É idempotente e
 * nunca lança: a falha fica registrada no histórico da admissão para o RH tentar de novo.
 */
export async function linkAdmissionCollaborator(admissionId: string, actor: Actor, ip?: string | null): Promise<CollaboratorLinkResult> {
  const fail = async (error: string, cause?: unknown) => {
    console.error('[admission] Falha ao criar o colaborador da admissão', admissionId, cause ?? error)
    await logAdmissionEvent({ admissionId, actorId: actor.id, actorName: actor.name, actorType: 'USER', action: 'COLLABORATOR_LINK_ERROR', ip, metadata: { error } })
    return { ok: false as const, error }
  }
  const employeeId = await erpnextEmployeeForAdmission(admissionId)
  if (!employeeId) return fail('A admissão ainda não tem colaborador criado no ERPNext.')
  if (employeeId.startsWith('MOCK-')) return fail('Admissão sincronizada em modo de teste (sem colaborador real no ERPNext).')
  if (!erpnextConfigured()) return fail('A integração com o ERPNext não está configurada neste ambiente.')

  let colaborador
  try {
    colaborador = await refreshColaboradorFromErpnext(employeeId)
  } catch (caught) {
    return fail(`Não foi possível trazer o colaborador ${employeeId} do ERPNext: ${caught instanceof Error ? caught.message : 'erro desconhecido'}`, caught)
  }

  let imported: { documentos: number; assinados: number; dependentes: number } | null = null
  let importError: string | undefined
  try {
    const result = await importAdmissionIntoDossie(colaborador, actor, ip)
    imported = { documentos: result.documentos, assinados: result.assinados, dependentes: result.dependentes }
  } catch (caught) {
    importError = `Colaborador criado, mas a importação para o dossiê falhou: ${caught instanceof Error ? caught.message : 'erro desconhecido'}`
    console.error('[admission] Falha ao importar a admissão para o dossiê', admissionId, caught)
  }
  await logAdmissionEvent({
    admissionId, actorId: actor.id, actorName: actor.name, actorType: 'USER', action: 'COLLABORATOR_LINKED', ip,
    metadata: { colaboradorId: colaborador.id, employeeId, ...(imported ?? {}), ...(importError ? { importError } : {}) },
  })
  return { ok: true, colaboradorId: colaborador.id, employeeId, imported, ...(importError ? { importError } : {}) }
}
