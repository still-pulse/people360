import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; commentId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const comment = await prisma.taskComment.findUnique({ where: { id: params.commentId } })
  if (!comment || comment.taskId !== params.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.taskComment.delete({ where: { id: params.commentId } })
  return NextResponse.json({ ok: true })
}
