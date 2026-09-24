import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMutableAdmissionByPublicToken } from '@/lib/admission/service'
import { getSignatureProvider } from '@/lib/admission/providers'
import { generateAdmissionDocuments } from '@/lib/admission/documentGenerator'
import { createSignedDocument } from '@/lib/admission/signedDocument'
import { detectMime, savePrivateAdmissionFile } from '@/lib/admission/storage'
import { logAdmissionEvent } from '@/lib/admission/audit'
import { extractIp } from '@/lib/audit'
import { isFaceVerificationEnabled } from '@/lib/admission/features'

function numberField(form: FormData, key: string) {
  const value = Number(form.get(key))
  return Number.isFinite(value) ? value : null
}

export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const token = await getMutableAdmissionByPublicToken(params.token)
  if (!token) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  if (!['CONTRACT_PENDING', 'SIGNATURE_PENDING'].includes(token.admission.status)) {
    return NextResponse.json({ error: 'A admissão ainda não está pronta para assinatura.' }, { status: 409 })
  }
  const form = await req.formData().catch(() => null)
  if (!form || form.get('accepted') !== 'true') return NextResponse.json({ error: 'Confirme a leitura e concordância.' }, { status: 400 })
  if (form.get('locationConsent') !== 'true') return NextResponse.json({ error: 'Autorize o registro da localização para assinar.' }, { status: 400 })
  const signatureFile = form.get('signature')
  if (!(signatureFile instanceof File) || !signatureFile.size || signatureFile.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Faça sua assinatura no campo indicado.' }, { status: 400 })
  }
  const signatureBuffer = Buffer.from(await signatureFile.arrayBuffer())
  const detected = detectMime(signatureBuffer)
  if (!detected || !['image/png', 'image/jpeg'].includes(detected.mime)) {
    return NextResponse.json({ error: 'A assinatura enviada é inválida.' }, { status: 400 })
  }
  const latitude = numberField(form, 'latitude'), longitude = numberField(form, 'longitude'), accuracy = numberField(form, 'accuracy')
  if (latitude == null || longitude == null || accuracy == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || accuracy < 0) {
    return NextResponse.json({ error: 'Não foi possível validar a localização do dispositivo.' }, { status: 400 })
  }
  if (token.admission.documents.some((document) => document.type.required && document.status !== 'APPROVED')) {
    return NextResponse.json({ error: 'Ainda existem documentos obrigatórios pendentes.' }, { status: 409 })
  }
  if (isFaceVerificationEnabled() && token.admission.faceVerifications[0]?.status !== 'APPROVED') {
    return NextResponse.json({ error: 'A validação facial precisa estar aprovada.' }, { status: 409 })
  }

  const docs = token.admission.generatedDocuments.length ? token.admission.generatedDocuments : await generateAdmissionDocuments(token.admissionId, req.nextUrl.origin)
  const signatureSaved = await savePrivateAdmissionFile(token.admissionId, 'signatures', new File([signatureBuffer], 'assinatura.png', { type: detected.mime }))
  const signatureHash = createHash('sha256').update(signatureBuffer).digest('hex')
  const ip = extractIp(req.headers), userAgent = req.headers.get('user-agent')
  let signatureProvider: ReturnType<typeof getSignatureProvider>
  try { signatureProvider = getSignatureProvider() }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Provedor de assinatura indisponível.' }, { status: 503 }) }
  const providerName = signatureProvider.name

  for (const doc of docs) {
    if (!doc.storagePath) throw new Error('Documento original indisponível para assinatura.')
    const envelope = await prisma.signatureEnvelope.upsert({
      where: { documentId: doc.id },
      update: {},
      create: { admissionId: token.admissionId, documentId: doc.id, provider: providerName, signerName: token.admission.candidateName, signerEmail: token.admission.candidateEmail, status: 'AUTHENTICATED' },
    })
    if (envelope.status === 'SIGNED') continue
    const signed = await signatureProvider.provider.sign(envelope.id)
    const finalDocument = await createSignedDocument({
      admissionId: token.admissionId, documentId: doc.id, storagePath: doc.storagePath,
      validationCode: doc.validationCode, originalHash: doc.originalHash,
      signerName: token.admission.candidateName, signedAt: signed.signedAt, transactionId: signed.transactionId,
      ip, userAgent, latitude, longitude, locationAccuracy: accuracy,
      signature: signatureBuffer, signatureMimeType: detected.mime,
    })
    await prisma.$transaction([
      prisma.signatureEnvelope.update({ where: { id: envelope.id }, data: {
        provider: providerName, status: 'SIGNED', transactionId: signed.transactionId, signedAt: signed.signedAt,
        signaturePath: signatureSaved.storagePath, signatureMimeType: detected.mime, signatureHash,
        signedIp: ip, signedUserAgent: userAgent, latitude, longitude, locationAccuracy: accuracy,
      } }),
      prisma.signatureEvent.create({ data: { envelopeId: envelope.id, type: 'SIGNED', ip, userAgent, hash: finalDocument.finalHash, metadata: { provider: providerName, latitude, longitude, accuracy, locationSource: 'browser-geolocation-unverified', locationConsent: true, consentVersion: process.env.SIGNATURE_CONSENT_VERSION || 'v1' } } }),
      prisma.generatedDocument.update({ where: { id: doc.id }, data: { status: 'SIGNED', signedAt: signed.signedAt, signedStoragePath: finalDocument.storagePath, finalHash: finalDocument.finalHash } }),
    ])
  }

  await prisma.$transaction([
    prisma.admission.update({ where: { id: token.admissionId }, data: { status: 'READY_FOR_ERPNEXT', currentStep: 'conclusao', progress: 100, lastActivityAt: new Date() } }),
    prisma.eRPNextSync.upsert({ where: { idempotencyKey: `admission:${token.admissionId}` }, create: { admissionId: token.admissionId, idempotencyKey: `admission:${token.admissionId}`, status: 'WAITING', nextAttemptAt: new Date() }, update: { status: 'WAITING', nextAttemptAt: new Date(), lastError: null } }),
    prisma.consentRecord.create({ data: { admissionId: token.admissionId, type: 'ELECTRONIC_SIGNATURE', version: process.env.SIGNATURE_CONSENT_VERSION || 'v1', accepted: true, ip, userAgent } }),
    prisma.consentRecord.create({ data: { admissionId: token.admissionId, type: 'SIGNATURE_GEOLOCATION', version: process.env.SIGNATURE_CONSENT_VERSION || 'v1', accepted: true, ip, userAgent } }),
  ])
  await logAdmissionEvent({ admissionId: token.admissionId, actorName: token.admission.candidateName, actorType: 'CANDIDATE', action: 'DOCUMENTS_SIGNED', ip, userAgent, metadata: { documentCount: docs.length, provider: providerName } })
  return NextResponse.json({ success: true, protocol: token.admission.protocol })
}
