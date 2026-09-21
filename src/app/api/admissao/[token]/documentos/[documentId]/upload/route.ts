import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdmissionByPublicToken } from '@/lib/admission/service'
import { savePrivateAdmissionFile } from '@/lib/admission/storage'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: { token: string; documentId: string } }) {
  const token = await getAdmissionByPublicToken(params.token); if (!token) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  const doc = token.admission.documents.find((d) => d.id === params.documentId); if (!doc) return NextResponse.json({ error: 'Documento não pertence a esta admissão.' }, { status: 404 })
  const file = (await req.formData()).get('file'); if (!(file instanceof File)) return NextResponse.json({ error: 'Selecione um arquivo.' }, { status: 400 })
  if (file.size > doc.type.maxSizeBytes) return NextResponse.json({ error: `O limite é ${Math.round(doc.type.maxSizeBytes / 1048576)} MB.` }, { status: 400 })
  let saved
  try { saved = await savePrivateAdmissionFile(token.admissionId, `document-${doc.typeId}`, file) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Arquivo inválido.' }, { status: 400 }) }
  if (!doc.type.allowedMimeTypes.includes(saved.mimeType)) return NextResponse.json({ error: 'Formato não permitido para este documento.' }, { status: 400 })
  await prisma.$transaction([
    prisma.admissionDocument.update({ where: { id: doc.id }, data: { storagePath: saved.storagePath, originalName: file.name.slice(0, 180), mimeType: saved.mimeType, sizeBytes: saved.sizeBytes, status: 'UPLOADED', uploadedAt: new Date(), version: doc.storagePath ? { increment: 1 } : undefined, rejectionReason: null, reviewedAt: null, reviewedById: null } }),
    prisma.admission.update({ where: { id: token.admissionId }, data: { status: 'DOCUMENTS_UNDER_REVIEW', progress: { set: Math.max(55, token.admission.progress) }, lastActivityAt: new Date() } }),
  ])
  await logAdmissionEvent({ admissionId: token.admissionId, actorName: token.admission.candidateName, actorType: 'CANDIDATE', action: 'DOCUMENT_UPLOADED', resource: 'AdmissionDocument', resourceId: doc.id, ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { documentType: doc.type.name, sizeBytes: saved.sizeBytes, mimeType: saved.mimeType } })
  return NextResponse.json({ success: true, status: 'UPLOADED' })
}
