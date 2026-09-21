import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'
import { fmtDate } from './format'
import { addHistorico, auditDossie } from './history'
import { findLinkedAdmissionId, importFromAdmission } from './perfil'
import { saveDossieFile } from './storage'
import type { Actor } from './types'

const COMPROVANTES = new Set(['comprovante_residencia', 'conta_banco_brasil', 'comprovante_escolaridade', 'coren_carteirinha'])
const DEPENDENTES = new Set(['rg_cpf_filhos', 'certidao_nascimento_filhos', 'carteira_vacinacao_dependentes', 'comprovante_matricula_filhos'])
const GERADOS: Record<string, { categoria: string; titulo: string }> = {
  contrato_trabalho: { categoria: 'Contrato', titulo: 'Contrato de Experiência' },
  termo_vale_transporte: { categoria: 'Termo', titulo: 'Vale-Transporte — Declaração e Termo de Compromisso' },
  ficha_registro: { categoria: 'Documento Pessoal', titulo: 'Formulário Admissional' },
}

const categoriaDoc = (key: string) => (COMPROVANTES.has(key) ? 'Comprovante' : DEPENDENTES.has(key) ? 'Dependente' : 'Documento Pessoal')
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** O que ainda não foi trazido da admissão para o dossiê (para o aviso na tela; nada é gravado). */
export async function admissionImportStatus(colaborador: { id: string; erpnextId: string; cpf: string | null }) {
  const admissionId = await findLinkedAdmissionId(colaborador)
  if (!admissionId) return { vinculada: false, admissionId: null, pendentes: { documentos: 0, assinados: 0, dependentes: 0 } }
  const [approved, signed, dependents, imported, existing] = await Promise.all([
    prisma.admissionDocument.findMany({ where: { admissionId, status: 'APPROVED', storagePath: { not: null } }, select: { id: true } }),
    prisma.generatedDocument.findMany({ where: { admissionId, status: 'SIGNED', signedStoragePath: { not: null } }, select: { id: true } }),
    prisma.admissionDependent.findMany({ where: { admissionId }, select: { name: true, birthDate: true } }),
    prisma.colaboradorDocumento.findMany({ where: { colaboradorId: colaborador.id, admissaoOrigemId: { not: null } }, select: { admissaoOrigemId: true } }),
    prisma.colaboradorDependente.findMany({ where: { colaboradorId: colaborador.id }, select: { nome: true, nascimento: true } }),
  ])
  const done = new Set(imported.map((row) => row.admissaoOrigemId))
  const missingDependents = dependents.filter((d) => !existing.some((e) => sameName(e.nome, d.name) && e.nascimento.getTime() === d.birthDate.getTime()))
  return {
    vinculada: true, admissionId,
    pendentes: {
      documentos: approved.filter((d) => !done.has(`doc:${d.id}`)).length,
      assinados: signed.filter((d) => !done.has(`gen:${d.id}`)).length,
      dependentes: missingDependents.length,
    },
  }
}

/**
 * Traz para o dossiê tudo o que já foi validado na admissão digital: cadastro complementar (sem sobrescrever),
 * dependentes, documentos APROVADOS pelo RH e contratos/termos assinados eletronicamente. É idempotente:
 * cada item importado guarda sua origem e nunca é duplicado.
 */
