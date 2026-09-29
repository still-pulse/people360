import { createHmac } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'

// Banco e arquivos em memória: o teste cobre o pacote único e a separação do PDF assinado por documento.
const db = vi.hoisted(() => ({ requests: [] as any[], docs: new Map<string, any>(), envelopes: new Map<string, any>(), files: new Map<string, Uint8Array>(), admission: {} as any }))
const api = vi.hoisted(() => ({ create: vi.fn(), link: vi.fn(), get: vi.fn(), download: vi.fn() }))

vi.mock('@/lib/prisma', () => {
  const find = (where: any) => db.requests.filter((r) => (!where.id || r.id === where.id) && (!where.admissionId || r.admissionId === where.admissionId) && (!where.status || (typeof where.status === 'string' ? r.status === where.status : where.status.in.includes(r.status))))
  return { prisma: {
    externalSignatureRequest: {
      findFirst: async ({ where }: any) => find(where).at(-1) ?? null,
      findUnique: async ({ where }: any) => find(where)[0] ?? null,
      create: async ({ data }: any) => { const row = { id: `r${db.requests.length + 1}`, createdAt: new Date(), ...data }; db.requests.push(row); return row },
      update: async ({ where, data }: any) => Object.assign(find(where)[0], data),
      updateMany: async ({ where, data }: any) => { const rows = find(where); rows.forEach((row) => Object.assign(row, data)); return { count: rows.length } },
    },
    admission: { findUnique: async () => db.admission, update: vi.fn(async () => ({})) },
    generatedDocument: { findMany: async () => [...db.docs.values()], update: async ({ where, data }: any) => Object.assign(db.docs.get(where.id), data), updateMany: vi.fn(async () => ({})) },
    signatureEnvelope: {
      upsert: async ({ where, create }: any) => { db.envelopes.set(where.documentId, { id: `e-${where.documentId}`, ...create }); return {} },
      update: async ({ where, data }: any) => Object.assign(db.envelopes.get(where.documentId), data),
      findUnique: async ({ where }: any) => db.envelopes.get(where.documentId) ?? null,
    },
    signatureEvent: { create: vi.fn(async () => ({})) },
    consentRecord: { create: vi.fn(async () => ({})) },
    eRPNextSync: { upsert: vi.fn(async () => ({})) },
    $transaction: async (items: any[]) => Promise.all(items),
  } }
})
vi.mock('@/lib/autentique', async (importOriginal) => ({ ...(await importOriginal<object>()), autentiqueSandbox: () => true, createAutentiqueDocument: api.create, createAutentiqueSignatureLink: api.link, getAutentiqueDocument: api.get, downloadAutentiqueFile: api.download }))
vi.mock('./storage', () => ({
  readPrivateAdmissionFile: async (path: string) => db.files.get(path) ?? null,
  savePrivateAdmissionFile: async (_admission: string, category: string, file: File) => { const path = `${category}/${db.files.size}.pdf`; db.files.set(path, new Uint8Array(await file.arrayBuffer())); return { storagePath: path } },
}))
vi.mock('./audit', () => ({ logAdmissionEvent: vi.fn() }))
vi.mock('./documentGenerator', () => ({ generateAdmissionDocuments: vi.fn() }))

import { startExternalSignature, syncExternalSignature } from './externalSignature'
import { verifyAutentiqueWebhook } from '@/lib/autentique'

async function pdf(pages: number, label: string) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([200 + i, 300]).drawText(`${label}-${i + 1}`)
  doc.setTitle(label)
  return doc.save()
}

