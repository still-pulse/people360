import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { downloadDossierBatch } from './downloadDossierBatch'

describe('download de dossiês em requisições separadas', () => {
  it('gera um ZIP final, continua após timeout e respeita os IDs selecionados', async () => {
    const items = [1, 2, 3, 4].map(n => ({ id: String(n), protocol: `ADM-${n}`, candidateName: 'Homônimo' }))
    const request = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (!init) return Response.json({ items })
      const body = JSON.parse(String(init.body))
      expect(body.ids).toHaveLength(1)
      expect(body.dependentCorrection).toBe(true)
      const id = body.ids[0]
      if (id === '2') return new Response('proxy timeout', { status: 524 })
      const zip = new JSZip()
      zip.file(`Homônimo - ADM-${id}/dossie.pdf`, `PDF-${id}`)
      zip.file('relatorio.csv', `\uFEFFColaborador;Protocolo;Status;Detalhes\r\nHomônimo;ADM-${id};GERADO;OK`)
      return new Response(new Uint8Array(await zip.generateAsync({ type: 'uint8array' })), { headers: { 'x-dossiers-generated': '1' } })
    })
    const progress = vi.fn()
    const result = await downloadDossierBatch({ dependentCorrection: true, ids: ['1', '2', '3'], onProgress: progress }, request as typeof fetch)
    expect(request).toHaveBeenCalledTimes(4)
    expect(result.generated).toBe(2)
    expect(result.failed).toBe(1)
    const final = await JSZip.loadAsync(result.bytes)
    expect(await final.file('Homônimo - ADM-1/dossie.pdf')!.async('string')).toBe('PDF-1')
    expect(await final.file('Homônimo - ADM-3/dossie.pdf')!.async('string')).toBe('PDF-3')
    const report = await final.file('relatorio.csv')!.async('string')
    expect(report).toContain('HTTP 524')
    expect(report).toContain('ADM-1;GERADO')
    expect(report).toContain('ADM-3;GERADO')
    expect(progress).toHaveBeenLastCalledWith(3, 3, '')
  })
})
