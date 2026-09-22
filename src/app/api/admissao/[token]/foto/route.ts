import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdmissionByPublicToken, getMutableAdmissionByPublicToken } from '@/lib/admission/service'
import { readPrivateAdmissionFile, savePrivateAdmissionFile } from '@/lib/admission/storage'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'

export async function GET(_: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const token = await getAdmissionByPublicToken(params.token)
  if (!token) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  const photo = token.admission.badgePhotos[0]
  if (!photo) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
  const file = await readPrivateAdmissionFile(photo.processedPath || photo.originalPath)
  if (!file) return NextResponse.json({ error: 'Foto indisponível.' }, { status: 404 })
  return new NextResponse(file, {
    headers: {
      'Content-Type': photo.mimeType,
      'Content-Disposition': 'inline; filename="foto-cracha"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const token = await getMutableAdmissionByPublicToken(params.token)
  if (!token) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  const file = (await req.formData()).get('file');if (!(file instanceof File)) return NextResponse.json({ error: 'Capture ou selecione a foto.' }, { status: 400 })
  let saved;try { saved = await savePrivateAdmissionFile(token.admissionId, 'badge-photo', file) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Foto inválida.' }, { status: 400 }) }
  if (!saved.mimeType.startsWith('image/')) return NextResponse.json({ error: 'Envie uma imagem JPG ou PNG.' }, { status: 400 })
  const requiredPending = token.admission.documents.some((document) => document.type.required && document.status !== 'APPROVED')
  await prisma.$transaction([
    prisma.badgePhoto.create({ data: { admissionId: token.admissionId, originalPath: saved.storagePath, mimeType: saved.mimeType, sizeBytes: saved.sizeBytes, confirmedAt: new Date() } }),
    prisma.admission.update({ where: { id: token.admissionId }, data: { currentStep: requiredPending ? 'foto' : 'validacao-facial', progress: { set: Math.max(66, token.admission.progress) }, status: requiredPending ? 'DOCUMENTS_UNDER_REVIEW' : 'FACE_VALIDATION_PENDING', lastActivityAt: new Date() } }),
  ])
  await logAdmissionEvent({ admissionId: token.admissionId, actorName: token.admission.candidateName, actorType: 'CANDIDATE', action: 'BADGE_PHOTO_CONFIRMED', ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { mimeType: saved.mimeType, sizeBytes: saved.sizeBytes } })
  return NextResponse.json({ success: true, canStartFaceValidation: !requiredPending })
}
