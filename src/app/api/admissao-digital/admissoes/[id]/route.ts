import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analystCanAccessUnit, forbidIfReadOnly, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { createAdmissionToken } from '@/lib/admission/service'
import { assertTransition } from '@/lib/admission/stateMachine'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp, log } from '@/lib/audit'
import { deleteAdmissionStorage } from '@/lib/admission/storage'
import { decryptAdmissionValue } from '@/lib/admission/security'
import { notifyAdmissionCandidate } from '@/lib/admission/notifications'
import { updateEmployee } from '@/lib/erpnextClient'
import { savePerfil } from '@/lib/dossie/perfil'

const include = {
  unit: true, candidate: { select: { id: true, nome: true, email: true, telefone: true } }, vacancy: true,
  owner: { select: { id: true, name: true } }, tokens: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { expiresAt: true, revokedAt: true, tokenHint: true } },
  fields: true, dependents: true, transport: { include: { routes: true } }, documents: { include: { type: true, reviewedBy: { select: { name: true } } }, orderBy: { type: { position: 'asc' as const } } },
  badgePhotos: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { id: true, confirmedAt: true, createdAt: true } },
  faceVerifications: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { id: true, provider: true, status: true, attempts: true, resultMetadata: true, completedAt: true, capturedAt: true, createdAt: true, updatedAt: true } },
  generatedDocuments: { select: { id: true, status: true, templateVersion: true, generatedAt: true, signedAt: true, validationCode: true, originalHash: true, finalHash: true, template: { select: { key: true, name: true } } } },
  signatureEnvelopes: { select: { id: true, documentId: true, provider: true, signerName: true, signerEmail: true, status: true, transactionId: true, signedAt: true, signedIp: true, signedUserAgent: true, latitude: true, longitude: true, locationAccuracy: true, events: { orderBy: { createdAt: 'desc' as const }, select: { id: true, type: true, ip: true, userAgent: true, hash: true, metadata: true, createdAt: true } } } },
  erpnextSyncs: { orderBy: { createdAt: 'desc' as const } }, auditLogs: { orderBy: { createdAt: 'desc' as const }, take: 100 },
}

