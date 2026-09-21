import { NextResponse } from 'next/server'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'

export async function GET() {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (session!.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const faceProvider = process.env.FACE_VERIFICATION_PROVIDER || 'mock'
  return NextResponse.json({
    providers: {
      face: faceProvider,
      signature: process.env.SIGNATURE_PROVIDER || 'mock',
      erpnext: process.env.ADMISSION_ERPNEXT_PROVIDER || 'mock',
      notifications: process.env.ADMISSION_NOTIFICATION_PROVIDER || 'mock',
    },
    faceVerification: {
      configured: faceProvider === 'mock' || Boolean(process.env.COMPREFACE_URL && process.env.COMPREFACE_API_KEY),
      autoApprove: process.env.COMPREFACE_AUTO_APPROVE === 'true',
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
