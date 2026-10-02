import { prisma } from '@/lib/prisma'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'
import { readDocumentoFile, resolveDocType, DossieError } from './documentos'
import { renderAdmissionDossier, type AttachmentSource } from './dossier'
import { buildSnapshot } from './snapshot'
import { loadAdmissionBadgePhoto, loadColaboradorPhoto } from './photo'
import { findLinkedAdmissionId } from './perfil'
import { fileSlug } from './format'

/** Classificação explícita: documentos pessoais e fichas cadastrais ficam fora. */
export function legalDocumentGroup(key: string): 'contratos' | 'termos' | null {
  const normalized = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^colab_/, '')
  if (/^(contratos?|aditivos?|acordos?|prorrogacao|prorrogacoes|efetivacao)(_|$)/.test(normalized)) return 'contratos'
  if (/^(termos?|declaracoes|declaracao|normas|aviso_privacidade)(_|$)/.test(normalized)) return 'termos'
  return null
}

type LegalSources = { formulario: AttachmentSource[]; documentos: AttachmentSource[] }

export async function admissionLegalSources(admissionId: string): Promise<LegalSources> {
  const documents = await prisma.generatedDocument.findMany({
    where: { admissionId, status: 'SIGNED', signedStoragePath: { not: null } },
    include: { template: { select: { key: true, name: true } } },
    orderBy: [{ signedAt: 'asc' }, { createdAt: 'asc' }],
  })
  const sources: LegalSources = { formulario: [], documentos: [] }
  for (const doc of documents) {
    const group = legalDocumentGroup(doc.template.key)
    if (!group) continue
    const source: AttachmentSource = {
      titulo: `${doc.template.name} (assinado)`, categoria: 'Jurídico BHCL',
      data: doc.signedAt ?? doc.createdAt, situacao: 'Assinado', mime: 'application/pdf',
      read: () => readPrivateAdmissionFile(doc.signedStoragePath!),
    }
    sources[group === 'contratos' ? 'formulario' : 'documentos'].push(source)
  }
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
  const sources = admissionId ? await admissionLegalSources(admissionId) : { formulario: [], documentos: [] } as LegalSources
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