export async function importAdmissionIntoDossie(colaborador: { id: string; erpnextId: string; cpf: string | null }, actor: Actor & { role?: string }, ip?: string | null) {
  const admissionId = await findLinkedAdmissionId(colaborador)
  if (!admissionId) return { admissionId: null, perfil: [] as string[], documentos: 0, assinados: 0, dependentes: 0, ignorados: 0 }

  const perfil = await importFromAdmission(colaborador, actor)
  let documentos = 0, assinados = 0, dependentes = 0, ignorados = 0

  const already = new Set((await prisma.colaboradorDocumento.findMany({ where: { colaboradorId: colaborador.id, admissaoOrigemId: { not: null } }, select: { admissaoOrigemId: true } })).map((r) => r.admissaoOrigemId))

  const importFile = async (origem: string, storagePath: string | null, meta: { categoria: string; titulo: string; status: 'VIGENTE' | 'ASSINADO'; observacao: string; nome: string; data: Date | null }) => {
    if (already.has(origem) || !storagePath) return
    const bytes = await readPrivateAdmissionFile(storagePath)
    if (!bytes) { ignorados += 1; return }
    let saved
    try { saved = await saveDossieFile(colaborador.id, 'anexos', bytes) } catch { ignorados += 1; return }
    await prisma.colaboradorDocumento.create({
      data: {
        colaboradorId: colaborador.id, tipo: 'ANEXO', categoria: meta.categoria, titulo: meta.titulo, origem: 'ANEXADO', status: meta.status,
        observacao: meta.observacao, arquivoPath: saved.storagePath, arquivoNome: meta.nome, arquivoMime: saved.mimeType, arquivoTamanho: saved.sizeBytes,
        hash: createHash('sha256').update(bytes).digest('hex'), admissaoOrigemId: origem, geradoEm: meta.data ?? new Date(),
        criadoPorId: actor.id, criadoPorNome: actor.name,
      },
    })
    already.add(origem)
  }

  const approved = await prisma.admissionDocument.findMany({ where: { admissionId, status: 'APPROVED', storagePath: { not: null } }, include: { type: true }, orderBy: { type: { position: 'asc' } } })
  for (const doc of approved) {
    const before = already.size
    const extension = doc.mimeType === 'application/pdf' ? 'pdf' : doc.mimeType === 'image/png' ? 'png' : 'jpg'
    await importFile(`doc:${doc.id}`, doc.storagePath, {
      categoria: categoriaDoc(doc.type.key), titulo: doc.type.name, status: 'VIGENTE', nome: `${doc.type.key}.${extension}`, data: doc.reviewedAt ?? doc.uploadedAt,
      observacao: `Importado da admissão digital — validado pelo RH${doc.reviewedAt ? ` em ${fmtDate(doc.reviewedAt)}` : ''}.`,
    })
    if (already.size > before) documentos += 1
  }

  const signed = await prisma.generatedDocument.findMany({ where: { admissionId, status: 'SIGNED', signedStoragePath: { not: null } }, include: { template: { select: { key: true, name: true } } } })
  for (const doc of signed) {
    const before = already.size
    const info = GERADOS[doc.template.key] ?? { categoria: 'Termo', titulo: doc.template.name }
    await importFile(`gen:${doc.id}`, doc.signedStoragePath, {
      categoria: info.categoria, titulo: `${info.titulo} (assinado eletronicamente)`, status: 'ASSINADO', nome: `${doc.template.key}-assinado.pdf`, data: doc.signedAt,
      observacao: `Assinado eletronicamente pelo colaborador na admissão digital${doc.signedAt ? ` em ${fmtDate(doc.signedAt)}` : ''}. Código de validação ${doc.validationCode ?? '—'}.`,
    })
    if (already.size > before) assinados += 1
  }

  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: { hireDate: true, dependents: true } })
  const existing = await prisma.colaboradorDependente.findMany({ where: { colaboradorId: colaborador.id }, select: { nome: true, nascimento: true } })
  for (const dependent of admission?.dependents ?? []) {
    if (existing.some((e) => sameName(e.nome, dependent.name) && e.nascimento.getTime() === dependent.birthDate.getTime())) continue
    await prisma.colaboradorDependente.create({
      data: {
        colaboradorId: colaborador.id, nome: dependent.name, cpfMascarado: dependent.cpfMasked, nascimento: dependent.birthDate, parentesco: dependent.relationship,
        dependenteIr: dependent.irrfDependent, salarioFamilia: dependent.childUnder14, planoSaude: false, inclusaoEm: admission?.hireDate ?? new Date(), criadoPorNome: actor.name,
      },
    })
    dependentes += 1
  }

  if (documentos + assinados > 0) {
    await addHistorico({ colaboradorId: colaborador.id, tipo: 'DOCUMENTO', dataEvento: new Date(), titulo: `Documentos importados da admissão digital: ${documentos} validado(s) pelo RH e ${assinados} assinado(s) eletronicamente`, actor })
  }
  if (dependentes > 0) await addHistorico({ colaboradorId: colaborador.id, tipo: 'DEPENDENTE', dataEvento: new Date(), titulo: `${dependentes} dependente(s) importado(s) da admissão digital`, actor })
  await auditDossie({ actor, action: 'CREATE', entity: 'ImportacaoAdmissao', colaboradorId: colaborador.id, ip, details: { documentos, assinados, dependentes, camposCadastro: perfil.imported.length, ignorados } })
  return { admissionId, perfil: perfil.imported, documentos, assinados, dependentes, ignorados }
}
