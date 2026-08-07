import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

const MAX_SIZE = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.webp']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('avatar') as File | null

  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Arquivo muito grande. Limite: 2 MB.' }, { status: 400 })

  const ext = path.extname(file.name).toLowerCase()
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: 'Formato inválido. Use PNG, JPG ou WEBP.' }, { status: 400 })
  }

  // Remove avatar anterior
  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  })
  if (current?.avatarUrl) {
    // avatarUrl é /api/uploads/avatars/xxx → deriva path no disco
    const relativePath = current.avatarUrl.replace(/^\/api\/uploads\//, 'uploads/')
    const oldPath = path.join(process.cwd(), 'public', relativePath)
    if (existsSync(oldPath)) await unlink(oldPath).catch(() => {})
  }

  const fileName = `avatar-${session.user.id}-${Date.now()}${ext}`
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()))

  const avatarUrl = `/api/uploads/avatars/${fileName}`
  await prisma.user.update({ where: { id: session.user.id }, data: { avatarUrl } })

  return NextResponse.json({ avatarUrl })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  })
  if (user?.avatarUrl) {
    const filePath = path.join(process.cwd(), 'public', user.avatarUrl)
    if (existsSync(filePath)) await unlink(filePath).catch(() => {})
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { avatarUrl: null } })
  return NextResponse.json({ success: true })
}
