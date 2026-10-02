import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { ADMISSION_LAYOUTS } from '@/lib/admission/forms'

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), requests: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { generatedDocument: { findMany: mocks.findMany }, externalSignatureRequest: { findMany: mocks.requests } } }))
vi.mock('@/lib/admission/storage', () => ({ readPrivateAdmissionFile: mocks.read }))
vi.mock('@/lib/pdfCompress', () => ({ compressPdf: async (buffer: Buffer) => ({ buffer }), decryptPdf: vi.fn() }))
import { admissionLegalSources, legalDocumentGroup } from './legalDossier'
import { renderAdmissionDossier, type AttachmentSource } from './dossier'
import { PdfBuilder, PAGE } from './pdf/engine'

beforeEach(() => { vi.clearAllMocks(); mocks.requests.mockResolvedValue([]) })
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

  it('mantém somente a versão assinada mais recente de cada termo, inclusive templates renomeados', async () => {
    const doc = (id: string, key: string, day: number) => ({ id, template: { key, name: 'Termo de Ciência do Controle de Ponto' }, signedStoragePath: `${id}.pdf`, createdAt: new Date(2026, 9, day), signedAt: new Date(2026, 9, day) })
    mocks.findMany.mockResolvedValue([doc('novo', 'termo_ciencia_ponto', 3), doc('anterior', 'termo_ciencia_ponto', 2), doc('legado', 'termo_ponto', 1)])
    const sources = await admissionLegalSources('admissao-1')
    expect(sources.documentos).toHaveLength(1)
    await sources.documentos[0].read()
    expect(mocks.read).toHaveBeenCalledWith('novo.pdf')
    expect(mocks.findMany.mock.calls[0][0].orderBy[0]).toEqual({ signedAt: 'desc' })
  })

  it('extrai somente as páginas originais de cada documento e inclui uma certificação por pacote', async () => {
    const packet = await PDFDocument.create()
    for (const width of [500, 510, 520, 530, 540]) packet.addPage([width, 700])
    mocks.read.mockResolvedValue(Buffer.from(await packet.save()))
    mocks.requests.mockResolvedValue([{ id: 'pacote', signedPath: 'pacote.pdf', signedAt: new Date('2026-10-02'), pageMap: [
      { documentId: 'contrato', start: 1, end: 2 }, { documentId: 'termo', start: 3, end: 3 }, { documentId: 'ficha', start: 4, end: 4 },
    ] }])
    const doc = (id: string, key: string) => ({ id, template: { key, name: key }, signedStoragePath: `${id}-assinado.pdf`, createdAt: new Date(), signedAt: new Date() })
    mocks.findMany.mockResolvedValue([doc('contrato', 'contrato_trabalho'), doc('termo', 'termo_ciencia_ponto'), doc('ficha', 'ficha_registro')])
    const sources = await admissionLegalSources('admissao-1')
    expect(sources.certificados).toHaveLength(1)
    const widths = async (src: AttachmentSource) => (await PDFDocument.load((await src.read())!)).getPages().map(page => page.getWidth())
    expect(await widths(sources.formulario[0])).toEqual([500, 510])
    expect(await widths(sources.documentos[0])).toEqual([520])
    expect(await widths(sources.certificados[0])).toEqual([540])
    expect(mocks.read).toHaveBeenCalledTimes(1)
    expect(mocks.read).toHaveBeenCalledWith('pacote.pdf')
    const result = await renderAdmissionDossier({ info, photo: null, sources, juridico: true })
    const output = await PDFDocument.load(result.buffer)
    expect(output.getPages().slice(2).map(page => page.getWidth())).toEqual([500, 510, 520, 540])
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
  it('inclui dados dos dependentes e desloca o índice dos anexos no dossiê admissional', async () => {
    const kv = vi.spyOn(PdfBuilder.prototype, 'kv')
    const text = vi.spyOn(PdfBuilder.prototype, 'textAt')
    const source = await attachment('Ficha', [[500, 700]])
    const result = await renderAdmissionDossier({ info, photo: null, sources: { formulario: [source], documentos: [] }, dependents: [
      { name: 'Filho Teste', cpf: '11144477735', birthDate: new Date('2020-03-02'), relationship: 'Filho(a)', irrfDependent: true, childUnder14: true },
      { name: 'Dependente antigo', cpf: '', birthDate: new Date('2000-01-01'), relationship: 'Filho(a)', irrfDependent: false, childUnder14: false },
    ] })
    expect(kv).toHaveBeenCalledWith(expect.arrayContaining([['CPF', '111.444.777-35'], ['Nome', 'Filho Teste'], ['Nascimento', '02/03/2020'], ['Dependente de IRRF', 'Sim'], ['Menor de 14 anos', 'Sim']]))
    expect(kv).toHaveBeenCalledWith(expect.arrayContaining([['CPF', 'CPF completo não disponível — solicitar preenchimento']]))
    const pdf = await PDFDocument.load(result.buffer)
    expect(pdf.getPageCount()).toBe(result.pages)
    expect(pdf.getPages().at(-1)?.getWidth()).toBe(500)
    const indexCalls = text.mock.calls.filter(call => call[1] === PAGE.w - PAGE.mr && call[3]?.align === 'right')
    expect(indexCalls.map(call => call[0])).toEqual(['3', String(result.pages)])
  })
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

  it('incorpora anexos que somam mais de 50 MB sem páginas de omissão', async () => {
    const source = await attachment('Termo grande', [[500, 700]])
    const bytes = (await source.read())!
    const padded = Buffer.concat([bytes, Buffer.alloc(26 * 1024 * 1024 - bytes.length, 32)])
    source.read = async () => padded
    const result = await renderAdmissionDossier({ info, photo: null, sources: { formulario: [source], documentos: [source] }, juridico: true })
    expect((await PDFDocument.load(result.buffer)).getPages().slice(2).map(page => page.getWidth())).toEqual([500, 500])
  })

  it('aceita mais de 500 páginas e recusa um dossiê que ultrapassaria o novo limite', async () => {
    const source = await attachment('Contrato extenso', Array.from({ length: 501 }, () => [500, 700] as [number, number]))
    const result = await renderAdmissionDossier({ info, photo: null, sources: { formulario: [source], documentos: [] }, juridico: true })
    expect(result.pages).toBe(503)
    await expect(renderAdmissionDossier({ info, photo: null, sources: { formulario: [source], documentos: [source] }, juridico: true })).rejects.toThrow('1.000 páginas')
  })

  it('não entrega PDF jurídico incompleto quando falta um arquivo', async () => {
    const source = await attachment('Termo ausente', [[500, 700]])
    source.read = async () => null
    await expect(renderAdmissionDossier({ info, photo: null, sources: { formulario: [], documentos: [source] }, juridico: true })).rejects.toThrow('evitar documentos ausentes')
  })
})
