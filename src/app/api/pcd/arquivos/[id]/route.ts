import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'JURIDICO') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const arq = await prisma.pcdArquivo.findUnique({ where: { id: params.id } })
  if (!arq) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const rel = arq.url.replace(/^\/api\/uploads\//, '')
  const abs = path.join(process.cwd(), 'public', 'uploads', rel)
  await unlink(abs).catch(() => null)

  await prisma.pcdArquivo.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
