import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ALLOWED_EXT = ['.pdf', '.doc', '.docx']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('cv') as File | null

  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Arquivo muito grande. Limite: 10 MB.' }, { status: 400 })

  const ext = path.extname(file.name).toLowerCase()
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: 'Formato inválido. Use PDF, DOC ou DOCX.' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const fileName = `${Date.now()}-${safeName}`
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'cvs')

  await mkdir(uploadDir, { recursive: true })

  const bytes = await file.arrayBuffer()
  await writeFile(path.join(uploadDir, fileName), Buffer.from(bytes))

  return NextResponse.json({
    fileName,
    originalName: file.name,
    url: `/uploads/cvs/${fileName}`,
    size: file.size,
  })
}
