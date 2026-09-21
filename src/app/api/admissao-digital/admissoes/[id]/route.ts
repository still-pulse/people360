import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analystCanAccessUnit, forbidIfReadOnly, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { createAdmissionToken } from '@/lib/admission/service'
import { assertTransition } from '@/lib/admission/stateMachine'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'
import { decryptAdmissionValue } from '@/lib/admission/security'

const include = {
  unit: true, candidate: { select: { id: true, nome: true, email: true, telefone: true } }, vacancy: true,
  owner: { select: { id: true, name: true } }, tokens: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { expiresAt: true, revokedAt: true, tokenHint: true } },
  fields: true, dependents: true, transport: { include: { routes: true } }, documents: { include: { type: true, reviewedBy: { select: { name: true } } }, orderBy: { type: { position: 'asc' as const } } },
  badgePhotos: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { id: true, confirmedAt: true, createdAt: true } },
  faceVerifications: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { id: true, provider: true, status: true, attempts: true, resultMetadata: true, completedAt: true, capturedAt: true, createdAt: true, updatedAt: true } },
  generatedDocuments: { select: { id: true, status: true, templateVersion: true, generatedAt: true, signedAt: true, validationCode: true, originalHash: true, finalHash: true, template: { select: { key: true, name: true } } } },
  signatureEnvelopes: { select: { id: true, documentId: true, provider: true, signerName: true, signerEmail: true, status: true, transactionId: true, signedAt: true, signedIp: true, signedUserAgent: true, latitude: true, longitude: true, locationAccuracy: true, events: { orderBy: { createdAt: 'desc' as const }, select: { id: true, type: true, ip: true, userAgent: true, hash: true, metadata: true, createdAt: true } } } },
  erpnextSyncs: { orderBy: { createdAt: 'desc' as const } }, auditLogs: { orderBy: { createdAt: 'desc' as const }, take: 100 },
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  const item = await prisma.admission.findUnique({ where: { id: params.id }, include })
  if (!item) return NextResponse.json({ error: 'Admissão não encontrada.' }, { status: 404 })
  if (!analystCanAccessUnit(session!, item.unitId)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  const canViewSensitiveData = ['ADMIN', 'ANALYST'].includes(session!.user.role)
  const response = canViewSensitiveData ? {
    ...item,
    fields: item.fields.map((field) => ({ ...field, value: field.sensitive ? decryptAdmissionValue(field.value) : field.value })),
  } : { ...item, fields: [], dependents: [], transport: null, badgePhotos: [], faceVerifications: [], signatureEnvelopes: [] }
  return NextResponse.json(response)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  const forbidden = forbidIfReadOnly(session!.user.role); if (forbidden) return forbidden
  const current = await prisma.admission.findUnique({ where: { id: params.id } })
  if (!current) return NextResponse.json({ error: 'Admissão não encontrada.' }, { status: 404 })
  if (!analystCanAccessUnit(session!, current.unitId)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  const body = await req.json().catch(() => ({})); const action = String(body.action || '')
  let response: Record<string, unknown> = {}
  if (action === 'renew-link' || action === 'resend-link') {
    const link = await createAdmissionToken(current.id, Number(body.validityDays || 7))
    if (current.status === 'EXPIRED') await prisma.admission.update({ where: { id: current.id }, data: { status: 'LINK_SENT', lastActivityAt: new Date() } })
    response = { publicUrl: `${process.env.NEXTAUTH_URL || req.nextUrl.origin}/admissao/${link.token}`, expiresAt: link.expiresAt }
  } else if (action === 'invalidate-link') {
    await prisma.admissionToken.updateMany({ where: { admissionId: current.id, revokedAt: null }, data: { revokedAt: new Date() } })
  } else if (action === 'cancel') {
    assertTransition(current.status, 'CANCELLED')
    await prisma.admission.update({ where: { id: current.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: String(body.reason || 'Cancelado pelo RH') } })
  } else if (action === 'retry-erpnext') {
    if (!['ERPNEXT_ERROR', 'READY_FOR_ERPNEXT'].includes(current.status)) return NextResponse.json({ error: 'A integração não pode ser reprocessada neste status.' }, { status: 409 })
    await prisma.$transaction([
      prisma.admission.update({ where: { id: current.id }, data: { status: 'SYNCING', lastActivityAt: new Date() } }),
      prisma.eRPNextSync.upsert({ where: { idempotencyKey: `admission:${current.id}` }, create: { admissionId: current.id, idempotencyKey: `admission:${current.id}`, status: 'RETRYING', attempts: 1, nextAttemptAt: new Date() }, update: { status: 'RETRYING', attempts: { increment: 1 }, nextAttemptAt: new Date(), lastError: null } }),
    ])
  } else if (action === 'approve-face' || action === 'request-face-retry') {
    if (!['ADMIN', 'ANALYST'].includes(session!.user.role)) {
      return NextResponse.json({ error: 'Sem permissão para revisar biometria.' }, { status: 403 })
    }
    const verification = await prisma.faceVerification.findFirst({ where: { admissionId: current.id }, orderBy: { createdAt: 'desc' } })
    if (!verification) return NextResponse.json({ error: 'Validação facial não encontrada.' }, { status: 404 })
    if (action === 'approve-face') {
      if (!['FACE_VALIDATION_PENDING', 'DOCUMENTS_APPROVED'].includes(current.status)) {
        return NextResponse.json({ error: 'A validação facial não pode ser aprovada neste status.' }, { status: 409 })
      }
      await prisma.$transaction([
        prisma.faceVerification.update({ where: { id: verification.id }, data: { status: 'APPROVED', completedAt: new Date() } }),
        prisma.admission.update({ where: { id: current.id }, data: { status: 'CONTRACT_PENDING', currentStep: 'revisao', progress: { set: Math.max(74, current.progress) }, lastActivityAt: new Date() } }),
      ])
    } else {
      if (current.status !== 'FACE_VALIDATION_PENDING') {
        return NextResponse.json({ error: 'Não é possível solicitar nova captura neste status.' }, { status: 409 })
      }
      await prisma.$transaction([
        prisma.faceVerification.update({ where: { id: verification.id }, data: { status: 'REJECTED', completedAt: null } }),
        prisma.admission.update({ where: { id: current.id }, data: { currentStep: 'validacao-facial', lastActivityAt: new Date() } }),
      ])
    }
  } else return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  await logAdmissionEvent({ admissionId: current.id, actorId: session!.user.id, actorName: session!.user.name, actorType: 'USER', action: action.toUpperCase().replace(/-/g, '_'), ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { reason: body.reason } })
  return NextResponse.json({ success: true, ...response })
}
