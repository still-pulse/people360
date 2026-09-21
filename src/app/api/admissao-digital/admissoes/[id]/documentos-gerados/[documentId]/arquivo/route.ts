import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analystCanAccessUnit, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'

export async function GET(
  _: NextRequest,
  props: { params: Promise<{ id: string; documentId: string }> }
) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const document = await prisma.generatedDocument.findFirst({
    where: { id: params.documentId, admissionId: params.id },
    include: { admission: { select: { unitId: true } }, template: { select: { key: true } } },
  })
  if (!document) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
  if (!analystCanAccessUnit(session!, document.admission.unitId)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  const storagePath = document.signedStoragePath || document.storagePath
  if (!storagePath) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 })
  const file = await readPrivateAdmissionFile(storagePath)
  if (!file) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 })
  return new NextResponse(file, { headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${document.template.key}-${document.status.toLowerCase()}.pdf"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } })
}
