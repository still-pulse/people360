import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-zip-compressed',
]

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Nenhum arquivo.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Arquivo muito grande. Limite: 10 MB.' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 400 })
  }

  const ext  = path.extname(file.name).toLowerCase()
  const base = path.basename(file.name, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50)
  const fileName = `${Date.now()}-${base}${ext}`

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chamados')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()))

  return NextResponse.json({
    url:     `/api/uploads/chamados/${fileName}`,
    nome:    file.name,
    tamanho: file.size,
    tipo:    file.type || `application/${ext.slice(1)}`,
  })
}
