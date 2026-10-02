import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ session: vi.fn(), readOnly: vi.fn(), access: vi.fn(), admission: vi.fn(), build: vi.fn(), audit: vi.fn(), compress: vi.fn(), rate: vi.fn() }))
vi.mock('@/lib/apiHelpers', () => ({ getSessionOrUnauthorized: mocks.session, forbidIfReadOnly: mocks.readOnly, canAccessAdmission: mocks.access }))
vi.mock('@/lib/prisma', () => ({ prisma: { admission: { findUnique: mocks.admission } } }))
vi.mock('@/lib/dossie/legalDossier', () => ({ buildAdmissionLegalDossier: mocks.build }))
vi.mock('@/lib/admission/audit', () => ({ logAdmissionEvent: mocks.audit }))
vi.mock('@/lib/pdfCompress', () => ({ compressPdf: mocks.compress }))
vi.mock('@/lib/dossie/http', () => ({ allowRequest: mocks.rate, pdfResponse: (buffer: Buffer) => new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf' } }) }))
import { POST } from '@/app/api/admissao-digital/admissoes/[id]/dossie-juridico/route'

const props = { params: Promise.resolve({ id: 'admissao-1' }) }
const request = () => new NextRequest('http://localhost/api/admissao-digital/admissoes/admissao-1/dossie-juridico', { method: 'POST' })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ session: { user: { id: 'analista', name: 'Analista', role: 'ADMIN' } } })
  mocks.readOnly.mockReturnValue(null)
  mocks.access.mockReturnValue(true)
  mocks.rate.mockReturnValue(true)
  mocks.admission.mockResolvedValue({ id: 'admissao-1', processType: 'ADMISSION' })
  mocks.build.mockResolvedValue({ buffer: Buffer.from('%PDF-1.4'), pages: 4, documents: 2, fileName: 'Dossie_Juridico.pdf' })
  mocks.compress.mockImplementation(async (buffer: Buffer) => ({ buffer }))
})

describe('acesso ao dossiê jurídico admissional', () => {
  it('bloqueia o acesso a outra unidade antes de ler documentos', async () => {
    mocks.access.mockReturnValue(false)
    expect((await POST(request(), props)).status).toBe(403)
    expect(mocks.build).not.toHaveBeenCalled()
  })

  it('respeita o perfil de somente leitura', async () => {
    mocks.readOnly.mockReturnValue(NextResponse.json({ error: 'Sem permissão' }, { status: 403 }))
    expect((await POST(request(), props)).status).toBe(403)
    expect(mocks.admission).not.toHaveBeenCalled()
    expect(mocks.build).not.toHaveBeenCalled()
  })

  it('registra a exportação jurídica sem liberar a etapa da contabilidade', async () => {
    const response = await POST(request(), props)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(mocks.build).toHaveBeenCalledWith('admissao-1')
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'LEGAL_DOSSIER_GENERATED', admissionId: 'admissao-1' }))
  })

  it('informa quando não há contratos ou termos assinados', async () => {
    mocks.build.mockRejectedValue(new Error('Ainda não há contratos ou termos assinados disponíveis.'))
    const response = await POST(request(), props)
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'Ainda não há contratos ou termos assinados disponíveis.' })
    expect(mocks.audit).not.toHaveBeenCalled()
  })
})
