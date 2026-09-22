import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { decryptAdmissionText, encryptAdmissionText } from '@/lib/admission/security'

const KEYS = {
  url: 'evolutionApiUrl',
  instance: 'evolutionInstance',
  apiKey: 'evolutionApiKeyEncrypted',
  enabled: 'evolutionEnabled',
} as const

export type EvolutionConfig = { baseUrl: string; instance: string; apiKey: string; enabled: boolean }

function cleanBaseUrl(value: string) {
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A URL da Evolution API deve usar HTTP ou HTTPS.')
  return url.toString().replace(/\/$/, '')
}

export function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) throw new Error('Telefone inválido para WhatsApp.')
  return digits.startsWith('55') ? digits : `55${digits}`
}

export async function getEvolutionConfig(): Promise<EvolutionConfig | null> {
  const rows = await prisma.systemSettings.findMany({ where: { key: { in: Object.values(KEYS) } } })
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  const apiKey = decryptAdmissionText(values[KEYS.apiKey]) || ''
  if (!values[KEYS.url] || !values[KEYS.instance] || !apiKey) return null
  return { baseUrl: cleanBaseUrl(values[KEYS.url]), instance: values[KEYS.instance], apiKey, enabled: values[KEYS.enabled] !== 'false' }
}

export async function saveEvolutionConfig(input: { baseUrl: string; instance: string; apiKey?: string; enabled: boolean }) {
  const baseUrl = cleanBaseUrl(input.baseUrl)
  const instance = input.instance.trim()
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(instance)) throw new Error('Nome da instância inválido.')
  const values: Record<string, string> = { [KEYS.url]: baseUrl, [KEYS.instance]: instance, [KEYS.enabled]: String(input.enabled) }
  if (input.apiKey?.trim()) values[KEYS.apiKey] = encryptAdmissionText(input.apiKey.trim())!
  await prisma.$transaction(Object.entries(values).map(([key, value]) => prisma.systemSettings.upsert({ where: { key }, create: { key, value }, update: { value } })))
}

async function request(path: string, init?: RequestInit) {
  const config = await getEvolutionConfig()
  if (!config) throw new Error('Evolution API não configurada.')
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: { apikey: config.apiKey, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : `Evolution API respondeu ${response.status}.`)
  return data
}

export async function getEvolutionConnection() {
  const config = await getEvolutionConfig()
  if (!config) return { configured: false, enabled: false, connected: false, state: 'not_configured' }
  try {
    const data = await request(`/instance/connectionState/${encodeURIComponent(config.instance)}`)
    const state = String(data?.instance?.state || data?.state || 'unknown')
    return { configured: true, enabled: config.enabled, connected: state === 'open' || state === 'connected', state }
  } catch (error) {
    return { configured: true, enabled: config.enabled, connected: false, state: 'unavailable', error: error instanceof Error ? error.message : 'Indisponível' }
  }
}

export async function getEvolutionQrCode() {
  const config = await getEvolutionConfig()
  if (!config) throw new Error('Evolution API não configurada.')
  const data = await request(`/instance/connect/${encodeURIComponent(config.instance)}`)
  const raw = data?.base64 || data?.qrcode?.base64 || data?.code || data?.qrcode?.code
  if (!raw || typeof raw !== 'string') throw new Error('A Evolution API não retornou um QR Code.')
  const qrCode = raw.startsWith('data:image/') ? raw : raw.startsWith('iVBOR') ? `data:image/png;base64,${raw}` : await QRCode.toDataURL(raw, { width: 320, margin: 2 })
  return { qrCode, pairingCode: data?.pairingCode || data?.qrcode?.pairingCode || null }
}

export async function sendEvolutionText(phone: string, text: string) {
  const config = await getEvolutionConfig()
  if (!config?.enabled) throw new Error('Notificações por WhatsApp desativadas.')
  const data = await request(`/message/sendText/${encodeURIComponent(config.instance)}`, {
    method: 'POST', body: JSON.stringify({ number: normalizeWhatsAppNumber(phone), text }),
  })
  return { messageId: String(data?.key?.id || data?.messageId || 'sent') }
}
