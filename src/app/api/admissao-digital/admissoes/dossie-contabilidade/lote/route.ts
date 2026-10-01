import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { canAccessAdmission, enforceUnitFilter, forbidIfReadOnly, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { extractIp } from '@/lib/audit'
import { ACCOUNTING_DOSSIER_GENERATED, buildAccountingAdmissionDossier } from '@/lib/admission/accountingDossier'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { pendingRequiredDocuments } from '@/lib/admission/documentStatus'
import { safeBadgeArchiveName } from '@/lib/badges/batch'
import { allowRequest } from '@/lib/dossie/http'
import { compressPdf } from '@/lib/pdfCompress'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_BATCH = 60
// Processos encerrados não entram no lote: o dossiê é para conferência antes da assinatura/integração.
const CLOSED_STATUSES = ['DRAFT', 'CANCELLED', 'EXPIRED', 'SYNCED', 'COMPLETED']

const csv = (values: string[]) => values.map((value) => `"${value.replace(/"/g, '""')}"`).join(';')

/** Gera em lote os dossiês pré-admissionais de quem já tem todos os documentos aprovados, em um ZIP com uma pasta por colaborador. */
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const role = session!.user.actualRole ?? session!.user.role
  const forbidden = forbidIfReadOnly(role)
  if (forbidden) return forbidden
  if (!allowRequest(`accounting-dossier-batch:${session!.user.id}`, 2, 60_000)) {
    return NextResponse.json({ error: 'Aguarde um minuto antes de gerar outro lote.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 200) : []
  const where: Record<string, any> = { processType: 'ADMISSION', status: { notIn: CLOSED_STATUSES } }
  enforceUnitFilter(where, session!, typeof body.unitId === 'string' ? body.unitId : null, 'unitId')
  if (ids.length) where.id = { in: ids }

  const admissions = await prisma.admission.findMany({
    where, orderBy: { candidateName: 'asc' },
    select: { id: true, protocol: true, candidateName: true, unitId: true, ownerId: true, analysts: { select: { id: true } }, documents: { select: { status: true, type: { select: { required: true } } } } },
  })
  const eligible = admissions.filter((admission) => canAccessAdmission(session!, admission)
    && admission.documents.length > 0 && !pendingRequiredDocuments(admission.documents).length)
  if (!eligible.length) return NextResponse.json({ error: 'Nenhuma admissão com todos os documentos aprovados foi encontrada.' }, { status: 404 })
  if (eligible.length > MAX_BATCH) {
    return NextResponse.json({ error: `O lote tem ${eligible.length} admissões. Selecione no máximo ${MAX_BATCH} ou filtre por unidade.` }, { status: 413 })
  }

  const zip = new JSZip()
  const report = [csv(['Colaborador', 'Protocolo', 'Status', 'Detalhes'])]
  const usedFolders = new Set<string>()
  let generated = 0

  for (const admission of eligible) {
    let folderName = safeBadgeArchiveName(admission.candidateName)
    // Homônimos não podem cair na mesma pasta.
    if (usedFolders.has(folderName.toLowerCase())) folderName = `${folderName} - ${admission.protocol}`
    usedFolders.add(folderName.toLowerCase())
    const folder = zip.folder(folderName)!
    try {
      const result = await buildAccountingAdmissionDossier(admission.id, req.nextUrl.origin)
      const compressed = await compressPdf(result.buffer)
      folder.file(result.fileName, compressed.buffer)
      await logAdmissionEvent({
        admissionId: admission.id, actorId: session!.user.id, actorName: session!.user.name,
        actorType: 'USER', action: ACCOUNTING_DOSSIER_GENERATED, ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'),
        metadata: { pages: result.pages, documents: result.documents, fileName: result.fileName, batch: true },
      })
      generated++
      report.push(csv([admission.candidateName, admission.protocol, 'GERADO', `${result.documents} documento(s), ${result.pages} página(s)`]))
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Erro desconhecido.'
      console.error('[admission-accounting-dossier-batch]', admission.protocol, caught)
      folder.file('PENDENCIA.txt', `Dossiê não gerado: ${message}`)
      report.push(csv([admission.candidateName, admission.protocol, 'ERRO', message]))
    }
  }

  if (!generated) return NextResponse.json({ error: 'Não foi possível gerar nenhum dossiê do lote.' }, { status: 422 })
  zip.file('relatorio.csv', `﻿${report.join('\r\n')}`)
  const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
  const fileName = `Dossies_Pre_Admissionais_${new Date().toISOString().slice(0, 10)}.zip`
  return new NextResponse(new Uint8Array(archive), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
      'X-Dossiers-Generated': String(generated),
      'X-Dossiers-Failed': String(eligible.length - generated),
    },
  })
}
