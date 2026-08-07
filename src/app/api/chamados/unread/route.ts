import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ count: 0 })

  const where: any = {
    lida: false,
    autorId: { not: session.user.id },
  }

  if (session.user.role === 'ANALYST') {
    // Chamados onde o analista é autor ou atribuído
    const meusChamados = await prisma.chamado.findMany({
      where: { OR: [{ autorId: session.user.id }, { atribuidoId: session.user.id }] },
      select: { id: true },
    })
    where.chamadoId = { in: meusChamados.map((c) => c.id) }
  }

  const count = await prisma.chamadoMensagem.count({ where })
  return NextResponse.json({ count })
}
