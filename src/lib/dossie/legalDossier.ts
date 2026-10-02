import { prisma } from '@/lib/prisma'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'
import { readDocumentoFile, resolveDocType, DossieError } from './documentos'
import { renderAdmissionDossier, type AttachmentSource } from './dossier'
import { buildSnapshot } from './snapshot'
import { loadAdmissionBadgePhoto, loadColaboradorPhoto } from './photo'
import { findLinkedAdmissionId } from './perfil'
import { fileSlug, fmtDateTime } from './format'
import { PDFDocument } from 'pdf-lib'
import { compressPdf } from '@/lib/pdfCompress'

/** Classificação explícita: documentos pessoais e fichas cadastrais ficam fora. */
export function legalDocumentGroup(key: string): 'contratos' | 'termos' | null {
  const normalized = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^colab_/, '')
  if (/^(contratos?|aditivos?|acordos?|prorrogacao|prorrogacoes|efetivacao)(_|$)/.test(normalized)) return 'contratos'
  if (/^(termos?|declaracoes|declaracao|normas|aviso_privacidade)(_|$)/.test(normalized)) return 'termos'
  return null
}

type LegalSources = { formulario: AttachmentSource[]; documentos: AttachmentSource[]; certificados: AttachmentSource[] }

type PageRange = { documentId: string; start: number; end: number }
function pageRanges(value: unknown): PageRange[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is PageRange => !!row && typeof row === 'object' && typeof row.documentId === 'string' && Number.isInteger(row.start) && Number.isInteger(row.end) && row.start >= 1 && row.end >= row.start)
}

async function extractPages(pdf: PDFDocument, start: number, end: number) {
  if (start < 1 || end > pdf.getPageCount() || end < start) throw new DossieError('O pacote assinado contém um intervalo de páginas inválido.', 422)
  const part = await PDFDocument.create()
  for (const page of await part.copyPages(pdf, Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index))) part.addPage(page)
  return Buffer.from(await part.save())
}

