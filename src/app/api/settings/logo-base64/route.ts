import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await prisma.systemSettings.findUnique({ where: { key: 'logoFileName' } })
  if (!row?.value) return NextResponse.json({ base64: null })

  const filePath = path.join(process.cwd(), 'public', 'uploads', 'logos', row.value)
  if (!existsSync(filePath)) return NextResponse.json({ base64: null })

  const buffer = await readFile(filePath)
  const ext = path.extname(row.value).slice(1).toLowerCase()
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
  const base64 = `data:${mime};base64,${buffer.toString('base64')}`

  return NextResponse.json({ base64, fileName: row.value })
}
