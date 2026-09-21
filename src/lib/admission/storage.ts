import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { randomBytes } from 'crypto'
import path from 'path'

const ROOT = path.resolve(process.env.ADMISSION_STORAGE_PATH || path.join(process.cwd(), 'storage', 'admissions'))
export const ADMISSION_FILE_MAX_SIZE = Number(process.env.ADMISSION_MAX_FILE_SIZE || 15 * 1024 * 1024)

const signatures: { mime: string; ext: string; check: (b: Buffer) => boolean }[] = [
  { mime: 'application/pdf', ext: '.pdf', check: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  { mime: 'image/jpeg', ext: '.jpg', check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: '.png', check: (b) => b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
]

export function detectMime(buffer: Buffer) {
  return signatures.find((item) => item.check(buffer)) ?? null
}

export async function savePrivateAdmissionFile(admissionId: string, category: string, file: File) {
  if (file.size <= 0 || file.size > ADMISSION_FILE_MAX_SIZE) throw new Error('Tamanho de arquivo inválido.')
  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = detectMime(buffer)
  if (!detected) throw new Error('Formato real do arquivo inválido. Envie PDF, JPG ou PNG.')
  const safeAdmission = admissionId.replace(/[^a-zA-Z0-9_-]/g, '')
  const safeCategory = category.replace(/[^a-zA-Z0-9_-]/g, '')
  const name = `${Date.now()}-${randomBytes(12).toString('hex')}${detected.ext}`
  const dir = path.resolve(ROOT, safeAdmission, safeCategory)
  if (!dir.startsWith(ROOT + path.sep)) throw new Error('Caminho inválido.')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, name), buffer)
  return { storagePath: path.posix.join(safeAdmission, safeCategory, name), mimeType: detected.mime, sizeBytes: buffer.length }
}

export async function readPrivateAdmissionFile(storagePath: string) {
  const resolved = path.resolve(ROOT, storagePath)
  if (!resolved.startsWith(ROOT + path.sep)) return null
  try { return await readFile(resolved) } catch { return null }
}

export async function deletePrivateAdmissionFile(storagePath: string) {
  const resolved = path.resolve(ROOT, storagePath)
  if (!resolved.startsWith(ROOT + path.sep)) return false
  try { await unlink(resolved); return true } catch { return false }
}
