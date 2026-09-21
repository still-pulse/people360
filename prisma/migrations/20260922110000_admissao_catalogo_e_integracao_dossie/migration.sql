-- AlterTable
ALTER TABLE "admissions" ADD COLUMN     "monthlyHours" INTEGER;

-- AlterTable
ALTER TABLE "admission_document_types" ADD COLUMN     "defaultSelected" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "colaborador_documentos" ADD COLUMN     "admissaoOrigemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_documentos_colaboradorId_admissaoOrigemId_key" ON "colaborador_documentos"("colaboradorId", "admissaoOrigemId");

