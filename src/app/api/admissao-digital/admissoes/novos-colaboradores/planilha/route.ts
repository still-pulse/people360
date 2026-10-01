import { NextRequest, NextResponse } from 'next/server'
import { canAccessAdmission, enforceUnitFilter, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { extractIp } from '@/lib/audit'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { pendingRequiredDocuments } from '@/lib/admission/documentStatus'
import { buildNewHiresWorkbook, type NewHire } from '@/lib/admission/newHiresSheet'
import { decryptAdmissionValue } from '@/lib/admission/security'
import { allowRequest } from '@/lib/dossie/http'
import { loadSheetMeta } from '@/lib/positionSheetServer'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Processos encerrados não entram: a planilha é dos novos colaboradores em fase de admissão.
const CLOSED_STATUSES = ['DRAFT', 'CANCELLED', 'EXPIRED', 'SYNCED', 'COMPLETED']

/** Exporta para Excel os dados completos das admissões com toda a documentação aprovada. */
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const role = session!.user.actualRole ?? session!.user.role
  // A planilha contém CPF, dados bancários e PCD: mesmo critério de acesso aos dados sensíveis da admissão.
  if (!['ADMIN', 'ANALYST'].includes(role)) return NextResponse.json({ error: 'Sem permissão para exportar dados sensíveis.' }, { status: 403 })
  if (!allowRequest(`new-hires-sheet:${session!.user.id}`, 6, 60_000)) return NextResponse.json({ error: 'Aguarde um instante antes de exportar novamente.' }, { status: 429 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 500) : []
  const where: Record<string, any> = { processType: 'ADMISSION', status: { notIn: CLOSED_STATUSES } }
  enforceUnitFilter(where, session!, typeof body.unitId === 'string' ? body.unitId : null, 'unitId')
  if (ids.length) where.id = { in: ids }

  const admissions = await prisma.admission.findMany({
    where, orderBy: { candidateName: 'asc' },
    include: {
      unit: { select: { name: true } }, analysts: { select: { id: true } },
      documents: { select: { status: true, type: { select: { required: true } } } },
      fields: { select: { key: true, value: true, sensitive: true } },
      dependents: { orderBy: { birthDate: 'asc' } },
      transport: { include: { routes: { orderBy: { position: 'asc' } } } },
    },
  })
  const eligible = admissions.filter((admission) => canAccessAdmission(session!, admission)
    && admission.documents.length > 0 && !pendingRequiredDocuments(admission.documents).length)
  if (!eligible.length) return NextResponse.json({ error: 'Nenhuma admissão com a documentação aprovada foi encontrada.' }, { status: 404 })

  const hires: NewHire[] = eligible.map((admission) => ({
    ...admission, unit: admission.unit.name,
    fields: Object.fromEntries(admission.fields.map((field) => [field.key, field.sensitive ? decryptAdmissionValue(field.value) : field.value])),
    transport: admission.transport && { requested: admission.transport.requested, refusalReason: admission.transport.refusalReason, routes: admission.transport.routes },
  }))
  const meta = await loadSheetMeta(session!.user.name ?? 'Usuário')
  const workbook = await buildNewHiresWorkbook(hires, meta)
  const buffer = await workbook.xlsx.writeBuffer()

  const ip = extractIp(req.headers), userAgent = req.headers.get('user-agent')
  await Promise.all(eligible.map((admission) => logAdmissionEvent({
    admissionId: admission.id, actorId: session!.user.id, actorName: session!.user.name,
    actorType: 'USER', action: 'NEW_HIRES_SHEET_EXPORTED', ip, userAgent, metadata: { total: eligible.length },
  }).catch(() => {})))

  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="novos-colaboradores-${date}.xlsx"`,
      'Cache-Control': 'no-store',
      'X-Total-Rows': String(eligible.length),
    },
  })
}
