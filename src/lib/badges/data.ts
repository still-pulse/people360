import type { Colaborador, ColaboradorPerfil } from '@prisma/client'
import { formatDate } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import type { BadgeOverrides, BadgeSnapshot } from './types'

const PARTICLES = new Set(['da', 'das', 'de', 'do', 'dos', 'e'])

export function splitBadgeName(value: string) {
  const parts = value.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' }
  const lastIndex = [...parts].map((part) => part.toLocaleLowerCase('pt-BR')).findLastIndex((part) => !PARTICLES.has(part))
  const lastName = parts[lastIndex] || parts[parts.length - 1]
  const meaningfulBefore = parts.slice(0, Math.max(1, lastIndex)).filter((part) => !PARTICLES.has(part.toLocaleLowerCase('pt-BR')))
  const firstName = meaningfulBefore.length >= 2 && parts.length >= 4
    ? `${meaningfulBefore[0]} ${meaningfulBefore[1]}`
    : meaningfulBefore[0] || parts[0]
  return { firstName, lastName }
}

export function badgeFileName(fullName: string) {
  const slug = fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'Colaborador'
  return `Cracha-${slug}.pdf`
}

export function normalizeDocument(employee: Pick<Colaborador, 'cpf' | 'rg'>) {
  if (employee.cpf) return `CPF ${employee.cpf}`
  if (employee.rg) return `RG ${employee.rg}`
  return ''
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
    document: String(overrides.document ?? normalizeDocument(employee)).trim(),
    photoId: photo?.id ?? '',
    photoFocusY: Math.min(100, Math.max(0, Number(overrides.photoFocusY ?? 18))),
  }
}

export function validateBadgeSnapshot(snapshot: BadgeSnapshot) {
  const labels: Record<keyof Pick<BadgeSnapshot, 'photoId' | 'fullName' | 'firstName' | 'lastName' | 'role' | 'department' | 'admissionDate' | 'document' | 'employeeId'>, string> = {
    photoId: 'foto para o crachá', fullName: 'nome completo', firstName: 'nome no crachá', lastName: 'sobrenome',
    role: 'cargo', department: 'setor', admissionDate: 'data de admissão', document: 'documento', employeeId: 'matrícula',
  }
  return (Object.entries(labels) as [keyof typeof labels, string][])
    .filter(([key]) => !String(snapshot[key] || '').trim()).map(([, label]) => label)
}

export function snapshotNeedsUpdate(current: BadgeSnapshot, previous: Partial<BadgeSnapshot> | null | undefined) {
  if (!previous) return false
  const keys: (keyof BadgeSnapshot)[] = ['fullName', 'role', 'department', 'admissionDate', 'document', 'employeeId', 'photoId']
  return keys.some((key) => String(current[key] ?? '') !== String(previous[key] ?? ''))
}
