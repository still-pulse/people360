import { prisma } from '@/lib/prisma'
import { fileSlug } from '@/lib/dossie/format'
import { admissionDossierSources, renderAdmissionDossier } from '@/lib/dossie/dossier'
import { loadAdmissionBadgePhoto } from '@/lib/dossie/photo'
import { generateAdmissionDocuments } from './documentGenerator'
import { pendingRequiredDocuments } from './documentStatus'
import { decryptAdmissionValue, encryptAdmissionValue } from './security'
import { resolveDependentCpf } from './dependentCpf'

export const ACCOUNTING_DOSSIER_GENERATED = 'ACCOUNTING_DOSSIER_GENERATED'
export const ACCOUNTING_DOSSIER_SENT = 'ACCOUNTING_DOSSIER_SENT'
export const DEPENDENT_DOSSIER_VERSION = 2

export function needsDependentDossierCorrection(events: { metadata: unknown }[]) {
  const metadata = events[0]?.metadata
  return !!events.length && !(metadata && typeof metadata === 'object' && 'dependentDataVersion' in metadata && metadata.dependentDataVersion === DEPENDENT_DOSSIER_VERSION)
}

/**
 * Assinatura iniciada antes da etapa do dossiê (admissões antigas): só conta envelope que não foi cancelado.
 * Envio cancelado pelo RH não pode liberar um novo link sem a conferência da contabilidade.
 */
export function signatureAlreadyStarted(envelopes: { status: string }[]) {
  return envelopes.some((envelope) => envelope.status !== 'CANCELLED')
}

export async function accountingDossierState(admissionId: string) {
  const [events, latestDocument] = await Promise.all([
    prisma.admissionAuditLog.findMany({
      where: { admissionId, action: { in: [ACCOUNTING_DOSSIER_GENERATED, ACCOUNTING_DOSSIER_SENT] } },
      select: { action: true, createdAt: true }, orderBy: { createdAt: 'desc' },
    }),
    prisma.admissionDocument.findFirst({ where: { admissionId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
  ])
  const generated = events.find((event) => event.action === ACCOUNTING_DOSSIER_GENERATED)
  const generatedAt = generated && (!latestDocument || generated.createdAt >= latestDocument.updatedAt) ? generated.createdAt : null
  const sent = generatedAt ? events.find((event) => event.action === ACCOUNTING_DOSSIER_SENT && event.createdAt >= generatedAt) : null
  return { generatedAt, sentAt: sent?.createdAt ?? null, released: !!sent }
}

/** Dossiê Admissional (mesmo layout do colaborador integrado) para conferência da contabilidade, sem depender do ERPNext. */
// Início deste processo do servidor: fichas geradas antes dele podem ter saído com o layout antigo.
const PROCESS_STARTED_AT = new Date()

export async function buildAccountingAdmissionDossier(admissionId: string, origin: string, options: { allowIncomplete?: boolean } = {}) {
  // Ficha ainda não enviada para assinatura é refeita com o layout atual (corrige rótulos encobertos).
  // Fichas enviadas à Autentique ou assinadas nunca são alteradas.
  await prisma.generatedDocument.updateMany({
    where: { admissionId, status: 'GENERATED', template: { key: 'ficha_registro' }, createdAt: { lt: PROCESS_STARTED_AT } },
    data: { status: 'CANCELLED' },
  })
  await generateAdmissionDocuments(admissionId, origin)
  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: {
      processType: true, protocol: true, candidateName: true, jobTitle: true, hireDate: true,
      unit: { select: { name: true } },
      collaborator: { select: { matricula: true } },
      erpnextSyncs: { orderBy: { createdAt: 'desc' }, take: 1, select: { employeeCode: true } },
      fields: { where: { key: 'matricula' }, select: { value: true, sensitive: true }, take: 1 },
      documents: { select: { status: true, type: { select: { required: true } } } },
      dependents: { orderBy: { birthDate: 'asc' } },
    },
  })
  if (!admission) throw new Error('Admissão não encontrada.')
  if (admission.processType !== 'ADMISSION') throw new Error('O dossiê para contabilidade está disponível somente para admissões.')
  const pending = pendingRequiredDocuments(admission.documents)
  if (pending.length && !options.allowIncomplete) throw new Error(`Ainda existem ${pending.length} documento(s) obrigatório(s) sem aprovação do RH.`)

  const field = admission.fields[0]
  const dependents = []
  for (const dependent of admission.dependents) {
    const cpf = resolveDependentCpf(dependent)
    if (cpf && !dependent.cpfEncrypted) {
      await prisma.admissionDependent.update({ where: { id: dependent.id }, data: { cpfEncrypted: encryptAdmissionValue(cpf) } })
    }
    dependents.push({ name: dependent.name, cpf, birthDate: dependent.birthDate, relationship: dependent.relationship, irrfDependent: dependent.irrfDependent, childUnder14: dependent.childUnder14 })
  }
  const fieldValue = field ? (field.sensitive ? decryptAdmissionValue(field.value) : field.value) : null
  const matricula = (typeof fieldValue === 'string' && fieldValue.trim()) || admission.collaborator?.matricula || admission.erpnextSyncs[0]?.employeeCode || ''
  const [photo, sources] = await Promise.all([loadAdmissionBadgePhoto(admissionId), admissionDossierSources(admissionId)])
  const result = await renderAdmissionDossier({
    info: { nome: admission.candidateName, matricula, cargo: admission.jobTitle, unidade: admission.unit.name, admissao: admission.hireDate.toISOString() },
    photo, sources,
    dependents,
    warning: pending.length ? `DOCUMENTAÇÃO PENDENTE: ${pending.length} documento(s) obrigatório(s) sem aprovação do RH. Dossiê para conferência; documentação ainda incompleta.` : undefined,
    identifier: matricula ? `Matrícula: ${matricula}` : `Protocolo: ${admission.protocol}`,
  })
  return {
    buffer: result.buffer,
    fileName: `Dossie_Admissional_${fileSlug(admission.candidateName, 'COLABORADOR')}_${(matricula || admission.protocol).replace(/[^a-zA-Z0-9]/g, '')}.pdf`,
    pages: result.pages,
    documents: result.documents,
    pendingDocuments: pending.length,
  }
}
