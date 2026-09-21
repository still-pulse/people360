import { createHash } from 'crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { readPrivateAdmissionFile, savePrivateAdmissionFile } from './storage'

type SignedDocumentInput = {
  admissionId: string
  documentId: string
  storagePath: string
  validationCode?: string | null
  originalHash?: string | null
  signerName: string
  signedAt: Date
  transactionId: string
  ip?: string | null
  userAgent?: string | null
  latitude: number
  longitude: number
  locationAccuracy: number
  signature: Buffer
  signatureMimeType: string
}

// Helvetica padrão só codifica WinAnsi; qualquer outro caractere faria o pdf-lib lançar erro.
function safe(text: string) {
  return text.replace(/[^\u0020-\u007E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g, '?')
}

function wrap(text: string, font: Awaited<ReturnType<PDFDocument['embedFont']>>, size: number, width: number) {
  const lines: string[] = []
  let line = ''
  for (const word of safe(text).split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate
    else { if (line) lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

export async function createSignedDocument(input: SignedDocumentInput) {
  const original = await readPrivateAdmissionFile(input.storagePath)
  if (!original) throw new Error('Documento original indisponível para assinatura.')
  const pdf = await PDFDocument.load(original)
  const page = pdf.addPage([595.28, 841.89])
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const teal = rgb(15 / 255, 155 / 255, 142 / 255), ink = rgb(29 / 255, 43 / 255, 46 / 255), muted = rgb(93 / 255, 110 / 255, 113 / 255)
  page.drawText('REGISTRO DE ASSINATURA ELETRÔNICA', { x: 48, y: 785, size: 15, font: bold, color: ink })
  page.drawRectangle({ x: 48, y: 770, width: 499, height: 2, color: teal })
  page.drawText('Evidências vinculadas ao documento e preservadas pelo People360', { x: 48, y: 750, size: 9, font: normal, color: muted })

  const rows = [
    ['Signatário', input.signerName],
    ['Data e horário', new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(input.signedAt)],
    ['Endereço IP', input.ip || 'Não identificado'],
    ['Localização consentida', `${input.latitude.toFixed(6)}, ${input.longitude.toFixed(6)} (precisão aproximada de ${Math.round(input.locationAccuracy)} m)`],
    ['Transação', input.transactionId],
    ['Código de validação', input.validationCode || '—'],
    ['Hash SHA-256 original', input.originalHash || '—'],
  ] as const
  let y = 714
  for (const [label, value] of rows) {
    page.drawText(label.toUpperCase(), { x: 48, y, size: 7.5, font: bold, color: muted })
    y -= 14
    for (const line of wrap(value, normal, 9, 499)) { page.drawText(line, { x: 48, y, size: 9, font: normal, color: ink }); y -= 12 }
    y -= 8
  }

  const image = input.signatureMimeType === 'image/png' ? await pdf.embedPng(input.signature) : await pdf.embedJpg(input.signature)
  const scaled = image.scale(Math.min(1, 240 / image.width, 100 / image.height))
  page.drawText('ASSINATURA DO(A) CANDIDATO(A)', { x: 48, y: 388, size: 7.5, font: bold, color: muted })
  page.drawRectangle({ x: 48, y: 265, width: 300, height: 108, borderColor: rgb(.82, .87, .86), borderWidth: 1 })
  page.drawImage(image, { x: 63, y: 274, width: scaled.width, height: scaled.height })
  page.drawText(safe(input.signerName), { x: 48, y: 246, size: 10, font: bold, color: ink })
  page.drawText('Assinado eletronicamente com aceite expresso e evidências técnicas.', { x: 48, y: 229, size: 8.5, font: normal, color: muted })
  const agentLines = wrap(`Dispositivo: ${input.userAgent || 'Não identificado'}`, normal, 7, 499)
  let agentY = 195
  for (const line of agentLines) { page.drawText(line, { x: 48, y: agentY, size: 7, font: normal, color: muted }); agentY -= 10 }
  page.drawText('A geolocalização registra a posição informada pelo dispositivo mediante autorização do signatário.', { x: 48, y: 142, size: 7.5, font: normal, color: muted })
  page.drawText('A autenticidade pode ser conferida pelo código e QR Code presentes no documento original.', { x: 48, y: 129, size: 7.5, font: normal, color: muted })

  const buffer = Buffer.from(await pdf.save())
  const finalHash = createHash('sha256').update(buffer).digest('hex')
  const saved = await savePrivateAdmissionFile(input.admissionId, `signed-${input.documentId}`, new File([buffer], `documento-assinado-${input.documentId}.pdf`, { type: 'application/pdf' }))
  return { storagePath: saved.storagePath, finalHash, buffer }
}
