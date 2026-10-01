import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'
import { saveDossieFile } from '@/lib/dossie/storage'
import { logOrThrow } from '@/lib/audit'
import { employeeBadgeSnapshot, badgeFileName, latestBadgePhoto, validateBadgeSnapshot } from './data'
import { renderBadgePdf } from './pdf'
import { BADGE_CATEGORY, BADGE_TEMPLATE_KEY, BADGE_TEMPLATE_VERSION, BADGE_TYPE, type BadgeIssueType, type BadgeOverrides } from './types'

export class BadgeError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export async function generateBadge(input: {
  employee: Parameters<typeof employeeBadgeSnapshot>[0]
  overrides?: BadgeOverrides
  issueType?: BadgeIssueType
  reason?: string | null
  actor: { id: string; name: string; role: string }
  ip?: string | null
}) {
  const snapshot = await employeeBadgeSnapshot(input.employee, input.overrides)
  const missing = validateBadgeSnapshot(snapshot)
  if (missing.length) throw new BadgeError(`Não foi possível gerar o crachá. Confira: ${missing.join(', ')}.`)
  const photo = await latestBadgePhoto(input.employee.id)
  if (!photo || photo.id !== snapshot.photoId) throw new BadgeError('A foto para o crachá não está disponível.')
  const photoBuffer = await readPrivateAdmissionFile(photo.processedPath || photo.originalPath)
  if (!photoBuffer) throw new BadgeError('Não foi possível acessar a foto cadastrada para o crachá.')
  const pdf = renderBadgePdf(snapshot, photoBuffer, photo.mimeType)
  const saved = await saveDossieFile(input.employee.id, 'crachas', pdf)
  const previous = await prisma.colaboradorDocumento.findFirst({
    where: { colaboradorId: input.employee.id, tipo: BADGE_TYPE }, orderBy: { versao: 'desc' }, select: { versao: true },
  })
  const version = (previous?.versao ?? 0) + 1
  const issueType: BadgeIssueType = previous ? 'SECOND_COPY' : (input.issueType ?? 'INITIAL')
  const fileName = badgeFileName(snapshot.fullName)
  const document = await prisma.colaboradorDocumento.create({
    data: {
      colaboradorId: input.employee.id, tipo: BADGE_TYPE, categoria: BADGE_CATEGORY,
      titulo: `Crachá - ${snapshot.fullName}`, origem: 'GERADO', status: 'VIGENTE', versao: version,
      templateKey: BADGE_TEMPLATE_KEY, templateVersion: BADGE_TEMPLATE_VERSION,
      dados: { issueType, reason: input.reason?.trim() || null, overrides: input.overrides ?? {} } as Prisma.InputJsonValue,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      observacao: issueType === 'SECOND_COPY' ? (input.reason?.trim() || 'Segunda via') : 'Emissão inicial',
      arquivoPath: saved.storagePath, arquivoNome: fileName, arquivoMime: saved.mimeType,
      arquivoTamanho: saved.sizeBytes, criadoPorId: input.actor.id, criadoPorNome: input.actor.name, geradoEm: new Date(),
    },
  })
  await logOrThrow({
    userId: input.actor.id, userName: input.actor.name, userRole: input.actor.role,
    action: 'CREATE', entity: 'Cracha', entityId: document.id, entityName: snapshot.fullName,
    details: { colaboradorId: input.employee.id, versao: version, tipoEmissao: issueType, motivo: input.reason || null }, ip: input.ip,
  })
  return document
}