export async function admissionLegalSources(admissionId: string): Promise<LegalSources> {
  const documents = await prisma.generatedDocument.findMany({
    where: { admissionId, status: 'SIGNED', signedStoragePath: { not: null } },
    include: { template: { select: { key: true, name: true } } },
    orderBy: [{ signedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  })
  const requests = await prisma.externalSignatureRequest.findMany({
    where: { admissionId, status: 'SIGNED', signedPath: { not: null } },
    select: { id: true, pageMap: true, signedPath: true, signedAt: true },
    orderBy: [{ signedAt: 'desc' }, { createdAt: 'desc' }],
  })
  const packages = requests.map(request => {
    let loaded: Promise<PDFDocument> | undefined
    return { request, ranges: pageRanges(request.pageMap), load: () => loaded ??= (async () => {
      const bytes = await readPrivateAdmissionFile(request.signedPath!)
      if (!bytes) throw new DossieError('O pacote assinado da Autentique não está disponível.', 422)
      // Recomprime uma cópia de exportação antes de separar as páginas; o original assinado fica intacto.
      return PDFDocument.load((await compressPdf(bytes)).buffer)
    })() }
  })
  const sources: LegalSources = { formulario: [], documentos: [], certificados: [] }
  const seenKeys = new Set<string>(), seenNames = new Set<string>(), usedPackages = new Set<string>()
  for (const doc of documents) {
    const group = legalDocumentGroup(doc.template.key)
    if (!group) continue
    const name = doc.template.name.trim().toLocaleLowerCase('pt-BR')
    if (seenKeys.has(doc.template.key) || seenNames.has(name)) continue
    seenKeys.add(doc.template.key); seenNames.add(name)
    const bundle = packages.find(item => item.ranges.some(range => range.documentId === doc.id))
    const range = bundle?.ranges.find(item => item.documentId === doc.id)
    if (bundle) usedPackages.add(bundle.request.id)
    const source: AttachmentSource = {
      titulo: `${doc.template.name} (assinado)`, categoria: 'Jurídico BHCL',
      data: doc.signedAt ?? doc.createdAt, situacao: 'Assinado', mime: 'application/pdf',
      read: bundle && range ? async () => extractPages(await bundle.load(), range.start, range.end) : () => readPrivateAdmissionFile(doc.signedStoragePath!),
    }
    sources[group === 'contratos' ? 'formulario' : 'documentos'].push(source)
  }
  for (const bundle of packages) {
    if (!usedPackages.has(bundle.request.id)) continue
    const originalPages = Math.max(...bundle.ranges.map(range => range.end))
    const pdf = await bundle.load()
    if (pdf.getPageCount() <= originalPages) continue
    sources.certificados.push({
      titulo: `Comprovante de assinatura Autentique — ${fmtDateTime(bundle.request.signedAt)}`, categoria: 'Comprovante de assinatura',
      data: bundle.request.signedAt ?? new Date(), situacao: 'Assinado', mime: 'application/pdf',
      read: () => extractPages(pdf, originalPages + 1, pdf.getPageCount()),
    })
  }
  for (const group of [sources.formulario, sources.documentos]) group.sort((a, b) => a.data.getTime() - b.data.getTime())
  return sources
}

export async function buildAdmissionLegalDossier(admissionId: string) {
  const admission = await prisma.admission.findUniqueOrThrow({
    where: { id: admissionId },
    select: { protocol: true, candidateName: true, jobTitle: true, hireDate: true, unit: { select: { name: true } }, collaborator: { select: { matricula: true } } },
  })
  const [sources, photo] = await Promise.all([admissionLegalSources(admissionId), loadAdmissionBadgePhoto(admissionId)])
  const result = await renderAdmissionDossier({
    info: { nome: admission.candidateName, matricula: admission.collaborator?.matricula ?? '', cargo: admission.jobTitle, unidade: admission.unit.name, admissao: admission.hireDate.toISOString() },
    sources, photo, juridico: true, identifier: `Protocolo: ${admission.protocol}`,
  })
  return { ...result, fileName: `Dossie_Juridico_${fileSlug(admission.candidateName)}_${fileSlug(admission.protocol)}.pdf` }
}

export async function buildLegalDossierPdf(params: { colaboradorId: string; actorName: string }) {
  const snapshot = await buildSnapshot(params.colaboradorId)
  if (!snapshot) throw new DossieError('Colaborador não encontrado.', 404)
  const employee = await prisma.colaborador.findUniqueOrThrow({ where: { id: params.colaboradorId }, select: { erpnextId: true, cpf: true, imagePath: true } })
  const admissionId = await findLinkedAdmissionId(employee)
  const sources = admissionId ? await admissionLegalSources(admissionId) : { formulario: [], documentos: [], certificados: [] } as LegalSources
  const documents = await prisma.colaboradorDocumento.findMany({
    where: { colaboradorId: params.colaboradorId, status: 'ASSINADO', ...(admissionId ? { admissaoOrigemId: null } : {}) }, orderBy: { createdAt: 'asc' },
  })
  for (const doc of documents) {
    const type = await resolveDocType(doc.tipo)
    const group = legalDocumentGroup(doc.tipo === 'OUTRO_DOCUMENTO' ? doc.tipo : type?.secao ?? doc.tipo)
      ?? (doc.origem === 'ANEXADO' ? legalDocumentGroup(doc.categoria.toLowerCase().replace(/\s+/g, '_')) : null)
    if (!group) continue
    sources[group === 'contratos' ? 'formulario' : 'documentos'].push({
      titulo: doc.titulo, categoria: doc.categoria, data: doc.geradoEm ?? doc.createdAt,
      situacao: 'Assinado', mime: doc.arquivoMime ?? 'application/pdf', read: () => readDocumentoFile(doc),
    })
  }
  for (const group of [sources.formulario, sources.documentos]) group.sort((a, b) => a.data.getTime() - b.data.getTime())
  const photo = await loadColaboradorPhoto(employee)
  const result = await renderAdmissionDossier({ info: snapshot, photo, sources, juridico: true })
  return { ...result, snapshot, fileName: `Dossie_Juridico_${fileSlug(snapshot.nome)}_${fileSlug(snapshot.matricula)}.pdf` }
}
