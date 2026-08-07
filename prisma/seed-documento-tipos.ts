import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Catálogo de documentos de contratação — Seção II do "relacao_documentos.pdf" (BHCL)
// + itens adicionais solicitados (conselho de classe, antecedentes criminais, certidão ética).
// A Seção I do PDF (itens a levar no dia da consulta com o Médico do Trabalho) é só informativa
// e não entra aqui — é exibida como texto fixo na página pública do candidato.
const DOCUMENTO_TIPOS: {
  chave: string
  nome: string
  condicional?: boolean
  condicionalTipo?: 'CONSELHO' | 'MILITAR' | 'DEPENDENTE'
}[] = [
  { chave: 'conta_banco_brasil', nome: 'Termo de abertura de conta ou cartão do Banco do Brasil (frente e verso)' },
  { chave: 'aso', nome: 'Atestado de Saúde Ocupacional (ASO)' },
  { chave: 'foto_3x4', nome: 'Foto 3x4' },
  { chave: 'rg', nome: 'RG' },
  { chave: 'cpf', nome: 'CPF' },
  { chave: 'certidao_nascimento_casamento', nome: 'Certidão de Nascimento ou Casamento (modelo atualizado)' },
  { chave: 'carteira_trabalho_digital', nome: 'Carteira de Trabalho Digital (declaração emitida pelo site do governo)' },
  { chave: 'pis_nis', nome: 'PIS/NIS' },
  { chave: 'carteira_vacinacao', nome: 'Carteira de Vacinação atualizada' },
  { chave: 'comprovante_vacinacao_covid', nome: 'Comprovante de Vacinação contra COVID-19' },
  { chave: 'cartao_sus', nome: 'Cartão Nacional do SUS' },
  { chave: 'titulo_eleitor', nome: 'Título de Eleitor ou certidão de quitação eleitoral (TSE)' },
  { chave: 'certificado_militar', nome: 'Certificado Militar', condicional: true, condicionalTipo: 'MILITAR' },
  { chave: 'comprovante_escolaridade', nome: 'Comprovante de Escolaridade (histórico/diploma/certificado)' },
  { chave: 'comprovante_endereco', nome: 'Comprovante de Endereço (nominal ao candidato)' },
  { chave: 'certidao_nascimento_filhos', nome: 'Certidão de Nascimento dos filhos menores de 14 anos', condicional: true, condicionalTipo: 'DEPENDENTE' },
  { chave: 'carteira_vacinacao_dependentes', nome: 'Carteira de Vacinação dos dependentes menores de 14 anos', condicional: true, condicionalTipo: 'DEPENDENTE' },
  { chave: 'rg_cpf_filhos', nome: 'RG e CPF dos filhos com até 21 anos', condicional: true, condicionalTipo: 'DEPENDENTE' },
  { chave: 'comprovante_matricula_filhos', nome: 'Comprovante de Matrícula escolar dos filhos dependentes', condicional: true, condicionalTipo: 'DEPENDENTE' },
  { chave: 'formulario_vale_transporte', nome: 'Formulário do Vale Transporte' },
  { chave: 'formulario_admissional', nome: 'Formulário Admissional' },
  { chave: 'carteirinha_conselho', nome: 'Carteirinha do Conselho de Classe (ex: COREN)', condicional: true, condicionalTipo: 'CONSELHO' },
  { chave: 'antecedentes_criminais', nome: 'Certidão de Antecedentes Criminais' },
  { chave: 'certidao_etica', nome: 'Certidão de Antecedentes Éticos (Conselho de Classe)', condicional: true, condicionalTipo: 'CONSELHO' },
]

async function main() {
  console.log('🌱 Semeando catálogo de documento_tipos...')

  for (let i = 0; i < DOCUMENTO_TIPOS.length; i++) {
    const item = DOCUMENTO_TIPOS[i]
    await prisma.documentoTipo.upsert({
      where: { chave: item.chave },
      update: {
        nome: item.nome,
        condicional: item.condicional ?? false,
        condicionalTipo: item.condicionalTipo ?? null,
        ordem: i,
      },
      create: {
        chave: item.chave,
        nome: item.nome,
        condicional: item.condicional ?? false,
        condicionalTipo: item.condicionalTipo ?? null,
        ordem: i,
      },
    })
  }

  console.log(`✅ ${DOCUMENTO_TIPOS.length} tipos de documento sincronizados`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
