import { prisma } from '@/lib/prisma'
import { detectMime, readPrivateAdmissionFile } from '@/lib/admission/storage'
import { erpnextBaseUrl, erpnextConfigured } from '@/lib/erpnextClient'
import { findLinkedAdmissionId } from './perfil'

export type ColaboradorPhoto = { buffer: Buffer; mime: 'image/jpeg' | 'image/png'; source: 'crachá' | 'erpnext' }

const MAX_BYTES = 6 * 1024 * 1024

function asImage(buffer: Buffer | null, source: ColaboradorPhoto['source']): ColaboradorPhoto | null {
  if (!buffer || !buffer.length || buffer.length > MAX_BYTES) return null
  const detected = detectMime(buffer)
  if (!detected || (detected.mime !== 'image/jpeg' && detected.mime !== 'image/png')) return null
  return { buffer, mime: detected.mime, source }
}

async function fetchErpnextImage(imagePath: string): Promise<Buffer | null> {
  try {
    const base = erpnextBaseUrl()
    if (!base) return null
    const baseUrl = new URL(base)
    if (!['http:', 'https:'].includes(baseUrl.protocol)) return null
    const url = new URL(imagePath, baseUrl)
    // Nunca busca imagem fora do host configurado (evita SSRF e vazamento de credenciais).
    const sameHost = url.origin === baseUrl.origin
    if (!sameHost) return null
    const headers: Record<string, string> = {}
    if (sameHost && erpnextConfigured()) headers.Authorization = `token ${process.env.ERPNEXT_API_KEY}:${process.env.ERPNEXT_API_SECRET}`
    const response = await fetch(url, { headers, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(8000) })
    if (!response.ok) return null
    return Buffer.from(await response.arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Foto do colaborador = a mesma do crachá: prioriza a foto confirmada na admissão digital
 * (BadgePhoto) e, na falta dela, a imagem do cadastro no ERPNext. Devolve null se não houver
 * (o PDF nunca exibe imagem quebrada).
 */
export async function loadColaboradorPhoto(colaborador: { erpnextId: string; cpf: string | null; imagePath: string | null }): Promise<ColaboradorPhoto | null> {
  const admissionId = await findLinkedAdmissionId(colaborador)
  if (admissionId) {
    const badge = await prisma.badgePhoto.findFirst({ where: { admissionId }, orderBy: [{ confirmedAt: 'desc' }, { createdAt: 'desc' }] })
    if (badge) {
      const fromBadge = asImage(await readPrivateAdmissionFile(badge.processedPath || badge.originalPath), 'crachá')
      if (fromBadge) return fromBadge
    }
  }
  if (colaborador.imagePath) return asImage(await fetchErpnextImage(colaborador.imagePath), 'erpnext')
  return null
}
