import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalystUnits, getSessionOrUnauthorized } from '@/lib/apiHelpers'

export async function GET() {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  const units = getAnalystUnits(session!)
  const items = await prisma.admissionDocument.findMany({ where: {
    status: { in: ['UPLOADED', 'UNDER_REVIEW', 'RESUBMISSION_REQUIRED'] },
    ...(units ? { admission: { unitId: { in: units } } } : {}),
  }, include: { type: true, admission: { select: { id: true, candidateName: true, jobTitle: true, unit: { select: { name: true } } } } }, orderBy: { uploadedAt: 'asc' }, take: 100 })
  return NextResponse.json(items)
}
