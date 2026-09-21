import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdmissionByPublicToken } from '@/lib/admission/service'
import { mockFaceProvider } from '@/lib/admission/providers'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const token = await getAdmissionByPublicToken(params.token); if (!token) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  if (!token.admission.badgePhotos[0]) return NextResponse.json({ error: 'Confirme primeiro a foto para o crachá.' }, { status: 409 })
  if (token.admission.documents.some((d) => d.type.required && d.status !== 'APPROVED')) return NextResponse.json({ error: 'Aguarde a aprovação dos documentos obrigatórios pelo RH.' }, { status: 409 })
  const current = token.admission.faceVerifications[0]
  const result = await mockFaceProvider.verify(token.admissionId)
  const status = result.approved ? 'APPROVED' : 'MANUAL_REVIEW'
  const verification = current ? await prisma.faceVerification.update({ where: { id: current.id }, data: { status, providerRef: result.reference, attempts: { increment: 1 }, completedAt: result.approved ? new Date() : null, resultMetadata: { mock: true } } }) : await prisma.faceVerification.create({ data: { admissionId: token.admissionId, provider: 'mock', status, providerRef: result.reference, attempts: 1, completedAt: result.approved ? new Date() : null, resultMetadata: { mock: true } } })
  await prisma.admission.update({ where: { id: token.admissionId }, data: { currentStep: result.approved ? 'revisao' : 'validacao-facial', progress: { set: Math.max(result.approved ? 74 : 66, token.admission.progress) }, status: result.approved ? 'CONTRACT_PENDING' : 'FACE_VALIDATION_PENDING', lastActivityAt: new Date() } })
  await logAdmissionEvent({ admissionId: token.admissionId, actorName: token.admission.candidateName, actorType: 'CANDIDATE', action: `FACE_${status}`, resource: 'FaceVerification', resourceId: verification.id, ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { provider: 'mock', attempt: verification.attempts } })
  return NextResponse.json({ status, canRetry: !result.approved })
}
