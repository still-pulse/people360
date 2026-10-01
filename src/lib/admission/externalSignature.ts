import { createHash } from 'crypto'
import { PDFDocument } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import {
  autentiqueSandbox, createAutentiqueDocument, createAutentiqueSignatureLink, deleteAutentiqueDocument, downloadAutentiqueFile, getAutentiqueDocument,
  type AutentiqueSignature,
} from '@/lib/autentique'
import { logAdmissionEvent } from './audit'
import { generateAdmissionDocuments } from './documentGenerator'
import { readPrivateAdmissionFile, savePrivateAdmissionFile } from './storage'

// Assinatura pela Autentique: todos os documentos da admissão vão num PDF único (1 crédito); o candidato
// assina pelo link exclusivo dele. Na volta (webhook ou consulta), o PDF assinado é separado de novo por
// documento, cada parte levando as páginas de certificação que a Autentique acrescenta ao final.

export const AUTENTIQUE_PROVIDER = 'autentique'

type PageRange = { documentId: string; name: string; start: number; end: number }
type Meta = { ip?: string | null; userAgent?: string | null }

const pdfFile = (bytes: Uint8Array, name: string) => new File([new Uint8Array(bytes)], name, { type: 'application/pdf' })
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/** Assinatura do candidato no documento da Autentique (a conta dona do documento pode aparecer na lista). */
function candidateSignature(signatures: AutentiqueSignature[], signer: { name: string; email?: string | null; publicId?: string | null }) {
  const email = signer.email?.trim().toLowerCase()
  return signatures.find((signature) => signer.publicId && signature.public_id === signer.publicId)
    ?? signatures.find((signature) => email && signature.email?.toLowerCase() === email)
    ?? signatures.find((signature) => signature.action?.name === 'SIGN' && signature.name?.trim().toLowerCase() === signer.name.trim().toLowerCase())
    ?? signatures.find((signature) => signature.action?.name === 'SIGN')
    ?? null
}

/** Pedido de assinatura em aberto; cria um novo (pacote + envio) se ainda não houver. Idempotente. */
export async function startExternalSignature(admissionId: string, origin: string, meta: Meta = {}) {
  const latest = await latestExternalSignature(admissionId)
  if (latest?.status === 'SIGNED' || latest?.status === 'PROCESSING') return latest
  // Recusa: um novo envio consome outro crédito, então só o RH libera (ação "Reenviar para assinatura").
  if (latest?.status === 'REJECTED') throw new Error('A assinatura foi recusada. Fale com o RH para receber um novo link.')

  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: {
    protocol: true, candidateName: true, candidateEmail: true, status: true,
  } })
  if (!admission) throw new Error('Admissão não encontrada.')
  if (admission.status === 'CANCELLED') throw new Error('Esta admissão foi cancelada.')
  // Sempre reconcilia com as versões ativas. Assim, uma admissão que já aguardava assinatura troca
  // automaticamente o pacote antigo quando RH publica um novo contrato, ficha ou termo.
  await generateAdmissionDocuments(admissionId, origin)
  const documents = await prisma.generatedDocument.findMany({ where: { admissionId, status: { in: ['GENERATED', 'SENT'] } }, include: { template: { select: { name: true } } }, orderBy: { createdAt: 'asc' } })
  if (latest?.status === 'PENDING') {
    const packaged = new Set((Array.isArray(latest.pageMap) ? latest.pageMap : []).map((item) => typeof item === 'object' && item && 'documentId' in item ? String(item.documentId) : ''))
    const current = new Set(documents.map((document) => document.id))
    const currentPackage = packaged.size === current.size && [...current].every((id) => packaged.has(id))
    if (currentPackage) return latest
    await cancelExternalSignature(admissionId)
    await logAdmissionEvent({ admissionId, actorName: admission.candidateName, actorType: 'SYSTEM', action: 'AUTENTIQUE_PACKAGE_REPLACED', metadata: { previousRequestId: latest.id, documents: documents.length } })
  }
  if (!documents.length) throw new Error('Nenhum documento pendente de assinatura.')

  // Pacote único, na ordem em que os documentos foram gerados.
  const bundle = await PDFDocument.create()
  const pageMap: PageRange[] = []
  for (const document of documents) {
    const bytes = document.storagePath ? await readPrivateAdmissionFile(document.storagePath) : null
    if (!bytes) throw new Error(`Documento ${document.template.name} indisponível para assinatura.`)
    const source = await PDFDocument.load(bytes)
    const pages = await bundle.copyPages(source, source.getPageIndices())
    const start = bundle.getPageCount() + 1
    for (const page of pages) bundle.addPage(page)
    pageMap.push({ documentId: document.id, name: document.template.name, start, end: bundle.getPageCount() })
  }
  const packageBytes = await bundle.save()
  const saved = await savePrivateAdmissionFile(admissionId, 'autentique', pdfFile(packageBytes, 'pacote-admissional.pdf'))

  const created = await createAutentiqueDocument({
    name: `Admissão ${admission.protocol} — ${admission.candidateName}`,
    message: 'Documentos da sua admissão na Beneficência Hospitalar de Cesário Lange. Leia com atenção e assine.',
    file: Buffer.from(packageBytes), fileName: `admissao-${admission.protocol}.pdf`,
    signer: { name: admission.candidateName, email: admission.candidateEmail },
  })
  const signature = candidateSignature(created.signatures, { name: admission.candidateName, email: admission.candidateEmail })
  const signLink = signature?.link?.short_link ?? (signature ? await createAutentiqueSignatureLink(signature.public_id) : null)

  const request = await prisma.externalSignatureRequest.create({ data: {
    admissionId, provider: AUTENTIQUE_PROVIDER, externalId: created.id, status: 'PENDING',
    signerName: admission.candidateName, signerEmail: admission.candidateEmail, signerPublicId: signature?.public_id ?? null,
    signLink, sandbox: autentiqueSandbox(), packagePath: saved.storagePath, packageHash: sha256(packageBytes), pageMap,
  } })
  await prisma.$transaction([
    ...documents.map((document) => prisma.signatureEnvelope.upsert({
      where: { documentId: document.id },
      update: { provider: AUTENTIQUE_PROVIDER, status: 'SENT' },
      create: { admissionId, documentId: document.id, provider: AUTENTIQUE_PROVIDER, signerName: admission.candidateName, signerEmail: admission.candidateEmail, status: 'SENT' },
    })),
    prisma.generatedDocument.updateMany({ where: { id: { in: documents.map((document) => document.id) } }, data: { status: 'SENT' } }),
    prisma.admission.update({ where: { id: admissionId }, data: { status: 'SIGNATURE_PENDING', lastActivityAt: new Date() } }),
    prisma.consentRecord.create({ data: { admissionId, type: 'ELECTRONIC_SIGNATURE', version: process.env.SIGNATURE_CONSENT_VERSION || 'v1', accepted: true, ip: meta.ip, userAgent: meta.userAgent } }),
  ])
  await logAdmissionEvent({ admissionId, actorName: admission.candidateName, actorType: 'CANDIDATE', action: 'AUTENTIQUE_SENT', ip: meta.ip, userAgent: meta.userAgent, metadata: { externalId: created.id, documents: documents.length, pages: bundle.getPageCount(), sandbox: request.sandbox } })
  return request
}

