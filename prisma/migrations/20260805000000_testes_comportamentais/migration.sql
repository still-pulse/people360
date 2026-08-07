-- CreateEnum
CREATE TYPE "TipoTeste" AS ENUM ('BIG_FIVE', 'DISC');

-- CreateEnum
CREATE TYPE "TesteConviteStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'EXPIRADO', 'REVOGADO');

-- CreateTable
CREATE TABLE "teste_convites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tipo" "TipoTeste" NOT NULL,
    "status" "TesteConviteStatus" NOT NULL DEFAULT 'PENDENTE',
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "cargo" TEXT,
    "telefone" TEXT,
    "controleCandidatoId" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "enviadoAt" TIMESTAMP(3),
    "iniciadoAt" TIMESTAMP(3),
    "concluidoAt" TIMESTAMP(3),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teste_convites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teste_resultados" (
    "id" TEXT NOT NULL,
    "conviteId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "perfilPredominante" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teste_resultados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teste_convites_token_key" ON "teste_convites"("token");

-- CreateIndex
CREATE INDEX "teste_convites_tipo_idx" ON "teste_convites"("tipo");

-- CreateIndex
CREATE INDEX "teste_convites_status_idx" ON "teste_convites"("status");

-- CreateIndex
CREATE INDEX "teste_convites_nome_idx" ON "teste_convites"("nome");

-- CreateIndex
CREATE INDEX "teste_convites_createdById_idx" ON "teste_convites"("createdById");

-- CreateIndex
CREATE INDEX "teste_convites_controleCandidatoId_idx" ON "teste_convites"("controleCandidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "teste_resultados_conviteId_key" ON "teste_resultados"("conviteId");

-- CreateIndex
CREATE INDEX "teste_resultados_completedAt_idx" ON "teste_resultados"("completedAt");

-- AddForeignKey
ALTER TABLE "teste_convites" ADD CONSTRAINT "teste_convites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teste_convites" ADD CONSTRAINT "teste_convites_controleCandidatoId_fkey" FOREIGN KEY ("controleCandidatoId") REFERENCES "controle_candidatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teste_resultados" ADD CONSTRAINT "teste_resultados_conviteId_fkey" FOREIGN KEY ("conviteId") REFERENCES "teste_convites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
