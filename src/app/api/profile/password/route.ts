import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { log, extractIp } from '@/lib/audit'

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword, skipCurrentCheck } = await req.json()

  if (!newPassword) {
    return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

  // Primeiro acesso: pula verificação da senha atual
  if (!skipCurrentCheck || !session.user.mustChangePassword) {
    if (!currentPassword) return NextResponse.json({ error: 'Informe a senha atual.' }, { status: 400 })
    const match = await bcrypt.compare(currentPassword, user.password)
    if (!match) return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: session.user.id }, data: { password: hashed, mustChangePassword: false } })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'PASSWORD_CHANGED', entity: 'Perfil', entityId: session.user.id, entityName: session.user.name ?? undefined,
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ success: true })
}