export async function GET(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized();if (error) return error
  const item = await prisma.admission.findUnique({ where: { id: params.id }, include })
  if (!item) return NextResponse.json({ error: 'Admissão não encontrada.' }, { status: 404 })
  if (!analystCanAccessUnit(session!, item.unitId)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  const canViewSensitiveData = ['ADMIN', 'ANALYST'].includes(session!.user.actualRole ?? session!.user.role)
  const response = canViewSensitiveData ? {
    ...item,
    fields: item.fields.map((field) => ({ ...field, value: field.sensitive ? decryptAdmissionValue(field.value) : field.value })),
  } : { ...item, fields: [], dependents: [], transport: null, badgePhotos: [], faceVerifications: [], signatureEnvelopes: [] }
  return NextResponse.json(response)
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized();if (error) return error
  const actualRole = session!.user.actualRole ?? session!.user.role
  const forbidden = forbidIfReadOnly(actualRole);if (forbidden) return forbidden
  const current = await prisma.admission.findUnique({ where: { id: params.id } })
  if (!current) return NextResponse.json({ error: 'Admissão não encontrada.' }, { status: 404 })
  if (!analystCanAccessUnit(session!, current.unitId)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  const body = await req.json().catch(() => ({}));const action = String(body.action || '')
  let response: Record<string, unknown> = {}
  if (action === 'renew-link' || action === 'resend-link') {
    const link = await createAdmissionToken(current.id, Number(body.validityDays || 7))
    if (current.status === 'EXPIRED') await prisma.admission.update({ where: { id: current.id }, data: { status: 'LINK_SENT', lastActivityAt: new Date() } })
    const publicUrl = `${process.env.NEXTAUTH_URL || req.nextUrl.origin}/admissao/${link.token}`
    await notifyAdmissionCandidate({ ...current, title: action === 'renew-link' ? 'Novo link da admissão' : 'Lembrete da admissão digital', message: 'Use o link abaixo para continuar seu processo de admissão.', portalUrl: publicUrl })
    response = { publicUrl, expiresAt: link.expiresAt }
  } else if (action === 'invalidate-link') {
    await prisma.admissionToken.updateMany({ where: { admissionId: current.id, revokedAt: null }, data: { revokedAt: new Date() } })
  } else if (action === 'cancel') {
    assertTransition(current.status, 'CANCELLED')
    await prisma.admission.update({ where: { id: current.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: String(body.reason || 'Cancelado pelo RH') } })
  } else if (action === 'retry-erpnext') {
    if (!['ERPNEXT_ERROR', 'READY_FOR_ERPNEXT'].includes(current.status)) return NextResponse.json({ error: 'A integração não pode ser reprocessada neste status.' }, { status: 409 })
    await prisma.$transaction([
      prisma.admission.update({ where: { id: current.id }, data: { status: 'SYNCING', lastActivityAt: new Date() } }),
      prisma.eRPNextSync.upsert({ where: { idempotencyKey: `admission:${current.id}` }, create: { admissionId: current.id, idempotencyKey: `admission:${current.id}`, status: 'RETRYING', nextAttemptAt: new Date() }, update: { status: 'RETRYING', nextAttemptAt: new Date(), lastError: null } }),
    ])
  } else if (action === 'apply-registration-update') {
    if (current.processType !== 'REGISTRATION_UPDATE' || !current.collaboratorId) return NextResponse.json({ error: 'Este processo não é uma atualização cadastral.' }, { status: 409 })
    if (current.status !== 'DOCUMENTS_UNDER_REVIEW') return NextResponse.json({ error: 'A atualização ainda não foi enviada para revisão.' }, { status: 409 })
    const process = await prisma.admission.findUnique({ where: { id: current.id }, include: { fields: true, documents: true, collaborator: true } })
    if (!process?.collaborator) return NextResponse.json({ error: 'Colaborador vinculado não encontrado.' }, { status: 404 })
    const pendingDocuments = process.documents.filter(document => document.status !== 'APPROVED')
    if (pendingDocuments.length) return NextResponse.json({ error: `Ainda existem ${pendingDocuments.length} documento(s) sem aprovação.` }, { status: 409 })
    const values = Object.fromEntries(process.fields.map(field => [field.key, field.sensitive ? decryptAdmissionValue(field.value) : field.value]))
    const erpData: Record<string, unknown> = {}
    const erpMap: Record<string, string> = { name: 'employee_name', email: 'personal_email', phone: 'cell_number', birthDate: 'date_of_birth', gender: 'gender', cpf: 'custom_cpf', rg: 'custom_rg', ethnicity: 'custom_etnia', birthCity: 'custom_naturalidade_cidade' }
    for (const [field, target] of Object.entries(erpMap)) if (values[field] !== undefined && values[field] !== '') erpData[target] = values[field]
    try {
      if (Object.keys(erpData).length) await updateEmployee(process.collaborator.erpnextId, erpData)
      const address = { cep: String(values.zipCode || ''), logradouro: String(values.street || ''), numero: String(values.number || ''), complemento: String(values.complement || ''), bairro: String(values.district || ''), cidade: String(values.city || ''), uf: String(values.state || '') }
      const banco = { banco: String(values.bank || ''), agencia: String(values.agency || ''), conta: String(values.account || ''), digito: String(values.accountDigit || ''), tipo: String(values.accountType || '') }
      await savePerfil(process.collaborator.id, { nomeMae: String(values.motherName || '') || undefined, nomePai: String(values.fatherName || '') || undefined, estadoCivil: String(values.maritalStatus || '') || undefined, escolaridade: String(values.education || '') || undefined, rgOrgao: String(values.rgIssuer || '') || undefined, rgEmissao: String(values.rgIssuedAt || '') || undefined, pis: String(values.pis || '') || undefined, ...(current.requestedSections.includes('address') ? { endereco: address } : {}), ...(current.requestedSections.includes('bank') ? { banco } : {}) }, { id: session!.user.id, name: session!.user.name })
      await prisma.$transaction([
        prisma.colaborador.update({ where: { id: process.collaborator.id }, data: { employeeName: String(values.name || process.collaborator.employeeName), personalEmail: String(values.email || '') || null, cellNumber: String(values.phone || '') || null, gender: String(values.gender || '') || null, cpf: String(values.cpf || '') || null, rg: String(values.rg || '') || null, etnia: String(values.ethnicity || '') || null, naturalidade: String(values.birthCity || '') || null, syncedAt: new Date() } }),
        prisma.admission.update({ where: { id: current.id }, data: { status: 'COMPLETED', completedAt: new Date(), lastActivityAt: new Date() } }),
        prisma.colaboradorHistorico.create({ data: { colaboradorId: process.collaborator.id, tipo: 'ATUALIZACAO_CADASTRAL', dataEvento: new Date(), titulo: `Atualização cadastral ${current.protocol} aprovada`, novo: current.requestedSections.join(', '), responsavelId: session!.user.id, responsavelNome: session!.user.name } }),
      ])
      await notifyAdmissionCandidate({ ...current, title: 'Atualização cadastral aprovada', message: 'O RH conferiu e aprovou sua atualização cadastral.' })
      response = { updated: true, employeeId: process.collaborator.erpnextId }
    } catch (caught) { return NextResponse.json({ error: caught instanceof Error ? caught.message : 'Não foi possível atualizar o ERPNext.' }, { status: 502 }) }
  } else if (action === 'approve-face' || action === 'request-face-retry' || action === 'request-badge-retry') {
    if (!['ADMIN', 'ANALYST'].includes(actualRole)) {
      return NextResponse.json({ error: 'Sem permissão para revisar biometria.' }, { status: 403 })
    }
    if (action === 'request-badge-retry') {
      const reason = String(body.reason || '').trim()
      if (!reason) return NextResponse.json({ error: 'Informe o motivo para solicitar uma nova foto.' }, { status: 400 })
      await prisma.$transaction([
        prisma.badgePhoto.updateMany({ where: { admissionId: current.id, confirmedAt: { not: null } }, data: { confirmedAt: null } }),
        prisma.admission.update({ where: { id: current.id }, data: { currentStep: 'foto', status: 'CORRECTION_REQUESTED', lastActivityAt: new Date() } }),
      ])
      await notifyAdmissionCandidate({ ...current, title: 'Reenvio da foto do crachá', message: `O RH solicitou uma nova foto para o crachá. Motivo: ${reason}. Acesse o mesmo link da admissão para reenviar.` })
      response = { requested: true }
    } else {
    const verification = await prisma.faceVerification.findFirst({ where: { admissionId: current.id }, orderBy: { createdAt: 'desc' } })
    if (!verification) return NextResponse.json({ error: 'Validação facial não encontrada.' }, { status: 404 })
    if (action === 'approve-face') {
      if (!['FACE_VALIDATION_PENDING', 'DOCUMENTS_APPROVED'].includes(current.status)) {
        return NextResponse.json({ error: 'A validação facial não pode ser aprovada neste status.' }, { status: 409 })
      }
      await prisma.$transaction([
        prisma.faceVerification.update({ where: { id: verification.id }, data: { status: 'APPROVED', completedAt: new Date() } }),
        prisma.admission.update({ where: { id: current.id }, data: { status: 'CONTRACT_PENDING', currentStep: 'revisao', progress: { set: Math.max(74, current.progress) }, lastActivityAt: new Date() } }),
      ])
    } else {
      if (current.status !== 'FACE_VALIDATION_PENDING') {
        return NextResponse.json({ error: 'Não é possível solicitar nova captura neste status.' }, { status: 409 })
      }
      await prisma.$transaction([
        prisma.faceVerification.update({ where: { id: verification.id }, data: { status: 'REJECTED', completedAt: null } }),
        prisma.admission.update({ where: { id: current.id }, data: { currentStep: 'validacao-facial', lastActivityAt: new Date() } }),
      ])
      await notifyAdmissionCandidate({ ...current, title: 'Nova validação facial solicitada', message: `Não foi possível concluir a validação facial${body.reason ? `: ${String(body.reason)}` : '.'} Acesse o mesmo link da admissão e faça uma nova captura.` })
    }
    }
  } else return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  await logAdmissionEvent({ admissionId: current.id, actorId: session!.user.id, actorName: session!.user.name, actorType: 'USER', action: action.toUpperCase().replace(/-/g, '_'), ip: extractIp(req.headers), userAgent: req.headers.get('user-agent'), metadata: { reason: body.reason } })
  return NextResponse.json({ success: true, ...response })
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized();if (error) return error
  if ((session!.user.actualRole ?? session!.user.role) !== 'ADMIN') return NextResponse.json({ error: 'Somente administradores podem excluir admissões.' }, { status: 403 })
  const current = await prisma.admission.findUnique({ where: { id: params.id }, select: { id: true, protocol: true, status: true, unitId: true, erpnextSyncs: { select: { status: true } } } })
  if (!current) return NextResponse.json({ error: 'Admissão não encontrada.' }, { status: 404 })
  if (['SYNCED', 'COMPLETED'].includes(current.status) || current.erpnextSyncs.some((sync) => sync.status === 'SUCCESS')) {
    return NextResponse.json({ error: 'Admissões já integradas ao ERPNext não podem ser excluídas. Cancele o processo.' }, { status: 409 })
  }
  // Os registros relacionados (dados, documentos, biometria, assinaturas, auditoria da admissão) saem por cascade.
  await prisma.admission.delete({ where: { id: current.id } })
  const filesRemoved = await deleteAdmissionStorage(current.id)
  // A auditoria da admissão é apagada junto; o rastro da exclusão fica no log global.
  await log({ userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role, action: 'DELETE', entity: 'Admission', entityId: current.id, entityName: current.protocol, details: { status: current.status, unitId: current.unitId, filesRemoved }, ip: extractIp(req.headers) })
  return NextResponse.json({ success: true })
}
