import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir, readdir, readFile, appendFile, rm } from 'fs/promises'
import path from 'path'

const MAX_SIZE = 200 * 1024 * 1024
const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
]
const UPLOAD_ID_RE = /^[a-zA-Z0-9-]{1,64}$/

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'JURIDICO') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const chunk = formData.get('chunk') as File | null
  const uploadId = formData.get('uploadId') as string | null
  const chunkIndex = Number(formData.get('chunkIndex'))
  const totalChunks = Number(formData.get('totalChunks'))
  const fileName = formData.get('fileName') as string | null
  const fileType = formData.get('fileType') as string | null
  const fileSize = Number(formData.get('fileSize'))

  if (
    !chunk || !uploadId || !fileName ||
    !Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) ||
    chunkIndex < 0 || chunkIndex >= totalChunks
  ) {
    return NextResponse.json({ error: 'Requisição de upload inválida.' }, { status: 400 })
  }
  if (!UPLOAD_ID_RE.test(uploadId)) {
    return NextResponse.json({ error: 'ID de upload inválido.' }, { status: 400 })
  }
  if (!fileSize || fileSize > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Limite: 200 MB.' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(fileType ?? '')) {
    return NextResponse.json({ error: 'Tipo não permitido. Use imagens, PDF ou vídeos (MP4, MOV, WebM).' }, { status: 400 })
  }

  const tmpDir = path.join(process.cwd(), 'public', 'uploads', 'pcd-evidencias', '.tmp', uploadId)
  await mkdir(tmpDir, { recursive: true })
  await writeFile(path.join(tmpDir, `${chunkIndex}.part`), Buffer.from(await chunk.arrayBuffer()))

  if (chunkIndex < totalChunks - 1) {
    return NextResponse.json({ done: false })
  }

  const parts = await readdir(tmpDir)
  if (parts.length !== totalChunks) {
    return NextResponse.json({ error: 'Upload incompleto. Tente novamente.' }, { status: 400 })
  }

  const ext  = path.extname(fileName).toLowerCase()
  const base = path.basename(fileName, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50)
  const finalName = `${Date.now()}-${base}${ext}`
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'pcd-evidencias')
  const finalPath = path.join(uploadDir, finalName)

  for (let i = 0; i < totalChunks; i++) {
    const data = await readFile(path.join(tmpDir, `${i}.part`))
    await appendFile(finalPath, data)
  }
  await rm(tmpDir, { recursive: true, force: true })

  return NextResponse.json({
    done:    true,
    url:     `/api/uploads/pcd-evidencias/${finalName}`,
    nome:    fileName,
    tamanho: fileSize,
    tipo:    fileType || `application/${ext.slice(1)}`,
  })
}
