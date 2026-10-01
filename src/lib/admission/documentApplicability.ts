import { prisma } from '@/lib/prisma'
import { isFaceVerificationEnabled } from './features'
import { COUNCIL_DOCUMENT_KEYS, DEPENDENT_DOCUMENT_KEYS, isDocumentApplicableToPosition, isMaleGender, MILITARY_DOCUMENT_KEYS } from './documentRules'

function fieldValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

/**
 * Reavalia documentos condicionais usando as respostas atuais do candidato.
 * Itens dispensados automaticamente não têm revisor, o que permite reabri-los caso a resposta mude.
 */
export async function reconcileAdmissionDocumentApplicability(admissionId: string) {
  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: {
      id: true, processType: true, status: true, jobTitle: true, progress: true,
      fields: { where: { key: 'gender' }, select: { value: true }, take: 1 },
      dependents: { select: { id: true }, take: 1 },
      documents: { select: { id: true, status: true, uploadedAt: true, reviewedById: true, type: { select: { key: true, required: true } } } },
    },
  })
  if (!admission || admission.status === 'CANCELLED') return false

  const gender = fieldValue(admission.fields[0]?.value)
  const hasDependents = admission.dependents.length > 0
  const updates: Promise<unknown>[] = []

  for (const document of admission.documents) {
    const key = document.type.key
    let applicable: boolean | null = null
    let reason = ''
    if (COUNCIL_DOCUMENT_KEYS.has(key)) {
      applicable = isDocumentApplicableToPosition(key, admission.jobTitle)
      reason = 'Não se aplica ao cargo do colaborador.'
    } else if (MILITARY_DOCUMENT_KEYS.has(key) && gender) {
      applicable = isMaleGender(gender)
      reason = 'Não se aplica ao gênero informado pelo colaborador.'
    } else if (DEPENDENT_DOCUMENT_KEYS.has(key)) {
      applicable = hasDependents
      reason = 'O colaborador informou que não possui dependentes.'
    }

    if (applicable === false && !document.uploadedAt && document.status === 'PENDING') {
      updates.push(prisma.admissionDocument.update({ where: { id: document.id }, data: { status: 'NOT_APPLICABLE', rejectionReason: reason, reviewedAt: null, reviewedById: null } }))
    } else if (applicable === true && document.status === 'NOT_APPLICABLE' && !document.reviewedById) {
      updates.push(prisma.admissionDocument.update({ where: { id: document.id }, data: { status: 'PENDING', rejectionReason: null, reviewedAt: null } }))
    }
  }

  if (!updates.length) return false
  await Promise.all(updates)

  // Uma condição automática pode ser a última pendência de uma admissão antiga.
  const remaining = await prisma.admissionDocument.count({ where: { admissionId, type: { required: true }, status: { notIn: ['APPROVED', 'NOT_APPLICABLE'] } } })
  if (admission.processType === 'ADMISSION' && remaining === 0 && ['IN_PROGRESS', 'AWAITING_DOCUMENTS', 'DOCUMENTS_UNDER_REVIEW', 'CORRECTION_REQUESTED', 'DOCUMENTS_APPROVED'].includes(admission.status)) {
    const photo = await prisma.badgePhoto.findFirst({ where: { admissionId, confirmedAt: { not: null } }, orderBy: { createdAt: 'desc' }, select: { approvedAt: true } })
    const photoApproved = Boolean(photo?.approvedAt)
    const faceVerificationEnabled = isFaceVerificationEnabled()
    await prisma.admission.update({ where: { id: admissionId }, data: {
      status: photoApproved ? (faceVerificationEnabled ? 'FACE_VALIDATION_PENDING' : 'CONTRACT_PENDING') : 'DOCUMENTS_APPROVED',
      currentStep: photoApproved ? (faceVerificationEnabled ? 'validacao-facial' : 'revisao') : 'foto',
      progress: photoApproved ? { set: Math.max(faceVerificationEnabled ? 74 : 82, admission.progress) } : undefined,
      lastActivityAt: new Date(),
    } })
  }
  return true
}
