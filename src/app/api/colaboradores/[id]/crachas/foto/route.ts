import { NextRequest, NextResponse } from 'next/server'
import { authorizeBadge } from '@/lib/badges/permissions'
import { latestBadgePhoto } from '@/lib/badges/data'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'

export async function GET(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const access = await authorizeBadge('badges.view', id)
  if (!access.ok) return access.response
  const photo = await latestBadgePhoto(access.employee.id)
  if (!photo) return NextResponse.json({ error: 'Foto para o crachá não encontrada.' }, { status: 404 })
  const file = await readPrivateAdmissionFile(photo.processedPath || photo.originalPath)
  if (!file) return NextResponse.json({ error: 'Foto para o crachá indisponível.' }, { status: 404 })
  return new NextResponse(new Uint8Array(file), { headers: {
    'Content-Type': photo.mimeType, 'Content-Disposition': `inline; filename="foto-cracha-${photo.id}"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } })
}
