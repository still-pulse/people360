export class ApiError extends Error {
  details: string[]
  status: number
  constructor(message: string, details: string[] = [], status = 0) {
    super(message)
    this.details = details
    this.status = status
  }
}

async function failure(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({} as { error?: string; details?: string[] }))
  return new ApiError(body.error || 'Não foi possível concluir a operação.', body.details || [], res.status)
}

export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) throw await failure(res)
  return res.json() as Promise<T>
}

function fileNameFrom(res: Response, fallback: string) {
  const match = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') || '')
  return match ? match[1] : fallback
}

/** Busca um PDF (GET ou POST com corpo JSON) e devolve o blob + nome sugerido. */
export async function fetchPdf(url: string, body?: unknown, fallbackName = 'documento.pdf') {
  const res = await fetch(url, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) throw await failure(res)
  return { blob: await res.blob(), fileName: fileNameFrom(res, fallbackName) }
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.details.length ? error.details.join(' ') : error.message
  return error instanceof Error ? error.message : 'Erro inesperado.'
}
