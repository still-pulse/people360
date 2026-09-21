import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const comment = await prisma.taskComment.create({
    data: {
      taskId: params.id,
      userId: session.user.id,
      content: body.content,
    },
    include: { user: { select: { id: true, name: true } } },
  })

  return NextResponse.json(comment, { status: 201 })
}
