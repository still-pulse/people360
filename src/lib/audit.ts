import { Prisma } from '@prisma/client'
import { isIP } from 'net'
import { prisma } from './prisma'

export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE'
  | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT'
  | 'UPLOAD' | 'REMOVE'
  | 'ENABLE' | 'DISABLE'
  | 'PASSWORD_CHANGED' | 'MFA_ENABLED' | 'MFA_DISABLED'
  | 'APPROVE' | 'REJECT' | 'COMMENT'
  | 'GENERATE_LINK' | 'RENEW_LINK' | 'REVOKE_LINK' | 'VIEW_FILE'
  | 'SEND'

export interface AuditPayload {
  userId?:     string | null
  userName?:   string | null
  userRole?:   string | null
  action:      AuditAction
  entity:      string
  entityId?:   string | null
  entityName?: string | null
  details?:    Record<string, unknown> | null
  ip?:         string | null
}

// Fire-and-forget — nunca quebra a operação principal
export async function log(payload: AuditPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        ...payload,
        details: payload.details === null || payload.details === undefined
          ? Prisma.JsonNull
          : (payload.details as Prisma.InputJsonValue),
      },
    })
  } catch {
    // silencia erros de log para não afetar o fluxo principal
  }
}

/** Auditoria obrigatória para operações regulatórias e de dossiê. */
export async function logOrThrow(payload: AuditPayload): Promise<void> {
  await prisma.auditLog.create({
    data: {
      ...payload,
      details: payload.details === null || payload.details === undefined
        ? Prisma.JsonNull
        : (payload.details as Prisma.InputJsonValue),
    },
  })
}

// Extrai IP do request (Next.js headers)
export function extractIp(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  const get = (key: string): string | null => {
    if (headers instanceof Headers) return headers.get(key)
    const v = (headers as Record<string, string | string[] | undefined>)[key]
    return Array.isArray(v) ? v[0] : (v ?? null)
  }
  if (process.env.TRUST_PROXY_HEADERS !== 'true') return null
  const candidate = get('cf-connecting-ip') || get('x-forwarded-for')?.split(',')[0].trim() || get('x-real-ip')
  if (!candidate) return null
  const normalized = candidate.startsWith('::ffff:') ? candidate.slice(7) : candidate
  return isIP(normalized) ? normalized : null
}

// Gera diff entre objeto antigo e novo (apenas campos alterados)
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  skip: string[] = ['updatedAt', 'createdAt', 'password', 'mfaSecret'],
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const changedBefore: Record<string, unknown> = {}
  const changedAfter: Record<string, unknown> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  keys.forEach((k) => {
    if (skip.includes(k)) return
    const bv = JSON.stringify(before[k])
    const av = JSON.stringify(after[k])
    if (bv !== av) {
      changedBefore[k] = before[k]
      changedAfter[k] = after[k]
    }
  })
  return { before: changedBefore, after: changedAfter }
}
