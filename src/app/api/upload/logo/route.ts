import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'

const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.svg']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('logo') as File | null

  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Arquivo muito grande. Limite: 2 MB.' }, { status: 400 })

  const ext = path.extname(file.name).toLowerCase()
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: 'Formato inválido. Use PNG, JPG, WEBP ou SVG.' }, { status: 400 })
  }

  // Remove logo anterior se existir
  const current = await prisma.systemSettings.findUnique({ where: { key: 'logoFileName' } })
  if (current?.value) {
    const oldPath = path.join(process.cwd(), 'public', 'uploads', 'logos', current.value)
    if (existsSync(oldPath)) await unlink(oldPath).catch(() => {})
  }

  const fileName = `logo-${Date.now()}${ext}`
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()))

  const url = `/api/uploads/logos/${fileName}`

  // Persiste no banco
  await prisma.systemSettings.upsert({
    where: { key: 'logoUrl' },
    update: { value: url },
    create: { key: 'logoUrl', value: url },
  })
  await prisma.systemSettings.upsert({
    where: { key: 'logoFileName' },
    update: { value: fileName },
    create: { key: 'logoFileName', value: fileName },
  })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'UPLOAD', entity: 'Logo', entityName: fileName,
    details: { tamanho: `${(file.size / 1024).toFixed(0)} KB`, tipo: file.type },
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ url, fileName })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const current = await prisma.systemSettings.findUnique({ where: { key: 'logoFileName' } })
  if (current?.value) {
    const oldPath = path.join(process.cwd(), 'public', 'uploads', 'logos', current.value)
    if (existsSync(oldPath)) await unlink(oldPath).catch(() => {})
  }

  await prisma.systemSettings.deleteMany({ where: { key: { in: ['logoUrl', 'logoFileName'] } } })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'REMOVE', entity: 'Logo', entityName: 'Logo da empresa',
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ success: true })
}
