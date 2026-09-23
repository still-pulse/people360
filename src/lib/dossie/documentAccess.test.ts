import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), history: vi.fn(), audit: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/dossie/permissions', () => ({ authorizeDossie: mocks.authorize }))
vi.mock('@/lib/dossie/documentHistory', () => ({ employeeDocumentHistory: mocks.history }))
vi.mock('@/lib/dossie/history', () => ({ auditDossie: mocks.audit }))
import { GET } from '@/app/api/colaboradores/[id]/documentos/arquivo/route'

const props = { params: Promise.resolve({ id: 'colaborador-1' }) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue({ ok: true, colaborador: { id: 'colaborador-1' }, actor: { id: 'analista' } })
  mocks.history.mockResolvedValue([{ id: 'upload-1', fileName: 'RG.pdf', mimeType: 'application/pdf', read: mocks.read }])
  mocks.read.mockResolvedValue(Buffer.from('%PDF-1.4'))
})

describe('acesso aos arquivos do histórico', () => {
  it('não consulta nem lê arquivos quando não há acesso à unidade', async () => {
    mocks.authorize.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Sem acesso' }, { status: 403 }) })
    const response = await GET(new NextRequest('http://localhost/api?documento=upload-1'), props)
    expect(response.status).toBe(403)
    expect(mocks.history).not.toHaveBeenCalled()
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('não entrega documento de outro colaborador mesmo sabendo seu identificador', async () => {
    const response = await GET(new NextRequest('http://localhost/api?documento=upload-outro'), props)
    expect(response.status).toBe(404)
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('entrega o documento autorizado com cache privado e registra a consulta', async () => {
    const response = await GET(new NextRequest('http://localhost/api?documento=upload-1&inline=1'), props)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-disposition')).toContain('inline')
    expect(await response.text()).toBe('%PDF-1.4')
    expect(mocks.audit).toHaveBeenCalledOnce()
  })
})
