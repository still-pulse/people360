import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sanitizeAuditMetadata } from './security'

export async function logAdmissionEvent(input: {
  admissionId: string; actorId?: string | null; actorName?: string | null; actorType: string
  action: string; resource?: string; resourceId?: string | null; ip?: string | null
  userAgent?: string | null; metadata?: Record<string, unknown>
}) {
  await prisma.admissionAuditLog.create({ data: {
    admissionId: input.admissionId, actorId: input.actorId, actorName: input.actorName,
    actorType: input.actorType, action: input.action, resource: input.resource ?? 'Admission',
    resourceId: input.resourceId, ip: input.ip, userAgent: input.userAgent,
    metadata: input.metadata ? sanitizeAuditMetadata(input.metadata) as Prisma.InputJsonValue : Prisma.JsonNull,
  } })
}
