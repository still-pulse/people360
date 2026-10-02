import { NextRequest, NextResponse } from 'next/server'
import { canAccessAdmission, forbidIfReadOnly, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { prisma } from '@/lib/prisma'
import { buildAdmissionLegalDossier } from '@/lib/dossie/legalDossier'
import { allowRequest, pdfResponse } from '@/lib/dossie/http'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'
import { compressPdf } from '@/lib/pdfCompress'

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const forbidden = forbidIfReadOnly(session!.user.actualRole ?? session!.user.role)
  if (forbidden) return forbidden
  const admission = await prisma.admission.findUnique({ where: { id }, include: { analysts: { select: { id: true } } } })
  if (!admission) return NextResponse.json({ error: 'Admissão não encontrada.' }, { status: 404 })
  if (!canAccessAdmission(session!, admission)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  if (admission.processType !== 'ADMISSION') return NextResponse.json({ error: 'Disponível somente para admissões.' }, { status: 409 })
  if (!allowRequest(`legal-dossier:${session!.user.id}`, 8, 60_000)) return NextResponse.json({ error: 'Muitas gerações em sequência. Aguarde um instante.' }, { status: 429 })
  try {
    const result = await buildAdmissionLegalDossier(id)
    const compressed = await compressPdf(result.buffer)
    await logAdmissionEvent({ admissionId: id, actorId: session!.user.id, actorName: session!.user.name, actorType: 'USER', action: 'LEGAL_DOSSIER_GENERATED', ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { pages: result.pages, documents: result.documents, fileName: result.fileName } })
    return pdfResponse(compressed.buffer, result.fileName, false)
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : 'Não foi possível gerar o dossiê jurídico.' }, { status: 422 })
  }
}
