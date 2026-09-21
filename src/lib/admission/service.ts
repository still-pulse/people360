import { prisma } from '@/lib/prisma'
import { DEFAULT_DOCUMENT_TYPES } from './constants'
import { generateAdmissionToken, hashToken, makeProtocol } from './security'

export async function ensureAdmissionDocumentTypes() {
  await Promise.all(DEFAULT_DOCUMENT_TYPES.map((type) => prisma.admissionDocumentType.upsert({
    where: { key: type.key }, update: {}, create: type,
  })))
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

export async function createAdmissionRecord(input: {
  candidateId?: string; vacancyId?: string; unitId: string; ownerId?: string; createdById: string
  candidateName: string; candidateEmail?: string; candidatePhone?: string; jobTitle: string; department?: string
  hireDate: Date; salary?: number; hazardPayPercentage?: number; workSchedule?: string; breakSchedule?: string
  weeklyHours?: number; contractType: string; experienceDays?: number; contractEndDate?: Date; validityDays?: number
}) {
  const types = await ensureAdmissionDocumentTypes()
  const generated = generateAdmissionToken()
  const expiresAt = new Date(Date.now() + Math.min(30, Math.max(1, input.validityDays ?? 7)) * 86400000)
  const admission = await prisma.admission.create({ data: {
    protocol: makeProtocol(), candidateId: input.candidateId, vacancyId: input.vacancyId, unitId: input.unitId,
    ownerId: input.ownerId, createdById: input.createdById, candidateName: input.candidateName,
    candidateEmail: input.candidateEmail, candidatePhone: input.candidatePhone, jobTitle: input.jobTitle,
    department: input.department, hireDate: input.hireDate, salary: input.salary,
    hazardPayPercentage: input.hazardPayPercentage, workSchedule: input.workSchedule,
    breakSchedule: input.breakSchedule, weeklyHours: input.weeklyHours, contractType: input.contractType,
    experienceDays: input.experienceDays, contractEndDate: input.contractEndDate, status: 'LINK_SENT',
    tokens: { create: { tokenHash: generated.hash, tokenHint: generated.hint, expiresAt } },
    documents: { create: types.map((type) => ({ typeId: type.id })) },
    faceVerifications: { create: { provider: process.env.FACE_VERIFICATION_PROVIDER || 'mock' } },
  }, include: { unit: true, owner: { select: { id: true, name: true } } } })
  return { admission, token: generated.token, expiresAt }
}
