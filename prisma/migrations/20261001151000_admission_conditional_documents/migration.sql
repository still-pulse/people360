-- Documentos condicionais são obrigatórios somente quando aplicáveis; a aplicação
-- os marca como NOT_APPLICABLE conforme gênero, cargo e dependentes informados.
UPDATE "admission_document_types"
SET "required" = true
WHERE "key" IN (
  'certificado_militar',
  'rg_cpf_filhos',
  'certidao_nascimento_filhos',
  'carteira_vacinacao_dependentes',
  'comprovante_matricula_filhos'
);
