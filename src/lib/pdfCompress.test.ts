import { describe, expect, it } from 'vitest'
import { compressPdf } from './pdfCompress'

describe('compressPdf', () => {
  it('devolve o original quando o arquivo é pequeno (não vale a compressão)', async () => {
    const input = Buffer.from('%PDF-1.4 arquivo pequeno')
    const result = await compressPdf(input)
    expect(result.compressed).toBe(false)
    expect(result.buffer).toBe(input)
  })
  it('nunca falha: sem Ghostscript ou com PDF inválido, devolve o original', async () => {
    const input = Buffer.alloc(300 * 1024, 1)
    const result = await compressPdf(input)
    expect(result.buffer.length).toBe(input.length)
    expect(result.compressed).toBe(false)
  })
})
