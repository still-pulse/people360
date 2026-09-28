import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalystUnits, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { parseProcessType } from '@/lib/admission/constants'

const admissionSelect = { id: true, candidateName: true, jobTitle: true, unit: { select: { name: true } } } as const

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  const units = getAnalystUnits(session!)
  const processType = parseProcessType(req.nextUrl.searchParams.get('processType'))
  const admissionScope = units ? { OR: [{ unitId: { in: units } }, { ownerId: session!.user.id }, { analysts: { some: { id: session!.user.id } } }] } : {}
  const [documents, photos] = await Promise.all([
    prisma.admissionDocument.findMany({ where: {
      status: { in: ['UPLOADED', 'UNDER_REVIEW', 'RESUBMISSION_REQUIRED'] },
      admission: { processType, ...admissionScope },
    }, include: { type: true, admission: { select: admissionSelect } }, orderBy: { uploadedAt: 'asc' }, take: 500 }),
    // Foto do crachá confirmada pelo candidato e ainda não aprovada pelo RH (somente admissão).
    processType !== 'ADMISSION' ? Promise.resolve([]) : prisma.badgePhoto.findMany({ where: {
      confirmedAt: { not: null }, approvedAt: null,
      admission: { processType: 'ADMISSION', status: { notIn: ['CANCELLED', 'EXPIRED'] }, ...admissionScope },
    }, select: { id: true, confirmedAt: true, admission: { select: admissionSelect } }, orderBy: { confirmedAt: 'asc' }, take: 200 }),
  ])
  const photoItems = photos.map((photo) => ({ id: `badge:${photo.id}`, kind: 'badge' as const, storagePath: 'badge', uploadedAt: photo.confirmedAt, type: { name: 'Foto do crachá' }, admission: photo.admission }))
  const items = [...documents.map((document) => ({ ...document, kind: 'document' as const })), ...photoItems]
    .sort((a, b) => new Date(a.uploadedAt ?? 0).getTime() - new Date(b.uploadedAt ?? 0).getTime())
  return NextResponse.json(items)
}
