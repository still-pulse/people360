import { describe, expect, it } from 'vitest'
import { readFile } from 'fs/promises'
import JSZip from 'jszip'
import { createEmployeeArchive, safeArchiveName } from './documentArchive'
import type { HistoryFile } from './documentHistory'

function file(id: string, read: HistoryFile['read'] = async () => Buffer.from(id)): HistoryFile {
  return { id, title: 'RG', origin: 'Atualização cadastral', protocol: 'AT-1', status: 'APPROVED', version: 1, previous: false,
    date: '2026-09-23T12:00:00Z', fileName: '../RG.pdf', mimeType: 'application/pdf', sizeBytes: 4, read }
}

describe('arquivo ZIP do colaborador', () => {
  it('preserva todos os arquivos com nomes repetidos dentro da pasta do colaborador, sem traversal', async () => {
    const archive = await createEmployeeArchive('José da Silva', [file('primeiro'), file('segundo')])
    try {
      const zip = await JSZip.loadAsync(await readFile(archive.target))
      const entries = Object.values(zip.files).filter(entry => !entry.dir)
      expect(entries).toHaveLength(2)
      expect(entries.every(entry => entry.name.startsWith('José da Silva/Atualização cadastral - AT-1/'))).toBe(true)
      expect(entries.every(entry => !entry.name.includes('../'))).toBe(true)
      expect(await Promise.all(entries.map(entry => entry.async('string')))).toEqual(['primeiro', 'segundo'])
    } finally { await archive.cleanup() }
  })
  it('falha em vez de entregar silenciosamente um ZIP sem um dos arquivos', async () => {
    await expect(createEmployeeArchive('Pessoa', [file('ok'), file('ausente', async () => null)])).rejects.toThrow('Arquivo indisponível')
  })
  it('remove separadores e caracteres de controle dos nomes', () => {
    expect(safeArchiveName('../../a\\b\n')).not.toMatch(/[/\\\n]|\.\./)
    expect(safeArchiveName('   ', 'Colaborador')).toBe('Colaborador')
  })
})
