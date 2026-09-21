import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceUnitFilter, getSessionOrUnauthorized } from '@/lib/apiHelpers'

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  const where: Record<string, any> = { status: { in: ['LINK_SENT', 'AWAITING_DOCUMENTS', 'CORRECTION_REQUESTED', 'FACE_VALIDATION_PENDING', 'SIGNATURE_PENDING', 'ERPNEXT_ERROR', 'EXPIRED'] } }
  enforceUnitFilter(where, session!, req.nextUrl.searchParams.get('unitId'), 'unitId')
  const items = await prisma.admission.findMany({ where, include: { unit: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } }, documents: { where: { status: { in: ['REJECTED', 'RESUBMISSION_REQUIRED'] } }, include: { type: true }, take: 1 } }, orderBy: [{ priority: 'desc' }, { lastActivityAt: 'asc' }], take: 200 })
  return NextResponse.json(items.map((item) => ({
    id: item.id, candidateName: item.candidateName, jobTitle: item.jobTitle, unit: item.unit, owner: item.owner,
    status: item.status, priority: item.priority, stoppedSince: item.lastActivityAt,
    reason: item.documents[0]?.rejectionReason || (item.status === 'LINK_SENT' ? 'Aguardando candidato' : item.status === 'ERPNEXT_ERROR' ? 'Erro no ERPNext' : item.status === 'SIGNATURE_PENDING' ? 'Aguardando assinatura' : item.status === 'EXPIRED' ? 'Link expirado' : 'Dados ou documentos pendentes'),
    recommendedAction: item.status === 'ERPNEXT_ERROR' ? 'Reprocessar' : item.status === 'EXPIRED' ? 'Gerar novo link' : item.status === 'CORRECTION_REQUESTED' ? 'Acompanhar reenvio' : 'Enviar lembrete',
  })))
}
