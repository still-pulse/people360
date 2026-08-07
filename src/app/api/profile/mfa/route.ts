import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSecret, generateSync, verifySync, generateURI } from 'otplib'
import qrcode from 'qrcode'

export const dynamic = 'force-dynamic'

// GET — retorna status MFA e, se não habilitado, gera QR code para setup
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { mfaEnabled: true, mfaSecret: true, email: true, name: true },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (user.mfaEnabled) {
    return NextResponse.json({ enabled: true })
  }

  // Gera (ou reutiliza) secret temporário para o setup
  let secret = user.mfaSecret
  if (!secret) {
    secret = generateSecret()
    await prisma.user.update({ where: { id: session.user.id }, data: { mfaSecret: secret } })
  }

  const otpauth = generateURI({ strategy: 'totp', issuer: 'People 360', label: user.email!, secret })
  const qrDataUrl = await qrcode.toDataURL(otpauth, { width: 240, margin: 2 })

  return NextResponse.json({ enabled: false, secret, qrDataUrl })
}

// POST — verifica código TOTP e ativa MFA
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Código obrigatório.' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { mfaSecret: true, mfaEnabled: true },
  })
  if (!user?.mfaSecret) {
    return NextResponse.json({ error: 'Inicie o setup primeiro.' }, { status: 400 })
  }
  if (user.mfaEnabled) {
    return NextResponse.json({ error: 'MFA já está ativo.' }, { status: 400 })
  }

  const result = verifySync({ token: code.trim(), secret: user.mfaSecret })
  if (!result.valid) {
    return NextResponse.json({ error: 'Código inválido. Verifique o seu app autenticador.' }, { status: 400 })
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { mfaEnabled: true } })
  return NextResponse.json({ success: true })
}

// DELETE — desativa MFA (requer código TOTP atual para confirmar)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Informe o código atual para desativar.' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { mfaSecret: true, mfaEnabled: true },
  })
  if (!user?.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json({ error: 'MFA não está ativo.' }, { status: 400 })
  }

  const result = verifySync({ token: code.trim(), secret: user.mfaSecret })
  if (!result.valid) {
    return NextResponse.json({ error: 'Código inválido.' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { mfaEnabled: false, mfaSecret: null },
  })
  return NextResponse.json({ success: true })
}
