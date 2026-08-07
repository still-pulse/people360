import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'

export async function getSessionOrUnauthorized() {
  const session = await getServerSession(authOptions)
  if (!session) return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { session, error: null }
}

/** Perfis com acesso somente leitura (sem criar/editar/excluir). */
export function isReadOnlyRole(role: string | undefined | null): boolean {
  return role === 'JURIDICO'
}

export function forbidIfReadOnly(role: string | undefined | null) {
  if (isReadOnlyRole(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

type SessionLike = { user: { role: string; unitId?: string | null; unitIds?: string[] } }

/** Retorna as unidades que o analista gerencia (vazio = sem acesso). Admins recebem null. */
export function getAnalystUnits(session: SessionLike): string[] | null {
  if (session.user.role !== 'ANALYST') return null
  const multi = session.user.unitIds
  if (multi && multi.length > 0) return multi
  return session.user.unitId ? [session.user.unitId] : []
}

/**
 * Verifica se um analista tem acesso a uma unidade específica.
 * Admins sempre têm acesso. Retorna false se analista sem unidades.
 */
export function analystCanAccessUnit(session: SessionLike, unitId: string | null | undefined): boolean {
  if (session.user.role !== 'ANALYST') return true
  if (!unitId) return false
  const units = getAnalystUnits(session)!
  return units.includes(unitId)
}

/**
 * Se o usuário for ANALYST, força o filtro para as unidades dele.
 * Admin pode ver tudo (ou filtrar manualmente via requestedUnitId).
 * @param fieldName - nome do campo de unitId no modelo (padrão: 'unitId'; vagas usa 'unidadeId')
 */
export function enforceUnitFilter(
  where: Record<string, any>,
  session: SessionLike,
  requestedUnitId?: string | null,
  fieldName: string = 'unitId'
) {
  if (session.user.role === 'ANALYST') {
    const units = getAnalystUnits(session)!
    if (units.length === 0) {
      // Sem unidades — força retorno vazio
      where[fieldName] = '__NENHUMA__'
      return
    }
    // Se pediu uma unidade específica e o analista tem acesso a ela, usa só ela
    if (requestedUnitId && units.includes(requestedUnitId)) {
      where[fieldName] = requestedUnitId
    } else if (units.length === 1) {
      where[fieldName] = units[0]
    } else {
      where[fieldName] = { in: units }
    }
  } else if (requestedUnitId) {
    where[fieldName] = requestedUnitId
  }
}
