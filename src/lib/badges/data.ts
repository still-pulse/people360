import type { Colaborador, ColaboradorPerfil } from '@prisma/client'
import { formatDate } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import type { BadgeOverrides, BadgeSnapshot } from './types'
import { printableBadgeDocument, splitBadgeName } from './format'

export { badgeBackName, badgeDepartmentLines, printableBadgeDocument, splitBadgeName } from './format'

export function badgeFileName(fullName: string) {
  const slug = fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'Colaborador'
  return `Cracha-${slug}.pdf`
}

type BadgeEmployee = Colaborador & { perfil?: ColaboradorPerfil | null }

export async function latestBadgePhoto(employeeId: string) {
  return prisma.badgePhoto.findFirst({
    where: {
      admission: { collaboratorId: employeeId },
      confirmedAt: { not: null },
      approvedAt: { not: null },
      rejectionReason: null,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function employeeBadgeSnapshot(employee: BadgeEmployee, overrides: BadgeOverrides = {}): Promise<BadgeSnapshot> {
  const photo = await latestBadgePhoto(employee.id)
  const fullName = String(overrides.fullName ?? employee.perfil?.nomeSocial ?? employee.employeeName).trim()
  const split = splitBadgeName(fullName)
  return {
    employeeId: String(overrides.employeeId ?? employee.matricula ?? employee.erpnextId).trim(),
    fullName,
    firstName: String(overrides.firstName ?? split.firstName).trim(),
    lastName: String(overrides.lastName ?? split.lastName).trim(),
    role: String(overrides.role ?? employee.designation ?? employee.perfil?.funcao ?? '').trim(),
    department: String(overrides.department ?? employee.department ?? employee.secao ?? '').trim(),
    admissionDate: String(overrides.admissionDate ?? (employee.dateOfJoining ? formatDate(employee.dateOfJoining) : '')).trim(),
    document: printableBadgeDocument(String(overrides.document ?? '')),
    photoId: photo?.id ?? '',
    photoFocusY: Math.min(100, Math.max(0, Number(overrides.photoFocusY ?? 18))),
  }
}

export function validateBadgeSnapshot(snapshot: BadgeSnapshot) {
  const labels: Record<keyof Pick<BadgeSnapshot, 'photoId' | 'fullName' | 'firstName' | 'lastName' | 'role' | 'department' | 'admissionDate' | 'employeeId'>, string> = {
    photoId: 'foto para o crachá', fullName: 'nome completo', firstName: 'nome no crachá', lastName: 'sobrenome',
    role: 'cargo', department: 'setor', admissionDate: 'data de admissão', employeeId: 'matrícula',
  }
  return (Object.entries(labels) as [keyof typeof labels, string][])
    .filter(([key]) => !String(snapshot[key] || '').trim()).map(([, label]) => label)
}

export function snapshotNeedsUpdate(current: BadgeSnapshot, previous: Partial<BadgeSnapshot> | null | undefined) {
  if (!previous) return false
  const keys: (keyof BadgeSnapshot)[] = ['fullName', 'role', 'department', 'admissionDate', 'employeeId', 'photoId']
  if (keys.some((key) => String(current[key] ?? '') !== String(previous[key] ?? ''))) return true
  const previousDocument = String(previous.document ?? '')
  return previousDocument !== printableBadgeDocument(previousDocument)
}
