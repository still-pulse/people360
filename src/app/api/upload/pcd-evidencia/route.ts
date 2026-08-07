import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const MAX_SIZE = 200 * 1024 * 1024
const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
]

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'JURIDICO') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Nenhum arquivo.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Arquivo muito grande. Limite: 200 MB.' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo não permitido. Use imagens, PDF ou vídeos (MP4, MOV, WebM).' }, { status: 400 })
  }

  const ext  = path.extname(file.name).toLowerCase()
  const base = path.basename(file.name, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50)
  const fileName = `${Date.now()}-${base}${ext}`

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'pcd-evidencias')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()))

  return NextResponse.json({
    url:     `/api/uploads/pcd-evidencias/${fileName}`,
    nome:    file.name,
    tamanho: file.size,
    tipo:    file.type || `application/${ext.slice(1)}`,
  })
}
