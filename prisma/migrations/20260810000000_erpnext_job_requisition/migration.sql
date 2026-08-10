-- Integração ERPNext Job Requisition → Vaga
-- Unique em requisicaoNextId (NULLs permitidos múltiplos no PostgreSQL)
-- Campos de controle de sync

ALTER TABLE "vagas" ADD COLUMN IF NOT EXISTS "erpnextStatus" TEXT;
ALTER TABLE "vagas" ADD COLUMN IF NOT EXISTS "erpnextSyncedAt" TIMESTAMP(3);

-- Índice unique em requisicaoNextId (só se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vagas_requisicaoNextId_key'
  ) THEN
    -- Remove duplicatas mantendo a mais recente, se houver
    DELETE FROM "vagas" a
    USING "vagas" b
    WHERE a."requisicaoNextId" IS NOT NULL
      AND a."requisicaoNextId" = b."requisicaoNextId"
      AND a."createdAt" < b."createdAt";

    CREATE UNIQUE INDEX "vagas_requisicaoNextId_key" ON "vagas"("requisicaoNextId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "vagas_status_idx" ON "vagas"("status");
