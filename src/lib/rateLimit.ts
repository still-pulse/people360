interface Entry {
  count: number
  resetAt: number
  blocked: boolean
}

const store = new Map<string, Entry>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000  // 15 minutos
const BLOCK_MS   = 15 * 60 * 1000  // bloqueia por 15 minutos após esgotar tentativas

// Limpa entradas expiradas a cada 10 min para não vazar memória
setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key)
  })
}, 10 * 60 * 1000)

export function checkLoginRateLimit(key: string): {
  allowed: boolean
  remaining: number
  retryAfterMs?: number
} {
  const now = Date.now()
  let entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS, blocked: false }
    store.set(key, entry)
  }

  if (entry.blocked) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now }
  }

  entry.count++

  if (entry.count > MAX_ATTEMPTS) {
    entry.blocked = true
    entry.resetAt = now + BLOCK_MS
    return { allowed: false, remaining: 0, retryAfterMs: BLOCK_MS }
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count }
}

export function resetLoginRateLimit(key: string) {
  store.delete(key)
}

// ─── Rate limit do portal público de documentos do candidato ────────────────
// Sem sessão — protege contra abuso/força-bruta no link (o token já é
// inviável de adivinhar, mas isso limita impacto de scraping/uploads em massa).

const publicDocStore = new Map<string, Entry>()
const DOC_MAX_ATTEMPTS = 60
const DOC_WINDOW_MS = 15 * 60 * 1000  // 15 minutos
const DOC_BLOCK_MS   = 15 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  publicDocStore.forEach((entry, key) => {
    if (now > entry.resetAt) publicDocStore.delete(key)
  })
}, 10 * 60 * 1000)

export function checkPublicDocLinkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now()
  let entry = publicDocStore.get(key)

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + DOC_WINDOW_MS, blocked: false }
    publicDocStore.set(key, entry)
  }

  if (entry.blocked) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++

  if (entry.count > DOC_MAX_ATTEMPTS) {
    entry.blocked = true
    entry.resetAt = now + DOC_BLOCK_MS
    return { allowed: false, retryAfterMs: DOC_BLOCK_MS }
  }

  return { allowed: true }
}
