import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contractHoldUnitIds, setContractHoldUnitIds } from '@/lib/admission/contractHold'
import { extractIp, log } from '@/lib/audit'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { isFaceVerificationEnabled } from '@/lib/admission/features'

export async function GET() {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (session!.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const faceProvider = process.env.FACE_VERIFICATION_PROVIDER || 'mock'
  const faceVerificationEnabled = isFaceVerificationEnabled()
  const [units, holdUnitIds] = await Promise.all([prisma.unit.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }), contractHoldUnitIds()])
  return NextResponse.json({
    contractHold: { units, unitIds: holdUnitIds },
    providers: {
      face: faceVerificationEnabled ? faceProvider : 'disabled',
      signature: process.env.SIGNATURE_PROVIDER || 'mock',
      erpnext: process.env.ADMISSION_ERPNEXT_PROVIDER || 'mock',
      notifications: process.env.ADMISSION_NOTIFICATION_PROVIDER || 'mock',
    },
    faceVerification: {
      enabled: faceVerificationEnabled,
      configured: faceVerificationEnabled && (faceProvider === 'mock' || Boolean(process.env.COMPREFACE_URL && process.env.COMPREFACE_API_KEY)),
      autoApprove: process.env.COMPREFACE_AUTO_APPROVE === 'true',
      autoReject: process.env.COMPREFACE_AUTO_REJECT === 'true',
      approveThreshold: Number(process.env.COMPREFACE_APPROVE_THRESHOLD || 0.75),
      reviewThreshold: Number(process.env.COMPREFACE_REVIEW_THRESHOLD || 0.45),
      detectionThreshold: Number(process.env.COMPREFACE_DETECTION_THRESHOLD || 0.8),
      referenceDocumentKeys: (process.env.COMPREFACE_REFERENCE_DOCUMENT_KEYS || 'rg_frente').split(',').map((key) => key.trim()).filter(Boolean),
    },
    retentionDays: Number(process.env.ADMISSION_RETENTION_DAYS || 3650),
    maxFileSize: Number(process.env.ADMISSION_MAX_FILE_SIZE || 15728640),
    transportDeclarationVersion: process.env.VT_DECLARATION_VERSION || 'v1',
  })
}

/** Unidades com a assinatura de contrato em espera (contrato e termos não são gerados nem assinados). */
export async function PUT(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (session!.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!Array.isArray(body?.contractHoldUnitIds)) return NextResponse.json({ error: 'Lista de unidades inválida.' }, { status: 400 })
  const requested = body.contractHoldUnitIds.filter((id: unknown): id is string => typeof id === 'string')
  const units = await prisma.unit.findMany({ where: { id: { in: requested } }, select: { id: true, name: true } })
  const before = await contractHoldUnitIds()
  await setContractHoldUnitIds(units.map((unit) => unit.id))
  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'UPDATE', entity: 'Admissão Digital', entityName: 'Assinatura de contrato em espera',
    details: { antes: before, depois: units.map((unit) => unit.name) }, ip: extractIp(req.headers),
  })
  return NextResponse.json({ unitIds: units.map((unit) => unit.id) })
}
