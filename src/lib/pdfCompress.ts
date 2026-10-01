import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export type CompressResult = { buffer: Buffer; originalBytes: number; compressedBytes: number; compressed: boolean }

const GS_TIMEOUT_MS = 120_000
let gsAvailable: boolean | null = null

function run(file: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile(file, args, { timeout: GS_TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (error) => (error ? reject(error) : resolve()))
  })
}

/**
 * Recomprime um PDF com Ghostscript (perfil /ebook: imagens a 150 dpi, legível para leitura e impressão).
 * Só devolve a versão comprimida se ela for menor; sem Ghostscript ou em caso de erro, devolve o original.
 */
export async function compressPdf(input: Buffer): Promise<CompressResult> {
  const original = { buffer: input, originalBytes: input.length, compressedBytes: input.length, compressed: false }
  if (gsAvailable === false || input.length < 200 * 1024) return original
  const dir = await mkdtemp(path.join(tmpdir(), 'pdfc-'))
  try {
    const source = path.join(dir, 'in.pdf'), target = path.join(dir, 'out.pdf')
    await writeFile(source, input)
    await run('gs', [
      '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dPDFSETTINGS=/ebook', '-dDetectDuplicateImages=true',
      '-dColorImageResolution=150', '-dGrayImageResolution=150', '-dMonoImageResolution=300',
      '-dNOPAUSE', '-dQUIET', '-dBATCH', '-dSAFER', `-sOutputFile=${target}`, source,
    ])
    gsAvailable = true
    const output = await readFile(target)
    if (output.length < 5 || output.subarray(0, 5).toString() !== '%PDF-' || output.length >= input.length) return original
    return { buffer: output, originalBytes: input.length, compressedBytes: output.length, compressed: true }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') gsAvailable = false
    else console.error('[pdf-compress] Falha ao comprimir; usando o original:', error instanceof Error ? error.message : error)
    return original
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Regrava com Ghostscript um PDF protegido por senha de proprietário (ex.: CTPS Digital do gov.br).
 * O pdf-lib abre esses arquivos ignorando a proteção, mas copia o conteúdo ainda cifrado: as páginas saem em branco.
 * Devolve null se o Ghostscript não estiver disponível ou não conseguir abrir o arquivo.
 */
export async function decryptPdf(input: Buffer): Promise<Buffer | null> {
  if (gsAvailable === false) return null
  const dir = await mkdtemp(path.join(tmpdir(), 'pdfd-'))
  try {
    const source = path.join(dir, 'in.pdf'), target = path.join(dir, 'out.pdf')
    await writeFile(source, input)
    await run('gs', ['-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dNOPAUSE', '-dQUIET', '-dBATCH', '-dSAFER', `-sOutputFile=${target}`, source])
    gsAvailable = true
    const output = await readFile(target)
    return output.length > 5 && output.subarray(0, 5).toString() === '%PDF-' ? output : null
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') gsAvailable = false
    else console.error('[pdf-decrypt] Falha ao remover a proteção do PDF:', error instanceof Error ? error.message : error)
    return null
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
