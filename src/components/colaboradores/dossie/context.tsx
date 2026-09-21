'use client'

import { createContext, useContext } from 'react'
import type { Catalog, Overview } from './types'

export type SectionId = 'visao' | 'cadastro' | 'contratos' | 'aditivos' | 'dependentes' | 'acordos' | 'experiencia' | 'avaliacoes' | 'historico' | 'documentos' | 'exportacoes'

export type PdfLoader = () => Promise<{ blob: Blob; fileName: string }>

export type DossieCtx = {
  id: string
  overview: Overview
  catalog: Catalog
  can: (permission: string) => boolean
  /** Recarrega cabeçalho/contadores/catálogo; `version` muda para que as listas recarreguem. */
  reload: () => Promise<void>
  version: number
  toast: (kind: 'success' | 'error', text: string) => void
  goTo: (section: SectionId) => void
  previewPdf: (title: string, loader: PdfLoader, actions?: { label: string; onClick: () => void }[]) => void
  downloadPdf: (loader: PdfLoader) => Promise<void>
  openNovoDocumento: (tipo?: string, draftId?: string) => void
  openAditivo: () => void
  openAvaliacao: (input: { tipo: 'GERENCIAL' | 'AUTOAVALIACAO'; dias?: number; id?: string }) => void
  openDependente: (id?: string) => void
  openExport: () => void
}

export const DossieContext = createContext<DossieCtx | null>(null)

export function useDossie() {
  const ctx = useContext(DossieContext)
  if (!ctx) throw new Error('useDossie fora do DossieTab')
  return ctx
}
