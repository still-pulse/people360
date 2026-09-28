import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  employeeFor: vi.fn(), configured: vi.fn(), refresh: vi.fn(), importDossie: vi.fn(), log: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('./erpnextDocuments', () => ({ erpnextEmployeeForAdmission: mocks.employeeFor }))
vi.mock('@/lib/erpnextClient', () => ({ erpnextConfigured: mocks.configured }))
vi.mock('@/lib/erpnextEmployees', () => ({ refreshColaboradorFromErpnext: mocks.refresh }))
vi.mock('@/lib/dossie/admissaoImport', () => ({ importAdmissionIntoDossie: mocks.importDossie }))
vi.mock('./audit', () => ({ logAdmissionEvent: mocks.log }))

import { linkAdmissionCollaborator } from './collaboratorLink'

const actor = { id: 'u1', name: 'RH' }

describe('colaborador criado a partir da admissão', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.configured.mockReturnValue(true)
    mocks.employeeFor.mockResolvedValue('HR-EMP-00042')
  })

  it('traz o Employee do ERPNext e importa a admissão para o dossiê', async () => {
    mocks.refresh.mockResolvedValue({ id: 'c1', erpnextId: 'HR-EMP-00042', cpf: '12345678909' })
    mocks.importDossie.mockResolvedValue({ documentos: 5, assinados: 2, dependentes: 1 })
    const result = await linkAdmissionCollaborator('a1', actor)
    expect(result).toEqual({ ok: true, colaboradorId: 'c1', employeeId: 'HR-EMP-00042', imported: { documentos: 5, assinados: 2, dependentes: 1 } })
    expect(mocks.refresh).toHaveBeenCalledWith('HR-EMP-00042')
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'COLLABORATOR_LINKED' }))
  })

  it('registra no histórico da admissão quando o ERPNext falha, sem lançar erro', async () => {
    mocks.refresh.mockRejectedValue(new Error('403 Forbidden'))
    const result = await linkAdmissionCollaborator('a1', actor)
    expect(result).toEqual({ ok: false, error: expect.stringContaining('403 Forbidden') })
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'COLLABORATOR_LINK_ERROR' }))
    expect(mocks.importDossie).not.toHaveBeenCalled()
  })

  it('mantém o colaborador criado mesmo se a importação do dossiê falhar', async () => {
    mocks.refresh.mockResolvedValue({ id: 'c1', erpnextId: 'HR-EMP-00042', cpf: null })
    mocks.importDossie.mockRejectedValue(new Error('arquivo ausente'))
    const result = await linkAdmissionCollaborator('a1', actor)
    expect(result).toMatchObject({ ok: true, colaboradorId: 'c1', imported: null, importError: expect.stringContaining('arquivo ausente') })
  })

  it('não tenta criar colaborador para admissão sem Employee ou em modo de teste', async () => {
    mocks.employeeFor.mockResolvedValueOnce(null)
    expect((await linkAdmissionCollaborator('a1', actor)).ok).toBe(false)
    mocks.employeeFor.mockResolvedValueOnce('MOCK-ABC')
    expect((await linkAdmissionCollaborator('a1', actor)).ok).toBe(false)
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
