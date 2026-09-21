import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto'

export function generateAdmissionToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token), hint: token.slice(-4) }
}

export function hashToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function safeHashEquals(raw: string, expectedHash: string) {
  const actual = Buffer.from(hashToken(raw))
  const expected = Buffer.from(expectedHash)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function hashSensitive(value: string) {
  const pepper = currentSecret()
  return createHash('sha256').update(`${pepper}:${value.replace(/\D/g, '')}`).digest('hex')
}

function currentSecret() {
  const secret = process.env.ADMISSION_DATA_PEPPER || process.env.NEXTAUTH_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') throw new Error('ADMISSION_DATA_PEPPER não configurado.')
  return 'local-development-only'
}

function keyFromSecret(secret: string) {
  return createHash('sha256').update(secret).digest()
}

function keyring() {
  const currentId = process.env.ADMISSION_DATA_KEY_ID || 'current'
  const keys = new Map<string, Buffer>([[currentId, keyFromSecret(currentSecret())]])
  try {
    const previous = JSON.parse(process.env.ADMISSION_DATA_PREVIOUS_KEYS || '{}') as Record<string, string>
    for (const [id, secret] of Object.entries(previous)) if (id && secret) keys.set(id, keyFromSecret(secret))
  } catch {
    throw new Error('ADMISSION_DATA_PREVIOUS_KEYS deve ser um objeto JSON válido.')
  }
  return { currentId, keys }
}

export function encryptAdmissionValue(value: unknown) {
  const { currentId, keys } = keyring()
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', keys.get(currentId)!, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return { v: 2, kid: currentId, alg: 'A256GCM', iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), data: encrypted.toString('base64url') }
}

export function decryptAdmissionValue(value: unknown) {
  if (!value || typeof value !== 'object' || !('data' in value) || !('iv' in value) || !('tag' in value)) return value
  const input = value as { data: string; iv: string; tag: string; kid?: string }
  try {
    const { currentId, keys } = keyring()
    const candidates = input.kid ? [keys.get(input.kid)] : [keys.get(currentId), ...Array.from(keys.values())]
    for (const key of candidates) {
      if (!key) continue
      try {
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(input.iv, 'base64url'))
        decipher.setAuthTag(Buffer.from(input.tag, 'base64url'))
        return JSON.parse(Buffer.concat([decipher.update(Buffer.from(input.data, 'base64url')), decipher.final()]).toString('utf8'))
      } catch { /* tenta a próxima chave durante rotação */ }
    }
    return null
  } catch { return null }
}

const TEXT_ENVELOPE_PREFIX = 'p360enc:'

export function encryptAdmissionText(value?: string | null): string | null {
  if (value == null) return null
  return `${TEXT_ENVELOPE_PREFIX}${Buffer.from(JSON.stringify(encryptAdmissionValue(value))).toString('base64url')}`
}

export function decryptAdmissionText(value?: string | null): string | null {
  if (value == null || !value.startsWith(TEXT_ENVELOPE_PREFIX)) return value ?? null
  try {
    const envelope = JSON.parse(Buffer.from(value.slice(TEXT_ENVELOPE_PREFIX.length), 'base64url').toString('utf8'))
    const decrypted = decryptAdmissionValue(envelope)
    return typeof decrypted === 'string' ? decrypted : null
  } catch { return null }
}

export function maskCpf(value?: string | null) {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length === 11 ? `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**` : '***.***.***-**'
}

export function isValidCpf(value: string) {
  const cpf = value.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  const digit = (base: number) => {
    let sum = 0
    for (let i = 0; i < base - 1; i++) sum += Number(cpf[i]) * (base - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return digit(10) === Number(cpf[9]) && digit(11) === Number(cpf[10])
}

export function makeProtocol() {
  return `ADM-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
}

export function sanitizeAuditMetadata(input: Record<string, unknown> = {}) {
  const blocked = /token|cpf|rg|pis|bank|agencia|conta|biometr|document.*content/i
  return Object.fromEntries(Object.entries(input).filter(([key]) => !blocked.test(key)))
}
