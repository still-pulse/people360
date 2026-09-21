import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analystCanAccessUnit, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (!['ADMIN', 'ANALYST'].includes(session!.user.role)) {
    return NextResponse.json({ error: 'Sem permissão para visualizar biometria.' }, { status: 403 })
  }
  const photo = await prisma.badgePhoto.findFirst({
    where: { admissionId: params.id },
    orderBy: { createdAt: 'desc' },
    include: { admission: { select: { unitId: true } } },
  })
  if (!photo) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
  if (!analystCanAccessUnit(session!, photo.admission.unitId)) {
    return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  }
  const file = await readPrivateAdmissionFile(photo.processedPath || photo.originalPath)
  if (!file) return NextResponse.json({ error: 'Foto indisponível.' }, { status: 404 })
  return new NextResponse(file, {
    headers: {
      'Content-Type': photo.mimeType,
      'Content-Disposition': `inline; filename="foto-${photo.id}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
