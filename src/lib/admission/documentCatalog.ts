import { prisma } from '@/lib/prisma'

// Catálogo de documentos solicitados na admissão digital. Espelha a relação de documentos que a BHCL
// já pede aos candidatos (Controle de Candidatos), exceto:
//  • Foto 3x4 — não é solicitada: a foto do crachá é tirada no próprio portal;
//  • Formulário Admissional e Formulário do Vale-Transporte — já são gerados preenchidos, para assinatura online.
export type CatalogDocument = {
  key: string
  name: string
  description?: string
  required: boolean
  /** Marcado por padrão na etapa "Documentos necessários" da nova admissão. */
  defaultSelected: boolean
  requiresFrontBack?: boolean
}

export const DOCUMENT_CATALOG: CatalogDocument[] = [
  { key: 'rg_frente', name: 'RG ou CNH (frente)', required: true, defaultSelected: true },
  { key: 'rg_verso', name: 'RG ou CNH (verso)', required: true, defaultSelected: true },
  { key: 'cpf', name: 'CPF', required: true, defaultSelected: true },
  { key: 'certidao_nascimento', name: 'Certidão de nascimento', description: 'Se for casado(a), envie a certidão de casamento.', required: true, defaultSelected: true },
  { key: 'comprovante_residencia', name: 'Comprovante de residência', description: 'Em nome do candidato.', required: true, defaultSelected: true },
  { key: 'carteira_trabalho', name: 'Carteira de Trabalho Digital', description: 'Declaração emitida pelo site do governo.', required: true, defaultSelected: true },
  { key: 'pis', name: 'Comprovante de PIS/PASEP', required: true, defaultSelected: true },
  { key: 'titulo_eleitor', name: 'Título de eleitor', description: 'Ou certidão de quitação eleitoral (TSE).', required: true, defaultSelected: true },
  { key: 'carteira_vacinacao', name: 'Carteira de vacinação', description: 'Atualizada.', required: true, defaultSelected: true },
  { key: 'certificado_militar', name: 'Certificado Militar', description: 'Somente para candidatos do sexo masculino.', required: false, defaultSelected: true },
  { key: 'comprovante_escolaridade', name: 'Comprovante de escolaridade', description: 'Histórico, diploma ou certificado.', required: true, defaultSelected: true },
  { key: 'coren_carteirinha', name: 'Comprovante de registro no COREN (carteirinha)', required: true, defaultSelected: true },
  { key: 'conta_banco_brasil', name: 'Dados bancários — Banco do Brasil', description: 'Termo de abertura de conta ou cartão do Banco do Brasil (frente e verso).', required: true, defaultSelected: true },
  { key: 'rg_cpf_filhos', name: 'RG e CPF dos filhos', description: 'Opcional. Se houver mais de um filho, envie tudo em um único arquivo.', required: false, defaultSelected: true },
  { key: 'certidao_nascimento_filhos', name: 'Certidão de nascimento dos filhos', description: 'Opcional. Se houver mais de um filho, envie tudo em um único arquivo.', required: false, defaultSelected: true },
  // Demais itens da relação de documentos da BHCL: disponíveis, mas desmarcados por padrão.
  { key: 'aso', name: 'Atestado de Saúde Ocupacional (ASO)', required: false, defaultSelected: false },
  { key: 'cartao_sus', name: 'Cartão Nacional do SUS', required: false, defaultSelected: false },
  { key: 'comprovante_vacinacao_covid', name: 'Comprovante de vacinação contra COVID-19', required: false, defaultSelected: false },
  { key: 'antecedentes_criminais', name: 'Certidão de antecedentes criminais', required: false, defaultSelected: false },
  { key: 'certidao_etica', name: 'Certidão de antecedentes éticos (Conselho de Classe)', required: false, defaultSelected: false },
  { key: 'comprovante_matricula_filhos', name: 'Comprovante de matrícula escolar dos filhos', description: 'Filhos dependentes.', required: false, defaultSelected: false },
  { key: 'carteira_vacinacao_dependentes', name: 'Carteira de vacinação dos dependentes', description: 'Menores de 14 anos.', required: false, defaultSelected: false },
]

/** Chaves antigas substituídas (ficam inativas; admissões já criadas continuam com elas). */
const LEGACY_KEYS = ['certidao']

let synced = false

/**
 * Mantém o catálogo do banco alinhado ao código (idempotente e barato). Roda uma vez por processo,
 * então não exige seed manual após um deploy. Não altera `required`/`active` definidos pelo RH.
 */
export async function syncDocumentCatalog(force = false) {
  if (synced && !force) return
  for (let index = 0; index < DOCUMENT_CATALOG.length; index++) {
    const doc = DOCUMENT_CATALOG[index]
    await prisma.admissionDocumentType.upsert({
      where: { key: doc.key },
      // O RH pode personalizar nome, descrição, ordem e seleção padrão. O boot só cria itens ausentes.
      update: {},
      create: { key: doc.key, name: doc.name, description: doc.description, required: doc.required, position: index + 1, requiresFrontBack: doc.requiresFrontBack ?? false, defaultSelected: doc.defaultSelected },
    })
  }
  await prisma.admissionDocumentType.updateMany({ where: { key: { in: LEGACY_KEYS } }, data: { active: false } })
  synced = true
}
