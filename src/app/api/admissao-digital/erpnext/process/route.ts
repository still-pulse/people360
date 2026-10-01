import { NextRequest, NextResponse } from 'next/server'
import { contractHoldUnitIds } from '@/lib/admission/contractHold'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { getERPNextAdmissionProvider as resolveERPNextAdmissionProvider } from '@/lib/admission/providers'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { pushAdmissionDocumentsToErpnext } from '@/lib/admission/erpnextDocuments'
import { sendDossierToErpnext } from '@/lib/dossie/erpnextDossie'
import { linkAdmissionCollaborator } from '@/lib/admission/collaboratorLink'
import { extractIp } from '@/lib/audit'

const mockERPNextAdmissionProvider = {
  sync: (admissionId: string, mode?: string) => resolveERPNextAdmissionProvider().sync(admissionId, process.env.NODE_ENV === 'production' ? undefined : mode),
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (!['ADMIN', 'ANALYST'].includes(session!.user.role)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))

  // Unidades com contrato em espera não vão ao ERPNext/eSocial: os pedidos ficam aguardando até a liberação.
  const holdUnitIds = await contractHoldUnitIds()
  if (body.admissionId && holdUnitIds.length) {
    const target = await prisma.admission.findUnique({ where: { id: body.admissionId }, select: { unitId: true } })
    if (target && holdUnitIds.includes(target.unitId)) {
      return NextResponse.json({ error: 'A unidade desta admissão está com a assinatura de contrato em espera. Libere em Admissão Digital → Configurações antes de integrar ao ERPNext.' }, { status: 409 })
    }
  }

  const jobs = await prisma.eRPNextSync.findMany({
    where: {
      ...(body.admissionId ? { admissionId: body.admissionId } : {}),
      admission: { status: { not: 'CANCELLED' }, ...(holdUnitIds.length ? { unitId: { notIn: holdUnitIds } } : {}) },
      status: { in: ['WAITING', 'RETRYING', 'ERROR'] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })
  const results = []
  for (const job of jobs) {
    const claimed = await prisma.$transaction(async (tx) => {
      const active = await tx.admission.updateMany({ where: { id: job.admissionId, status: { not: 'CANCELLED' } }, data: { status: 'SYNCING' } })
      if (!active.count) {
        await tx.eRPNextSync.updateMany({ where: { id: job.id }, data: { status: 'CANCELLED', nextAttemptAt: null } })
        return false
      }
      await tx.eRPNextSync.update({ where: { id: job.id }, data: { status: 'PROCESSING', attempts: { increment: 1 } } })
      return true
    })
    if (!claimed) continue

    try {
      const result = await mockERPNextAdmissionProvider.sync(job.admissionId, body.mockMode)
      await prisma.$transaction([
        prisma.eRPNextSync.update({ where: { id: job.id }, data: { status: 'SUCCESS', employeeId: result.employeeId, employeeCode: result.employeeCode, lastSyncedAt: new Date(), lastError: null, nextAttemptAt: null } }),
        prisma.admission.update({ where: { id: job.admissionId }, data: { status: 'COMPLETED', completedAt: new Date(), lastActivityAt: new Date() } }),
      ])
      await logAdmissionEvent({ admissionId: job.admissionId, actorId: session!.user.id, actorName: session!.user.name, actorType: 'USER', action: 'ERPNEXT_SYNC_SUCCESS', metadata: { attempt: job.attempts + 1, employeeCode: result.employeeCode } })
      const documents = await pushAdmissionDocumentsToErpnext(job.admissionId, result.employeeId, { id: session!.user.id, name: session!.user.name })
      // Cria o colaborador no People360 e importa a admissão para o dossiê; a falha fica no histórico da admissão.
      const collaborator = await linkAdmissionCollaborator(job.admissionId, { id: session!.user.id, name: session!.user.name || 'Usuário do RH' }, extractIp(req.headers))
      const dossie = collaborator.ok
        ? await sendDossierToErpnext(collaborator.colaboradorId, `Admissão ${result.employeeCode}`, { id: session!.user.id, name: session!.user.name })
        : { sent: false, skipped: collaborator.error }
      results.push({ id: job.id, status: 'SUCCESS', documents, collaborator, dossie })
    } catch (caught) {
      const attempts = job.attempts + 1
      const backoff = Math.min(60, 2 ** attempts)
      await prisma.$transaction([
        prisma.eRPNextSync.update({ where: { id: job.id }, data: { status: attempts >= 5 ? 'ERROR' : 'RETRYING', lastError: caught instanceof Error ? caught.message : 'Falha temporária', nextAttemptAt: attempts >= 5 ? null : new Date(Date.now() + backoff * 60000) } }),
        prisma.admission.update({ where: { id: job.admissionId }, data: { status: 'ERPNEXT_ERROR', lastActivityAt: new Date() } }),
      ])
      await logAdmissionEvent({ admissionId: job.admissionId, actorId: session!.user.id, actorName: session!.user.name, actorType: 'USER', action: 'ERPNEXT_SYNC_ERROR', metadata: { attempt: attempts, retryInMinutes: attempts >= 5 ? null : backoff } })
      results.push({ id: job.id, status: 'ERROR' })
    }
  }
  return NextResponse.json({ processed: results.length, results })
}
