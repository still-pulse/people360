import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ admissions: vi.fn(), documents: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { admission: { findMany: mocks.admissions }, colaboradorDocumento: { findMany: mocks.documents } } }))
import { employeeDocumentHistory, historyMetadata, linkedAdmissionsWhere } from './documentHistory'

const employee = { id: 'colaborador', erpnextId: 'ERP-1', cpf: null }
beforeEach(() => { mocks.documents.mockResolvedValue([]); mocks.admissions.mockResolvedValue([]) })

describe('histórico unificado de documentos', () => {
  it('reúne admissão e atualização, mantendo versões antigas e sem expor caminhos privados', async () => {
    const doc = { id: 'doc', type: { name: 'RG' }, side: 'frente', version: 2, storagePath: 'privado/novo.pdf', originalName: 'RG.pdf', mimeType: 'application/pdf', sizeBytes: 9, status: 'APPROVED', uploadedAt: new Date('2026-09-23'), createdAt: new Date('2026-09-20'), revisions: [{ id: 'rev', version: 1, storagePath: 'privado/velho.pdf', originalName: 'RG.pdf', mimeType: 'application/pdf', sizeBytes: 8, status: 'REJECTED', uploadedAt: new Date('2026-09-21') }] }
    mocks.admissions.mockResolvedValue([
      { protocol: 'ADM-1', processType: 'ADMISSION', documents: [doc], generatedDocuments: [] },
      { protocol: 'AT-2', processType: 'REGISTRATION_UPDATE', documents: [{ ...doc, id: 'outro', revisions: [] }], generatedDocuments: [] },
    ])
    const result = historyMetadata(await employeeDocumentHistory(employee))
    expect(result).toHaveLength(3)
    expect(result.filter(file => file.previous)).toHaveLength(1)
    expect(new Set(result.map(file => file.origin))).toEqual(new Set(['Admissão', 'Atualização cadastral']))
    expect(JSON.stringify(result)).not.toMatch(/privado|storagePath|"read"/)
  })
  it('só usa CPF como alternativa quando não há vínculo explícito com outro colaborador', () => {
    const where = linkedAdmissionsWhere({ ...employee, cpf: '123.456.789-01' })
    expect(where.OR).toHaveLength(3)
    expect(where.OR?.[2]).toMatchObject({ collaboratorId: null, erpnextSyncs: { none: { employeeId: { not: null } } } })
    expect(linkedAdmissionsWhere(employee).OR).toHaveLength(2)
  })
})
