const BASE = process.env.BHCL_TRAINING_API_URL?.replace(/\/$/, '')
const KEY  = process.env.BHCL_TRAINING_API_KEY

export const trainingApiConfigured = () => !!(BASE && KEY)

async function apiFetch(path: string, params: Record<string, string | number | undefined>) {
  if (!trainingApiConfigured()) return null
  const url = new URL(`${BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) url.searchParams.set(k, String(v)) })
  try {
    const res = await fetch(url.toString(), { headers: { 'x-api-key': KEY! }, cache: 'no-store', redirect: 'follow' })
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

export function fetchTrainingSummary(ano: number, mes?: number, unidadeId?: string) {
  return apiFetch('/api/v1/treinamentos', { ano, mes, unidadeId })
}

export function fetchTrainingHistorico(meses = 6, unidadeId?: string) {
  return apiFetch('/api/v1/treinamentos/historico', { meses, unidadeId })
}
