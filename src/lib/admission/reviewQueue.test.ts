import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ admissions: vi.fn(), documents: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  admission: { findMany: mocks.admissions }, admissionDocument: { findMany: mocks.documents },
} }))
vi.mock('@/lib/apiHelpers', () => ({
  getSessionOrUnauthorized: async () => ({ session: { user: { id: 'rh' } } }),
  getAnalystUnits: () => null,
} ))
import { GET } from '@/app/api/admissao-digital/revisao/route'

beforeEach(() => { vi.clearAllMocks(); mocks.documents.mockResolvedValue([]); mocks.admissions.mockResolvedValue([]) })
const request = () => new NextRequest('http://localhost/api/admissao-digital/revisao')
const admission = (photo: object) => ({ id: 'candidate', candidateName: 'Candidato', jobTitle: 'Cargo', unit: { name: 'Unidade' }, badgePhotos: [photo] })

it.each(['ADMISSION', 'REGISTRATION_UPDATE'])('exclui processos cancelados e expirados dos documentos de %s', async (processType) => {
  await GET(new NextRequest(`http://localhost/api/admissao-digital/revisao?processType=${processType}`))
  expect(mocks.documents).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
    admission: expect.objectContaining({ processType, status: { notIn: ['CANCELLED', 'EXPIRED'] } }),
  }) }))
  if (processType === 'ADMISSION') {
    expect(mocks.admissions).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      processType, status: { notIn: ['CANCELLED', 'EXPIRED'] },
    }) }))
  } else expect(mocks.admissions).not.toHaveBeenCalled()
})

it('consulta somente a captura mais recente e lista uma foto por candidato', async () => {
  mocks.admissions.mockResolvedValue([admission({ id: 'latest', confirmedAt: new Date(), approvedAt: null })])
  const items = await (await GET(request())).json()
  expect(items).toHaveLength(1)
  expect(items[0].id).toBe('badge:latest')
  expect(mocks.admissions).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({
    badgePhotos: expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 1 }),
  }) }))
})

it('remove o candidato da fila após aprovar a última foto mesmo com histórico pendente', async () => {
  mocks.admissions.mockResolvedValue([admission({ id: 'latest', confirmedAt: new Date(), approvedAt: new Date() })])
  expect(await (await GET(request())).json()).toEqual([])
})

it('não recupera uma captura antiga quando a última aguarda confirmação', async () => {
  mocks.admissions.mockResolvedValue([admission({ id: 'latest', confirmedAt: null, approvedAt: null })])
  expect(await (await GET(request())).json()).toEqual([])
})
