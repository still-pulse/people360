-- CreateEnum
CREATE TYPE "ColaboradorDocumentoStatus" AS ENUM ('RASCUNHO', 'AGUARDANDO_ASSINATURA', 'ASSINADO', 'VIGENTE', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ColaboradorDocumentoOrigem" AS ENUM ('GERADO', 'ANEXADO');

-- CreateTable
CREATE TABLE "colaborador_perfis" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "admissionId" TEXT,
    "nomeSocial" TEXT,
    "funcao" TEXT,
    "cbo" TEXT,
    "centroCusto" TEXT,
    "sindicato" TEXT,
    "jornada" TEXT,
    "escala" TEXT,
    "horario" TEXT,
    "localTrabalho" TEXT,
    "estadoCivil" TEXT,
    "nacionalidade" TEXT,
    "escolaridade" TEXT,
    "nomeMae" TEXT,
    "nomePai" TEXT,
    "rgOrgao" TEXT,
    "rgUf" TEXT,
    "rgEmissao" TEXT,
    "sensivel" JSONB,
    "atualizadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaborador_perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_documentos" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "origem" "ColaboradorDocumentoOrigem" NOT NULL DEFAULT 'GERADO',
    "status" "ColaboradorDocumentoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "templateKey" TEXT,
    "templateVersion" INTEGER,
    "dados" JSONB,
    "snapshot" JSONB,
    "assinaturas" JSONB,
    "vigenciaInicio" TIMESTAMP(3),
    "vigenciaFim" TIMESTAMP(3),
    "observacao" TEXT,
    "arquivoPath" TEXT,
    "arquivoNome" TEXT,
    "arquivoMime" TEXT,
    "arquivoTamanho" INTEGER,
    "hash" TEXT,
    "origemDocumentoId" TEXT,
    "criadoPorId" TEXT,
    "criadoPorNome" TEXT,
    "geradoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "canceladoPorNome" TEXT,
    "motivoCancelamento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaborador_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_aditivos" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "documentoId" TEXT,
    "numero" INTEGER NOT NULL,
    "tipoAlteracao" TEXT NOT NULL,
    "campoAlterado" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNovo" TEXT NOT NULL,
    "vigencia" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "clausulas" TEXT,
    "criadoPorId" TEXT,
    "criadoPorNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colaborador_aditivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_dependentes" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfMascarado" TEXT,
    "cpfCifrado" JSONB,
    "nascimento" TIMESTAMP(3) NOT NULL,
    "parentesco" TEXT NOT NULL,
    "sexo" TEXT,
    "dependenteIr" BOOLEAN NOT NULL DEFAULT false,
    "salarioFamilia" BOOLEAN NOT NULL DEFAULT false,
    "planoSaude" BOOLEAN NOT NULL DEFAULT false,
    "inclusaoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exclusaoEm" TIMESTAMP(3),
    "criadoPorNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaborador_dependentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_avaliacoes" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "periodoDias" INTEGER,
    "periodoInicio" TIMESTAMP(3),
    "periodoFim" TIMESTAMP(3),
    "avaliadorNome" TEXT,
    "respostas" JSONB NOT NULL,
    "modelo" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "parecer" TEXT,
    "decisao" TEXT,
    "observacoes" TEXT,
    "dataAvaliacao" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "criadoPorId" TEXT,
    "criadoPorNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaborador_avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_historico" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dataEvento" TIMESTAMP(3) NOT NULL,
    "titulo" TEXT NOT NULL,
    "anterior" TEXT,
    "novo" TEXT,
    "motivo" TEXT,
    "documentoId" TEXT,
    "aditivoId" TEXT,
    "responsavelId" TEXT,
    "responsavelNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colaborador_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_perfis_colaboradorId_key" ON "colaborador_perfis"("colaboradorId");

-- CreateIndex
CREATE INDEX "colaborador_documentos_colaboradorId_tipo_idx" ON "colaborador_documentos"("colaboradorId", "tipo");

-- CreateIndex
CREATE INDEX "colaborador_documentos_colaboradorId_createdAt_idx" ON "colaborador_documentos"("colaboradorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_aditivos_documentoId_key" ON "colaborador_aditivos"("documentoId");

-- CreateIndex
CREATE INDEX "colaborador_aditivos_colaboradorId_vigencia_idx" ON "colaborador_aditivos"("colaboradorId", "vigencia");

-- CreateIndex
CREATE INDEX "colaborador_dependentes_colaboradorId_exclusaoEm_idx" ON "colaborador_dependentes"("colaboradorId", "exclusaoEm");

-- CreateIndex
CREATE INDEX "colaborador_avaliacoes_colaboradorId_tipo_idx" ON "colaborador_avaliacoes"("colaboradorId", "tipo");

-- CreateIndex
CREATE INDEX "colaborador_historico_colaboradorId_dataEvento_idx" ON "colaborador_historico"("colaboradorId", "dataEvento");

-- CreateIndex
CREATE INDEX "colaborador_historico_colaboradorId_tipo_idx" ON "colaborador_historico"("colaboradorId", "tipo");

-- AddForeignKey
ALTER TABLE "colaborador_perfis" ADD CONSTRAINT "colaborador_perfis_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_documentos" ADD CONSTRAINT "colaborador_documentos_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_aditivos" ADD CONSTRAINT "colaborador_aditivos_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_aditivos" ADD CONSTRAINT "colaborador_aditivos_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "colaborador_documentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_dependentes" ADD CONSTRAINT "colaborador_dependentes_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_avaliacoes" ADD CONSTRAINT "colaborador_avaliacoes_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_historico" ADD CONSTRAINT "colaborador_historico_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