describe('assinatura pela Autentique', () => {
  beforeEach(async () => {
    db.requests.length = 0; db.docs.clear(); db.envelopes.clear(); db.files.clear(); vi.clearAllMocks()
    db.admission = { protocol: 'ADM-1', candidateName: 'Maria', candidateEmail: 'maria@example.com', status: 'CONTRACT_PENDING', generatedDocuments: [] }
    for (const [id, pages] of [['contrato', 6], ['termo', 1], ['regimento', 3]] as const) {
      db.files.set(`orig/${id}`, await pdf(pages, id))
      db.docs.set(id, { id, status: 'GENERATED', storagePath: `orig/${id}`, template: { name: id } })
    }
    db.admission.generatedDocuments = [...db.docs.values()]
    api.create.mockResolvedValue({ id: 'aut-1', name: 'x', signatures: [
      { public_id: 'owner', name: 'Alessandro', email: 'rh@bhcl', action: null, link: null },
      { public_id: 'cand', name: 'Maria', email: 'maria@example.com', action: { name: 'SIGN' }, link: null },
    ] })
    api.link.mockResolvedValue('https://assina.ae/abc')
  })

  it('envia um pacote único com o mapa de páginas e o link do candidato', async () => {
    const request = await startExternalSignature('a1', 'https://p360')
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(request).toMatchObject({ externalId: 'aut-1', signerPublicId: 'cand', signLink: 'https://assina.ae/abc', status: 'PENDING' })
    expect(request.pageMap).toEqual([
      { documentId: 'contrato', name: 'contrato', start: 1, end: 6 },
      { documentId: 'termo', name: 'termo', start: 7, end: 7 },
      { documentId: 'regimento', name: 'regimento', start: 8, end: 10 },
    ])
    // Segunda chamada reaproveita o envio (não gasta outro crédito).
    await startExternalSignature('a1', 'https://p360')
    expect(api.create).toHaveBeenCalledTimes(1)
  })

  it('separa o PDF assinado por documento, cada um com as páginas de certificado', async () => {
    const request = await startExternalSignature('a1', 'https://p360')
    const signed = await PDFDocument.load(db.files.get(request.packagePath)!)
    for (let i = 0; i < 2; i++) signed.addPage([595, 842]) // certificado da Autentique
    api.get.mockResolvedValue({ id: 'aut-1', files: { signed: 'https://api/signed.pdf' }, signatures: [{ public_id: 'cand', name: 'Maria', email: 'maria@example.com', action: { name: 'SIGN' }, link: null, signed: { created_at: '2026-09-29T12:00:00Z', ip: '1.2.3.4' }, rejected: null }] })
    api.download.mockResolvedValue(Buffer.from(await signed.save()))
    expect(await syncExternalSignature(request.id)).toBe('SIGNED')
    const pages = async (id: string) => (await PDFDocument.load(db.files.get(db.docs.get(id).signedStoragePath)!)).getPageCount()
    expect([await pages('contrato'), await pages('termo'), await pages('regimento')]).toEqual([8, 3, 5])
    expect(db.docs.get('termo').status).toBe('SIGNED')
    expect(db.envelopes.get('termo')).toMatchObject({ status: 'SIGNED', signedIp: '1.2.3.4' })
    expect(await syncExternalSignature(request.id)).toBe('SIGNED')
    expect(api.download).toHaveBeenCalledTimes(1)
  })

  it('registra a recusa e não cria novo envio sem o RH liberar', async () => {
    const request = await startExternalSignature('a1', 'https://p360')
    api.get.mockResolvedValue({ id: 'aut-1', files: null, signatures: [{ public_id: 'cand', name: 'Maria', email: 'maria@example.com', action: { name: 'SIGN' }, link: null, signed: null, rejected: { created_at: '2026-09-29T12:00:00Z', reason: 'Dados errados' } }] })
    expect(await syncExternalSignature(request.id)).toBe('REJECTED')
    await expect(startExternalSignature('a1', 'https://p360')).rejects.toThrow(/recusada/)
  })

  it('aceita só webhooks assinados com o segredo', () => {
    const body = '{"event":{"type":"document.finished"}}'
    const signature = createHmac('sha256', 'segredo').update(body).digest('hex')
    expect(verifyAutentiqueWebhook(body, signature, 'segredo')).toBe(true)
    expect(verifyAutentiqueWebhook(body, signature, 'outro')).toBe(false)
    expect(verifyAutentiqueWebhook(body, null, 'segredo')).toBe(false)
  })
})
