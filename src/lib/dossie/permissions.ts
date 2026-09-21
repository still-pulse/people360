import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analystCanAccessUnit, getSessionOrUnauthorized } from '@/lib/apiHelpers'

// Matriz de permissões do dossiê. O projeto usa RBAC por papel; estas chaves nomeiam as
// capacidades para que possam migrar para uma matriz configurável sem tocar nas rotas.
export const DOSSIE_PERMISSIONS = {
  'employee.documents.view': ['ADMIN', 'ANALYST'],
  'employee.documents.create': ['ADMIN', 'ANALYST'],
  'employee.documents.edit': ['ADMIN', 'ANALYST'],
  'employee.documents.cancel': ['ADMIN', 'ANALYST'],
  'employee.documents.export': ['ADMIN', 'ANALYST'],
  'employee.contracts.create': ['ADMIN', 'ANALYST'],
  'employee.amendments.create': ['ADMIN', 'ANALYST'],
  'employee.evaluations.create': ['ADMIN', 'ANALYST'],
  'employee.dependents.edit': ['ADMIN', 'ANALYST'],
} as const

export type DossiePermission = keyof typeof DOSSIE_PERMISSIONS

export function roleCan(role: string | undefined | null, permission: DossiePermission): boolean {
  return !!role && (DOSSIE_PERMISSIONS[permission] as readonly string[]).includes(role)
}

export function permissionsFor(role: string | undefined | null): Record<DossiePermission, boolean> {
  return Object.fromEntries(
    (Object.keys(DOSSIE_PERMISSIONS) as DossiePermission[]).map((key) => [key, roleCan(role, key)]),
  ) as Record<DossiePermission, boolean>
}

type Session = NonNullable<Awaited<ReturnType<typeof getSessionOrUnauthorized>>['session']>

export type DossieAccess =
  | { ok: true; session: Session; actor: { id: string; name: string; role: string }; colaborador: NonNullable<Awaited<ReturnType<typeof loadColaborador>>> }
  | { ok: false; response: NextResponse }

function loadColaborador(idOrErpnextId: string) {
  return prisma.colaborador.findFirst({
    where: { OR: [{ id: idOrErpnextId }, { erpnextId: idOrErpnextId }] },
    include: { unit: { select: { id: true, name: true, color: true } } },
  })
}

/**
 * Autorização SEMPRE no backend: sessão + papel + escopo de unidade do analista.
 * Nunca depender apenas do que a interface esconde.
 */
export async function authorizeDossie(permission: DossiePermission, idOrErpnextId: string): Promise<DossieAccess> {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return { ok: false, response: error }
  if (!roleCan(session!.user.role, permission)) {
    return { ok: false, response: NextResponse.json({ error: 'Sem permissão para esta ação.' }, { status: 403 }) }
  }
  const colaborador = await loadColaborador(idOrErpnextId)
  if (!colaborador) return { ok: false, response: NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 }) }
  if (!analystCanAccessUnit(session!, colaborador.unitId)) {
    return { ok: false, response: NextResponse.json({ error: 'Sem acesso a este colaborador.' }, { status: 403 }) }
  }
  return {
    ok: true, session: session!, colaborador,
    actor: { id: session!.user.id, name: session!.user.name || session!.user.email || 'Usuário', role: session!.user.role },
  }
}
