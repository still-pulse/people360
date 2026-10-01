import { NextRequest, NextResponse } from 'next/server'
import { canAccessAdmission, forbidIfReadOnly, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { extractIp } from '@/lib/audit'
import { buildAccountingAdmissionDossier } from '@/lib/admission/accountingDossier'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { pendingRequiredDocuments } from '@/lib/admission/documentStatus'
import { prisma } from '@/lib/prisma'
import { allowRequest, pdfResponse } from '@/lib/dossie/http'
import { compressPdf } from '@/lib/pdfCompress'

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const role = session!.user.actualRole ?? session!.user.role
  const forbidden = forbidIfReadOnly(role)
  if (forbidden) return forbidden
  const admission = await prisma.admission.findUnique({
    where: { id: params.id },
    include: { analysts: { select: { id: true } }, documents: { select: { status: true, type: { select: { required: true } } } } },
  })
  if (!admission) return NextResponse.json({ error: 'Admissão não encontrada.' }, { status: 404 })
  if (!canAccessAdmission(session!, admission)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  if (admission.processType !== 'ADMISSION') return NextResponse.json({ error: 'Disponível somente para admissões.' }, { status: 409 })
  const pending = pendingRequiredDocuments(admission.documents).length
  if (pending) return NextResponse.json({ error: `Ainda existem ${pending} documento(s) obrigatório(s) sem aprovação do RH.` }, { status: 409 })
  if (!allowRequest(`accounting-dossier:${session!.user.id}`, 8, 60_000)) return NextResponse.json({ error: 'Muitas gerações em sequência. Aguarde um instante.' }, { status: 429 })

  try {
    const result = await buildAccountingAdmissionDossier(admission.id, req.nextUrl.origin)
    const compressed = await compressPdf(result.buffer)
    await logAdmissionEvent({
      admissionId: admission.id, actorId: session!.user.id, actorName: session!.user.name,
      actorType: 'USER', action: 'ACCOUNTING_DOSSIER_GENERATED', ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'),
      metadata: { pages: result.pages, documents: result.documents, fileName: result.fileName },
    })
    return pdfResponse(compressed.buffer, result.fileName, false)
  } catch (caught) {
    console.error('[admission-accounting-dossier]', admission.protocol, caught)
    return NextResponse.json({ error: caught instanceof Error ? caught.message : 'Não foi possível gerar o dossiê.' }, { status: 422 })
  }
}
