import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { ADMISSION_LAYOUTS } from '@/lib/admission/forms'

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { generatedDocument: { findMany: mocks.findMany } } }))
vi.mock('@/lib/admission/storage', () => ({ readPrivateAdmissionFile: mocks.read }))
import { admissionLegalSources, legalDocumentGroup } from './legalDossier'
import { renderAdmissionDossier, type AttachmentSource } from './dossier'
import { PdfBuilder, PAGE } from './pdf/engine'

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('documentos do dossiê jurídico', () => {
  it('inclui todos os contratos e termos oficiais, inclusive o aviso LGPD, e exclui a ficha cadastral', () => {
    for (const layout of ADMISSION_LAYOUTS) {
      expect(legalDocumentGroup(layout.key), layout.key).toBe(layout.key === 'ficha_registro' ? null : layout.key === 'contrato_trabalho' ? 'contratos' : 'termos')
    }
    for (const key of ['rg_frente', 'cpf', 'comprovante_residencia', 'ficha_registro', 'Documento Pessoal']) expect(legalDocumentGroup(key)).toBeNull()
    for (const key of ['colab_contrato_experiencia', 'aditivos', 'prorrogações', 'acordos']) expect(legalDocumentGroup(key)).toBe('contratos')
    for (const key of ['termos', 'declarações', 'normas_ponto']) expect(legalDocumentGroup(key)).toBe('termos')
  })

  it('consulta somente assinados e lê a versão assinada, agrupando sem documentos pessoais', async () => {
    const doc = (key: string) => ({ template: { key, name: key }, signedStoragePath: `${key}-assinado.pdf`, storagePath: `${key}-original.pdf`, createdAt: new Date('2026-10-01'), signedAt: new Date('2026-10-02') })
    mocks.findMany.mockResolvedValue([doc('contrato_trabalho'), doc('termo_vale_transporte'), doc('ficha_registro')])
    const sources = await admissionLegalSources('admissao-1')
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { admissionId: 'admissao-1', status: 'SIGNED', signedStoragePath: { not: null } } }))
    expect(sources.formulario).toHaveLength(1)
    expect(sources.documentos).toHaveLength(1)
    await sources.formulario[0].read()
    expect(mocks.read).toHaveBeenCalledWith('contrato_trabalho-assinado.pdf')
  })
})

const info = { nome: 'Colaborador de Teste', matricula: '123', cargo: 'Analista', unidade: 'BHCL', admissao: '2026-10-01' }
async function attachment(title: string, sizes: [number, number][]): Promise<AttachmentSource> {
  const pdf = await PDFDocument.create()
  for (const size of sizes) pdf.addPage(size)
  const bytes = Buffer.from(await pdf.save())
  return { titulo: title, categoria: 'Jurídico BHCL', data: new Date(), situacao: 'Assinado', mime: 'application/pdf', read: async () => bytes }
}

describe('PDF jurídico com capa e índice institucional', () => {
  it('preserva todas as páginas dos contratos e termos na ordem do índice', async () => {
    const text = vi.spyOn(PdfBuilder.prototype, 'textAt')
    const contrato = await attachment('Contrato assinado', [[500, 700], [510, 710]])
    const termo = await attachment('Termo assinado', [[520, 720]])
    const result = await renderAdmissionDossier({ info, photo: null, sources: { formulario: [contrato], documentos: [termo] }, juridico: true })
    const pdf = await PDFDocument.load(result.buffer)
    expect(result.documents).toBe(2)
    expect(result.pages).toBe(5)
    expect(pdf.getPageCount()).toBe(5)
    expect(pdf.getPages().slice(2).map(page => page.getWidth())).toEqual([500, 510, 520])
    expect(text).toHaveBeenCalledWith('DOSSIÊ JURÍDICO DO COLABORADOR', expect.any(Number), expect.any(Number), expect.any(Object))
    const indexCalls = text.mock.calls.filter(call => call[1] === PAGE.w - PAGE.mr && call[3]?.align === 'right')
    expect(indexCalls.map(call => call[0])).toEqual(['3', '3', '5', '5'])
  })

  it('permite um dossiê composto somente por termos assinados', async () => {
    const termo = await attachment('Declaração assinada', [[500, 700]])
    const result = await renderAdmissionDossier({ info, photo: null, sources: { formulario: [], documentos: [termo] }, juridico: true })
    expect(result.pages).toBe(3)
  })

  it('reserva mais páginas de índice quando há muitos documentos', async () => {
    const termo = await attachment('Termo assinado', [[500, 700]])
    const count = 70
    const result = await renderAdmissionDossier({ info, photo: null, sources: { formulario: [], documentos: Array.from({ length: count }, (_, index) => ({ ...termo, titulo: `Termo ${index + 1}` })) }, juridico: true })
    const indexPages = Math.ceil((count + 1) / Math.floor((PAGE.bottom - PAGE.top - 16) / 6.4))
    expect(result.pages).toBe(1 + indexPages + count)
    expect((await PDFDocument.load(result.buffer)).getPageCount()).toBe(result.pages)
  })

  it('não gera um dossiê jurídico vazio e mantém a exigência do formulário no admissional', async () => {
    const sources = { formulario: [], documentos: [] }
    await expect(renderAdmissionDossier({ info, photo: null, sources, juridico: true })).rejects.toThrow('Ainda não há contratos ou termos assinados')
    await expect(renderAdmissionDossier({ info, photo: null, sources })).rejects.toThrow('O formulário admissional')
  })
})
