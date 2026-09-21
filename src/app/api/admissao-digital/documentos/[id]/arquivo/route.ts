import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analystCanAccessUnit, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  const doc = await prisma.admissionDocument.findUnique({ where: { id: params.id }, include: { admission: { select: { unitId: true } } } })
  if (!doc?.storagePath) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
  if (!analystCanAccessUnit(session!, doc.admission.unitId)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  const file = await readPrivateAdmissionFile(doc.storagePath); if (!file) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 })
  return new NextResponse(file, { headers: { 'Content-Type': doc.mimeType || 'application/octet-stream', 'Content-Disposition': `inline; filename="documento-${doc.id}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}
