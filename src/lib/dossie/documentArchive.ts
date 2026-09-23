import JSZip from 'jszip'
import { createReadStream, createWriteStream } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { HistoryFile } from './documentHistory'

export function safeArchiveName(value: string, fallback = 'documento'): string {
  return value.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_').replace(/\.{2,}/g, '_').trim().replace(/[. ]+$/g, '').slice(0, 120) || fallback
}

/** Keeps at most one source file in memory. The completed archive lives in private temporary storage. */
export async function createEmployeeArchive(name: string, files: HistoryFile[]) {
  const folder = safeArchiveName(name, 'Colaborador')
  const directory = await mkdtemp(path.join(tmpdir(), 'employee-documents-'))
  const target = path.join(directory, 'documentos.zip')
  const cleanup = () => rm(directory, { recursive: true, force: true })
  try {
    const zip = new JSZip()
    for (const [index, file] of files.entries()) {
      const group = safeArchiveName(file.protocol ? `${file.origin} - ${file.protocol}` : file.origin)
      const filename = `${String(index + 1).padStart(4, '0')}_v${file.version}_${safeArchiveName(file.fileName)}`
      zip.file(`${folder}/${group}/${filename}`, Readable.from((async function* () {
        const bytes = await file.read()
        if (!bytes) throw new Error(`Arquivo indisponível: ${file.title}. Nenhum ZIP parcial foi entregue.`)
        yield bytes
      })()))
    }
    await pipeline(zip.generateNodeStream({ streamFiles: true, compression: 'STORE' }), createWriteStream(target, { mode: 0o600 }))
    return { fileName: `${folder}.zip`, target, cleanup }
  } catch (error) { await cleanup(); throw error }
}

export function archiveResponseBody(archive: Awaited<ReturnType<typeof createEmployeeArchive>>) {
  const file = createReadStream(archive.target)
  file.once('close', () => { void archive.cleanup() })
  return Readable.toWeb(file) as ReadableStream<Uint8Array>
}
