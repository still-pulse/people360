import { NextResponse } from 'next/server'
import { analystCanAccessUnit, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { prisma } from '@/lib/prisma'

export const BADGE_PERMISSIONS = {
  'badges.view': ['ADMIN', 'ANALYST'],
  'badges.generate': ['ADMIN', 'ANALYST'],
  'badges.download': ['ADMIN', 'ANALYST'],
} as const

export type BadgePermission = keyof typeof BADGE_PERMISSIONS

export function canBadge(role: string | null | undefined, permission: BadgePermission) {
  return !!role && (BADGE_PERMISSIONS[permission] as readonly string[]).includes(role)
}
export async function authorizeBadge(permission: BadgePermission, employeeId: string) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return { ok: false as const, response: error }
  const role = session!.user.actualRole ?? session!.user.role
  if (!canBadge(role, permission)) {
    return { ok: false as const, response: NextResponse.json({ error: 'Sem permissão para esta ação.' }, { status: 403 }) }
  }
  const employee = await prisma.colaborador.findFirst({
    where: { OR: [{ id: employeeId }, { erpnextId: employeeId }] },
    include: { unit: { select: { id: true, name: true, color: true } }, perfil: true },
  })
  if (!employee) return { ok: false as const, response: NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 }) }
  if (!analystCanAccessUnit(session!, employee.unitId)) {
    return { ok: false as const, response: NextResponse.json({ error: 'Sem acesso a este colaborador.' }, { status: 403 }) }
  }
  return {
    ok: true as const,
    session: session!,
    employee,
    actor: { id: session!.user.id, name: session!.user.name || session!.user.email || 'Usuário', role },
  }
}
