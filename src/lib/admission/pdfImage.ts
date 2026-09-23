import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

export async function renderPdfFirstPageAsJpeg(pdf: Buffer) {
  const directory = await mkdtemp(join(tmpdir(), 'people360-face-'))
  const input = join(directory, 'documento.pdf')
  const outputPrefix = join(directory, 'pagina')
  try {
    await writeFile(input, pdf)
    await run('pdftoppm', ['-f', '1', '-l', '1', '-singlefile', '-jpeg', '-jpegopt', 'quality=92', '-r', '200', input, outputPrefix], {
      timeout: 20_000,
      maxBuffer: 1024 * 1024,
    })
    const image = await readFile(`${outputPrefix}.jpg`)
    if (!image.length) throw new Error('PDF_RENDER_EMPTY')
    return image
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {})
  }
}
