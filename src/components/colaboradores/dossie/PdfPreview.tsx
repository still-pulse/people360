'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { errorMessage, saveBlob } from './api'
import type { PdfLoader } from './context'
import { Notice } from './parts'

export type PreviewRequest = { title: string; loader: PdfLoader; actions?: { label: string; onClick: () => void }[] } | null

/** Pré-visualização do PDF real (nunca um print da tela) dentro do modal padrão. */
export function PdfPreview({ request, onClose }: { request: PreviewRequest; onClose: () => void }) {
  const [state, setState] = useState<{ url: string; blob: Blob; fileName: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!request) return
    let alive = true
    let objectUrl = ''
    setState(null); setError('')
    request.loader()
      .then(({ blob, fileName }) => { if (!alive) return; objectUrl = URL.createObjectURL(blob); setState({ url: objectUrl, blob, fileName }) })
      .catch((e) => alive && setError(errorMessage(e)))
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [request])

  return (
    <Modal open={!!request} onClose={onClose} title={request?.title ?? 'Visualizar documento'} size="xl">
      <div className="p-4 space-y-3">
        {error ? <Notice tone="danger">{error}</Notice> : !state ? (
          <div className="h-[70vh] flex flex-col items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="w-5 h-5 animate-spin text-[#15AFA4]" />Gerando pré-visualização…</div>
        ) : (
          <iframe title="Pré-visualização do PDF" src={`${state.url}#toolbar=1&navpanes=0`} className="w-full h-[70vh] rounded-xl border border-gray-200 bg-gray-50" />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Voltar</Button>
          {state && <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />} onClick={() => saveBlob(state.blob, state.fileName)}>Baixar</Button>}
          {request?.actions?.map((action) => <Button key={action.label} size="sm" onClick={() => { onClose(); action.onClick() }}>{action.label}</Button>)}
        </div>
      </div>
    </Modal>
  )
}
