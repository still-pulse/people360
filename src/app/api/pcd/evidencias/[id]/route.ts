import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'JURIDICO') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { year, month, unitId, descricao, nomePCD, novosArquivos } = body

  const evidencia = await prisma.pcdEvidencia.update({
    where: { id: params.id },
    data: {
      ...(year      !== undefined && { year: parseInt(year) }),
      ...(month     !== undefined && { month: parseInt(month) }),
      ...(unitId    !== undefined && { unitId: unitId || null }),
      ...(descricao !== undefined && { descricao: descricao || null }),
      ...(nomePCD   !== undefined && { nomePCD: nomePCD || null }),
      ...(novosArquivos?.length && {
        arquivos: {
          create: novosArquivos.map((a: { url: string; nome: string; tamanho: number; tipo: string; tipoDoc?: string }) => ({
            url: a.url,
            nome: a.nome,
            tamanho: a.tamanho,
            tipo: a.tipo,
            tipoDoc: a.tipoDoc || null,
          })),
        },
      }),
    },
    include: {
      arquivos: { orderBy: { createdAt: 'asc' } },
      unit: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  })

  return NextResponse.json(evidencia)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'JURIDICO') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const evidencia = await prisma.pcdEvidencia.findUnique({
    where: { id: params.id },
    include: { arquivos: true },
  })
  if (!evidencia) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  for (const arq of evidencia.arquivos) {
    const rel = arq.url.replace(/^\/api\/uploads\//, '')
    const abs = path.join(process.cwd(), 'public', 'uploads', rel)
    await unlink(abs).catch(() => null)
  }

  await prisma.pcdEvidencia.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
