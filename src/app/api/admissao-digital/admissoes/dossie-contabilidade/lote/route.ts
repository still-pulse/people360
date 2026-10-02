import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { canAccessAdmission, enforceUnitFilter, forbidIfReadOnly, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { extractIp } from '@/lib/audit'
import { ACCOUNTING_DOSSIER_GENERATED, buildAccountingAdmissionDossier, DEPENDENT_DOSSIER_VERSION } from '@/lib/admission/accountingDossier'
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

/** Lista o escopo autorizado sem executar a geração de PDFs. */
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const forbidden = forbidIfReadOnly(session!.user.actualRole ?? session!.user.role)
  if (forbidden) return forbidden
  const correction = req.nextUrl.searchParams.get('dependentCorrection') === 'true'
  const where: Record<string, any> = { processType: 'ADMISSION', status: { notIn: correction ? ['DRAFT', 'CANCELLED', 'EXPIRED'] : CLOSED_STATUSES } }
  if (correction) where.dependents = { some: {} }
  enforceUnitFilter(where, session!, req.nextUrl.searchParams.get('unitId'), 'unitId')
  const admissions = await prisma.admission.findMany({ where, orderBy: { candidateName: 'asc' }, select: {
    id: true, protocol: true, candidateName: true, unitId: true, ownerId: true, analysts: { select: { id: true } },
    documents: { select: { status: true, type: { select: { required: true } } } },
  } })
  const items = admissions.filter(a => canAccessAdmission(session!, a) && (correction || (a.documents.length > 0 && !pendingRequiredDocuments(a.documents).length)))
    .map(a => ({ id: a.id, protocol: a.protocol, candidateName: a.candidateName }))
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
}

/** Gera em lote os dossiês pré-admissionais de quem já tem todos os documentos aprovados, em um ZIP com uma pasta por colaborador. */
export async function POST(req: NextRequest) {
  try {
    return await generateBatch(req)
  } catch (caught) {
    console.error('[admission-accounting-dossier-batch-request]', caught)
    const code = caught && typeof caught === 'object' && 'code' in caught ? caught.code : null
    return NextResponse.json({ error: code === 'P2022'
      ? 'O banco está sem uma coluna necessária. Verifique se as migrações foram aplicadas no deploy.'
      : 'Falha no servidor ao gerar o lote. Consulte os logs da aplicação para identificar a causa.' }, { status: 500 })
  }
}

async function generateBatch(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const role = session!.user.actualRole ?? session!.user.role
  const forbidden = forbidIfReadOnly(role)
  if (forbidden) return forbidden
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 200) : []
  const single = ids.length === 1
  if (!allowRequest(`accounting-dossier-${single ? 'single' : 'batch'}:${session!.user.id}`, single ? 60 : 2, 60_000)) {
    return NextResponse.json({ error: 'Aguarde um minuto antes de gerar outro lote.' }, { status: 429 })
  }
  const correction = body.dependentCorrection === true
  const where: Record<string, any> = { processType: 'ADMISSION', status: { notIn: correction ? ['DRAFT', 'CANCELLED', 'EXPIRED'] : CLOSED_STATUSES } }
  if (correction) where.dependents = { some: {} }
  enforceUnitFilter(where, session!, typeof body.unitId === 'string' ? body.unitId : null, 'unitId')
  if (ids.length) where.id = { in: ids }

  const admissions = await prisma.admission.findMany({
    where, orderBy: { candidateName: 'asc' },
    select: { id: true, protocol: true, candidateName: true, unitId: true, ownerId: true, analysts: { select: { id: true } }, documents: { select: { status: true, type: { select: { required: true } } } }, auditLogs: { where: { action: ACCOUNTING_DOSSIER_GENERATED }, orderBy: { createdAt: 'desc' }, take: 1, select: { metadata: true } } },
  })
  const candidates = admissions.filter((admission) => canAccessAdmission(session!, admission)
    && (correction || (admission.documents.length > 0 && !pendingRequiredDocuments(admission.documents).length)))
  const eligible = candidates
  if (!eligible.length) return NextResponse.json({ error: correction ? 'Nenhuma admissão com dependentes foi encontrada.' : 'Nenhuma admissão com todos os documentos aprovados foi encontrada.' }, { status: 404 })
  if (eligible.length > MAX_BATCH) {
    return NextResponse.json({ error: `O lote tem ${eligible.length} admissões. Selecione no máximo ${MAX_BATCH} ou filtre por unidade.` }, { status: 413 })
  }

  const zip = new JSZip()
  const report = [csv(['Colaborador', 'Protocolo', 'Status', 'Detalhes'])]
  const usedFolders = new Set<string>()
  let generated = 0
  const failures: string[] = []

  for (const admission of eligible) {
    let folderName = `${safeBadgeArchiveName(admission.candidateName)} - ${admission.protocol}`
    // Homônimos não podem cair na mesma pasta.
    if (usedFolders.has(folderName.toLowerCase())) folderName = `${folderName} - ${admission.protocol}`
    usedFolders.add(folderName.toLowerCase())
    const folder = zip.folder(folderName)!
    try {
      const result = await buildAccountingAdmissionDossier(admission.id, req.nextUrl.origin, { allowIncomplete: correction })
      const compressed = await compressPdf(result.buffer)
      folder.file(result.fileName, compressed.buffer)
      await logAdmissionEvent({
        admissionId: admission.id, actorId: session!.user.id, actorName: session!.user.name,
        actorType: 'USER', action: result.pendingDocuments ? 'ACCOUNTING_DOSSIER_PREVIEW_GENERATED' : ACCOUNTING_DOSSIER_GENERATED, ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'),
        metadata: { pages: result.pages, documents: result.documents, fileName: result.fileName, batch: true, dependentDataVersion: DEPENDENT_DOSSIER_VERSION },
      })
      generated++
      report.push(csv([admission.candidateName, admission.protocol, result.pendingDocuments ? 'GERADO COM PENDÊNCIAS' : 'GERADO', `${result.documents} documento(s), ${result.pages} página(s)${result.pendingDocuments ? `; ${result.pendingDocuments} documento(s) obrigatório(s) sem aprovação do RH` : ''}`]))
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Erro desconhecido.'
      failures.push(`${admission.protocol}: ${message}`)
      console.error('[admission-accounting-dossier-batch]', admission.protocol, caught)
      folder.file('PENDENCIA.txt', `Dossiê não gerado: ${message}`)
      report.push(csv([admission.candidateName, admission.protocol, 'ERRO', message]))
    }
  }

  if (!generated) return NextResponse.json({ error: `Não foi possível gerar nenhum dossiê do lote. ${failures.slice(0, 3).join(' | ')}` }, { status: 422 })
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
      'X-Dossiers-Remaining': String(correction ? Math.max(0, candidates.length - eligible.length) : 0),
    },
  })
}
