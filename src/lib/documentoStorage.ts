import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Armazenamento de documentos de candidato — FORA de `public/`, nunca servido
// estaticamente. Só deve ser lido através das rotas autenticadas/com token que
// validam a posse do arquivo antes de abrir o buffer (ver /api/documentos-candidato
// e /api/admin/documentos-candidato).
const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'documentos-candidatos')

export const DOCUMENTO_MAX_SIZE = 15 * 1024 * 1024 // 15 MB

export const DOCUMENTO_ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

interface SavedFile {
  nomeArmazenado: string
  tamanho: number
  tipo: string
}

/** Salva o arquivo em storage/documentos-candidatos/<linkId>/<itemId>/<timestamp>-<slug>.<ext>. */
export async function saveDocumentoArquivo(
  linkId: string,
  itemId: string,
  file: File
): Promise<SavedFile> {
  const ext = DOCUMENTO_ALLOWED_TYPES[file.type] ?? path.extname(file.name).toLowerCase()
  const base = path
    .basename(file.name, path.extname(file.name))
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 50)
  const fileName = `${Date.now()}-${base}${ext}`

  const dir = path.join(STORAGE_ROOT, linkId, itemId)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()))

  return {
    nomeArmazenado: path.posix.join(linkId, itemId, fileName),
    tamanho: file.size,
    tipo: file.type || `application/${ext.replace('.', '')}`,
  }
}

/** Lê um arquivo pelo caminho relativo salvo em `nomeArmazenado`. Recusa qualquer path traversal. */
export async function readDocumentoArquivo(nomeArmazenado: string): Promise<Buffer | null> {
  const filePath = path.join(STORAGE_ROOT, nomeArmazenado)
  if (!filePath.startsWith(STORAGE_ROOT + path.sep) && filePath !== STORAGE_ROOT) return null
  if (!existsSync(filePath)) return null
  return readFile(filePath)
}
