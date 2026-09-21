'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from './api'

/** Carrega uma lista/objeto sob demanda e recarrega quando `version` (ou a URL) muda. */
export function useResource<T>(url: string | null, version = 0) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!!url)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!url) return
    setLoading(true); setError('')
    try { setData(await api<T>(url)) } catch (e) { setError(errorMessage(e)) } finally { setLoading(false) }
  }, [url])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load, version])
  return { data, loading, error, reload: load }
}
