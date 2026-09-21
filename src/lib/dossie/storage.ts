import { mkdir, readFile, writeFile } from 'fs/promises'
import { randomBytes } from 'crypto'
import path from 'path'
import { detectMime } from '@/lib/admission/storage'

// Arquivos do dossiê ficam FORA de public/ (volume de storage) e só saem por rotas autenticadas.
const ROOT = path.resolve(process.env.COLABORADOR_STORAGE_PATH || path.join(process.cwd(), 'storage', 'colaboradores'))
export const DOSSIE_FILE_MAX_SIZE = Number(process.env.COLABORADOR_MAX_FILE_SIZE || 15 * 1024 * 1024)

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '')
}

function resolveInside(...segments: string[]) {
  const resolved = path.resolve(ROOT, ...segments)
  return resolved.startsWith(ROOT + path.sep) ? resolved : null
}

/** Valida o formato REAL pelos magic bytes (não confia em extensão nem em Content-Type). */
export function detectDossieMime(buffer: Buffer) {
  const detected = detectMime(buffer)
  return detected && ['application/pdf', 'image/jpeg', 'image/png'].includes(detected.mime) ? detected : null
}

export async function saveDossieFile(colaboradorId: string, category: string, buffer: Buffer) {
  if (!buffer.length || buffer.length > DOSSIE_FILE_MAX_SIZE) throw new Error('Tamanho de arquivo inválido.')
  const detected = detectDossieMime(buffer)
  if (!detected) throw new Error('Formato inválido. Envie PDF, JPG ou PNG.')
  const dir = resolveInside(safeSegment(colaboradorId), safeSegment(category) || 'geral')
  if (!dir) throw new Error('Caminho inválido.')
  await mkdir(dir, { recursive: true })
  const name = `${Date.now()}-${randomBytes(12).toString('hex')}${detected.ext}`
  await writeFile(path.join(dir, name), buffer)
  return {
    storagePath: path.posix.join(safeSegment(colaboradorId), safeSegment(category) || 'geral', name),
    mimeType: detected.mime, sizeBytes: buffer.length,
  }
}

export async function readDossieFile(storagePath: string) {
  const resolved = resolveInside(storagePath)
  if (!resolved) return null
  try { return await readFile(resolved) } catch { return null }
}