/**
 * Consulta a Autentique e, se o candidato assinou, baixa o PDF assinado, separa por documento e conclui a
 * assinatura da admissão. Seguro contra chamadas simultâneas (webhook + consulta do portal).
 */
export async function syncExternalSignature(requestId: string): Promise<'PENDING' | 'SIGNED' | 'REJECTED' | 'CANCELLED'> {
  const request = await prisma.externalSignatureRequest.findUnique({ where: { id: requestId }, include: { admission: { select: { status: true } } } })
  if (!request) throw new Error('Pedido de assinatura não encontrado.')
  if (request.admission.status === 'CANCELLED') {
    if (request.status !== 'CANCELLED') await prisma.externalSignatureRequest.update({ where: { id: request.id }, data: { status: 'CANCELLED' } })
    return 'CANCELLED'
  }
  if (request.status === 'SIGNED' || request.status === 'REJECTED' || request.status === 'CANCELLED') return request.status
  if (request.status === 'PROCESSING') return 'PENDING'

  const document = await getAutentiqueDocument(request.externalId)
  const signature = candidateSignature(document.signatures, { name: request.signerName, email: request.signerEmail, publicId: request.signerPublicId })
  if (signature?.rejected) {
    const reason = signature.rejected.reason || 'Assinatura recusada pelo candidato.'
    await prisma.externalSignatureRequest.update({ where: { id: request.id }, data: { status: 'REJECTED', rejectedReason: reason } })
    await logAdmissionEvent({ admissionId: request.admissionId, actorName: request.signerName, actorType: 'CANDIDATE', action: 'AUTENTIQUE_REJECTED', ip: signature.rejected.ip, metadata: { externalId: request.externalId, reason } })
    return 'REJECTED'
  }
  if (!signature?.signed || !document.files?.signed) return 'PENDING'

  // Reserva o processamento: só uma chamada conclui.
  const claimed = await prisma.externalSignatureRequest.updateMany({ where: { id: request.id, status: 'PENDING' }, data: { status: 'PROCESSING' } })
  if (!claimed.count) return 'PENDING'
  try {
    const signedBytes = await downloadAutentiqueFile(document.files.signed)
    const signedAt = new Date(signature.signed.created_at)
    const signedIp = signature.signed.ip ?? null
    const full = await savePrivateAdmissionFile(request.admissionId, 'autentique', pdfFile(signedBytes, 'pacote-admissional-assinado.pdf'))
    const signedPdf = await PDFDocument.load(signedBytes)
    const pageMap = request.pageMap as PageRange[]
    const originalPages = pageMap[pageMap.length - 1]?.end ?? 0
    // Páginas que a Autentique acrescenta (certificado de assinatura) acompanham cada documento separado.
    const certificatePages = Array.from({ length: Math.max(0, signedPdf.getPageCount() - originalPages) }, (_, index) => originalPages + index)

    for (const range of pageMap) {
      const part = await PDFDocument.create()
      const indices = [...Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start - 1 + index), ...certificatePages]
      for (const page of await part.copyPages(signedPdf, indices)) part.addPage(page)
      const bytes = await part.save()
      const stored = await savePrivateAdmissionFile(request.admissionId, `signed-${range.documentId}`, pdfFile(bytes, 'documento-assinado.pdf'))
      const hash = sha256(bytes)
      await prisma.$transaction([
        prisma.generatedDocument.update({ where: { id: range.documentId }, data: { status: 'SIGNED', signedAt, signedStoragePath: stored.storagePath, finalHash: hash } }),
        prisma.signatureEnvelope.update({ where: { documentId: range.documentId }, data: { status: 'SIGNED', provider: AUTENTIQUE_PROVIDER, transactionId: `autentique:${request.externalId}:${range.documentId}`, signedAt, signedIp } }),
      ])
      const envelope = await prisma.signatureEnvelope.findUnique({ where: { documentId: range.documentId }, select: { id: true } })
      if (envelope) await prisma.signatureEvent.create({ data: { envelopeId: envelope.id, type: 'SIGNED', ip: signedIp, hash, metadata: { provider: AUTENTIQUE_PROVIDER, externalId: request.externalId, pages: `${range.start}-${range.end}` } } })
    }

    const finalized = await prisma.$transaction(async (tx) => {
      const active = await tx.admission.updateMany({
        where: { id: request.admissionId, status: { not: 'CANCELLED' } },
        data: { status: 'READY_FOR_ERPNEXT', currentStep: 'conclusao', progress: 100, lastActivityAt: new Date() },
      })
      if (!active.count) {
        await tx.externalSignatureRequest.update({ where: { id: request.id }, data: { status: 'CANCELLED' } })
        return false
      }
      await tx.externalSignatureRequest.update({ where: { id: request.id }, data: { status: 'SIGNED', signedPath: full.storagePath, signedHash: sha256(signedBytes), signedAt, signedIp } })
      await tx.eRPNextSync.upsert({
        where: { idempotencyKey: `admission:${request.admissionId}` },
        create: { admissionId: request.admissionId, idempotencyKey: `admission:${request.admissionId}`, status: 'WAITING', nextAttemptAt: new Date() },
        update: { status: 'WAITING', nextAttemptAt: new Date(), lastError: null },
      })
      return true
    })
    if (!finalized) return 'CANCELLED'
    await logAdmissionEvent({ admissionId: request.admissionId, actorName: request.signerName, actorType: 'CANDIDATE', action: 'DOCUMENTS_SIGNED', ip: signedIp, metadata: { provider: AUTENTIQUE_PROVIDER, externalId: request.externalId, documentCount: pageMap.length } })
    return 'SIGNED'
  } catch (error) {
    await prisma.externalSignatureRequest.update({ where: { id: request.id }, data: { status: 'PENDING' } })
    throw error
  }
}

/** Pedido mais recente da admissão (para o portal e a tela do RH). */
export function latestExternalSignature(admissionId: string) {
  return prisma.externalSignatureRequest.findFirst({ where: { admissionId }, orderBy: { createdAt: 'desc' } })
}

/** RH encerra o pedido no provedor e localmente para impedir assinatura e novos avisos. */
export async function cancelExternalSignature(admissionId: string) {
  const requests = await prisma.externalSignatureRequest.findMany({
    where: { admissionId, status: { in: ['PENDING', 'PROCESSING', 'REJECTED'] } },
    select: { id: true, provider: true, externalId: true },
  })
  for (const request of requests) {
    if (request.provider === AUTENTIQUE_PROVIDER) await deleteAutentiqueDocument(request.externalId)
  }
  return prisma.$transaction([
    prisma.externalSignatureRequest.updateMany({
      where: { id: { in: requests.map((request) => request.id) } },
      data: { status: 'CANCELLED' },
    }),
    prisma.signatureEnvelope.updateMany({
      where: { admissionId, status: { in: ['CREATED', 'SENT', 'VIEWED', 'AUTHENTICATED', 'REJECTED'] } },
      data: { status: 'CANCELLED' },
    }),
  ])
}
