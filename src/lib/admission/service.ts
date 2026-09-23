import { prisma } from '@/lib/prisma'
import { syncDocumentCatalog } from './documentCatalog'
import { generateAdmissionToken, hashToken, makeProtocol } from './security'

export async function ensureAdmissionDocumentTypes() {
  await syncDocumentCatalog()
  return prisma.admissionDocumentType.findMany({ where: { active: true }, orderBy: { position: 'asc' } })
}

export async function createAdmissionToken(admissionId: string, validityDays = 7) {
  const generated = generateAdmissionToken()
  const expiresAt = new Date(Date.now() + Math.min(30, Math.max(1, validityDays)) * 86400000)
  await prisma.$transaction([
    prisma.admissionToken.updateMany({ where: { admissionId, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.admissionToken.create({ data: { admissionId, tokenHash: generated.hash, tokenHint: generated.hint, expiresAt } }),
  ])
  return { token: generated.token, expiresAt }
}

export async function getAdmissionByPublicToken(rawToken: string, touch = false) {
  const token = await prisma.admissionToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { admission: { include: {
      unit: { select: { id: true, name: true } }, fields: true, dependents: true,
      transport: { include: { routes: { orderBy: { position: 'asc' } } } },
      documents: { include: { type: true }, orderBy: { type: { position: 'asc' } } },
      badgePhotos: { orderBy: { createdAt: 'desc' }, take: 1 },
      faceVerifications: { orderBy: { createdAt: 'desc' }, take: 1 },
      generatedDocuments: { include: { template: true }, orderBy: { createdAt: 'asc' } },
      signatureEnvelopes: { orderBy: { createdAt: 'desc' } },
    } } },
  })
  if (!token || token.revokedAt || token.expiresAt <= new Date() || ['CANCELLED', 'EXPIRED'].includes(token.admission.status)) return null
  if (touch) await prisma.admissionToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date(), firstUsedAt: token.firstUsedAt ?? new Date() } })
  return token
}

const PUBLIC_MUTABLE_STATUSES = new Set([
  'LINK_SENT', 'IN_PROGRESS', 'AWAITING_DOCUMENTS', 'DOCUMENTS_UNDER_REVIEW',
  'CORRECTION_REQUESTED', 'DOCUMENTS_APPROVED', 'FACE_VALIDATION_PENDING',
  'CONTRACT_PENDING', 'SIGNATURE_PENDING',
])

/** Resolve o link somente enquanto o candidato ainda pode alterar a admissão. */
export async function getMutableAdmissionByPublicToken(rawToken: string, touch = false) {
  const token = await getAdmissionByPublicToken(rawToken, touch)
  return token && PUBLIC_MUTABLE_STATUSES.has(token.admission.status) ? token : null
}

export async function createAdmissionRecord(input: {
  candidateId?: string; vacancyId?: string; unitId: string; ownerId?: string; createdById: string
  candidateName: string; candidateEmail?: string; candidatePhone?: string; jobTitle: string; department?: string
  hireDate: Date; salary?: number; hazardPayPercentage?: number; workSchedule?: string; breakSchedule?: string
  weeklyHours?: number; monthlyHours?: number; contractType: string; experienceDays?: number; contractEndDate?: Date; validityDays?: number
  /** Tipos de documento a solicitar; sem informar, usa os marcados por padrão no catálogo. */
  documentTypeIds?: string[]
}) {
  const types = await ensureAdmissionDocumentTypes()
  const selectedIds = new Set(input.documentTypeIds ?? [])
  const requested = input.documentTypeIds !== undefined
    ? types.filter((type) => selectedIds.has(type.id))
    : types.filter((type) => type.required || type.defaultSelected)
  if (!requested.length) throw new Error('Selecione ao menos um documento a solicitar.')
  const generated = generateAdmissionToken()
  const expiresAt = new Date(Date.now() + Math.min(30, Math.max(1, input.validityDays ?? 7)) * 86400000)
  const admission = await prisma.admission.create({ data: {
    protocol: makeProtocol(), candidateId: input.candidateId, vacancyId: input.vacancyId, unitId: input.unitId,
    ownerId: input.ownerId, createdById: input.createdById, candidateName: input.candidateName,
    candidateEmail: input.candidateEmail, candidatePhone: input.candidatePhone, jobTitle: input.jobTitle,
    department: input.department, hireDate: input.hireDate, salary: input.salary,
    hazardPayPercentage: input.hazardPayPercentage, workSchedule: input.workSchedule,
    breakSchedule: input.breakSchedule, weeklyHours: input.weeklyHours, monthlyHours: input.monthlyHours, contractType: input.contractType,
    experienceDays: input.experienceDays, contractEndDate: input.contractEndDate, status: 'LINK_SENT',
    tokens: { create: { tokenHash: generated.hash, tokenHint: generated.hint, expiresAt } },
    documents: { create: requested.map((type) => ({ typeId: type.id })) },
    faceVerifications: { create: { provider: process.env.FACE_VERIFICATION_PROVIDER || 'mock' } },
  }, include: { unit: true, owner: { select: { id: true, name: true } } } })
  return { admission, token: generated.token, expiresAt }
}
