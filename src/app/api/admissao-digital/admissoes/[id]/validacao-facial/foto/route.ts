import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analystCanAccessUnit, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'
import { isFaceVerificationEnabled } from '@/lib/admission/features'

export async function GET(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!isFaceVerificationEnabled()) {
    return NextResponse.json({ error: 'A validação facial está desativada.' }, { status: 410 })
  }
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (!['ADMIN', 'ANALYST'].includes(session!.user.role)) {
    return NextResponse.json({ error: 'Sem permissão para visualizar biometria.' }, { status: 403 })
  }

  const verification = await prisma.faceVerification.findFirst({
    where: { admissionId: params.id, capturePath: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      capturePath: true,
      captureMimeType: true,
      admission: { select: { unitId: true } },
    },
  })
  if (!verification?.capturePath) {
    return NextResponse.json({ error: 'Captura facial não encontrada.' }, { status: 404 })
  }
  if (!analystCanAccessUnit(session!, verification.admission.unitId)) {
    return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  }

  const file = await readPrivateAdmissionFile(verification.capturePath)
  if (!file) return NextResponse.json({ error: 'Captura facial indisponível.' }, { status: 404 })

  return new NextResponse(file, {
    headers: {
      'Content-Type': verification.captureMimeType || 'image/jpeg',
      'Content-Disposition': `inline; filename="captura-facial-${verification.id}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
