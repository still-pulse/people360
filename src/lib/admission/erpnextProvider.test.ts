import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ admission: {} as any }))
const api = vi.hoisted(() => ({ createEmployee: vi.fn(), findEmployeeByCpf: vi.fn(), listNames: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: { admission: { findUnique: vi.fn(async () => db.admission) } } }))
vi.mock('@/lib/erpnextClient', () => ({
  createEmployee: api.createEmployee,
  findEmployeeByCpf: api.findEmployeeByCpf,
  listErpnextResourceNames: api.listNames,
}))
vi.mock('./security', () => ({ decryptAdmissionValue: (value: string) => value }))

import { syncAdmissionToERPNext } from './erpnextProvider'

describe('integração da admissão com Employee do ERPNext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.admission = {
      candidateName: 'Maria Souza', candidateEmail: 'maria@example.com', jobTitle: 'Enfermeiro (a)', department: 'Enfermagem',
      contractType: 'CLT - prazo indeterminado', hireDate: new Date('2026-10-01T00:00:00Z'), salary: 3886.36, monthlyHours: 180,
      unit: { name: 'GRU - UPA São João' },
      fields: [
        { key: 'cpf', value: '123.456.789-09', sensitive: false }, { key: 'gender', value: 'Female', sensitive: false },
        { key: 'birthDate', value: '1992-08-12', sensitive: false }, { key: 'phone', value: '11999999999', sensitive: false },
      ],
    }
    api.findEmployeeByCpf.mockResolvedValue(null)
    api.createEmployee.mockResolvedValue({ name: 'RH-COLAB-00001' })
    api.listNames.mockImplementation(async (doctype: string) => ({
      Company: ['UPA SÃO JOÃO'], Branch: ['UPA São João'], Department: ['ENF - Enfermagem - UPA São João'],
      Designation: ['ENFERMEIRO'], 'Employment Type': ['Prazo indeterminado'],
    } as Record<string, string[]>)[doctype] ?? [])
  })

  it('envia local de trabalho e salário base, obrigatórios no Employee da BHCL', async () => {
    await expect(syncAdmissionToERPNext('a1')).resolves.toEqual({ employeeId: 'RH-COLAB-00001', employeeCode: 'RH-COLAB-00001' })
    expect(api.createEmployee).toHaveBeenCalledWith(expect.objectContaining({
      company: 'UPA SÃO JOÃO', branch: 'UPA São João', department: 'ENF - Enfermagem - UPA São João',
      designation: 'ENFERMEIRO', employment_type: 'Prazo indeterminado', ctc: 3886.36,
    }))
  })

  it('não relaciona o departamento de uma unidade com outra', async () => {
    api.listNames.mockImplementation(async (doctype: string) => ({
      Company: ['PA LUIZ GONZAGA'], Branch: ['PA Luiz Gonzaga'], Department: ['ENF - Enfermagem - PA Maria Dirce'],
      Designation: ['ENFERMEIRO'], 'Employment Type': ['Prazo indeterminado'],
    } as Record<string, string[]>)[doctype] ?? [])
    db.admission.unit.name = 'VG - PA Luiz Gonzaga'

    await expect(syncAdmissionToERPNext('a1')).rejects.toThrow(/departamento/i)
    expect(api.createEmployee).not.toHaveBeenCalled()
  })

  it('explica quando a unidade não possui Local de Trabalho no ERPNext', async () => {
    api.listNames.mockImplementation(async (doctype: string) => ({
      Company: ['PA LUIZ GONZAGA'], Branch: ['PA Maria Dirce'], Department: [], Designation: ['ENFERMEIRO'], 'Employment Type': ['Prazo indeterminado'],
    } as Record<string, string[]>)[doctype] ?? [])
    db.admission.unit.name = 'VG - PA Luiz Gonzaga'

    await expect(syncAdmissionToERPNext('a1')).rejects.toThrow(/Local de Trabalho.*Cadastre o local/i)
    expect(api.createEmployee).not.toHaveBeenCalled()
  })
})
