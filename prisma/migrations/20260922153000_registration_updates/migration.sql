ALTER TABLE "admissions"
  ADD COLUMN "processType" TEXT NOT NULL DEFAULT 'ADMISSION',
  ADD COLUMN "collaboratorId" TEXT,
  ADD COLUMN "requestedSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "admissions"
  ADD CONSTRAINT "admissions_collaboratorId_fkey"
  FOREIGN KEY ("collaboratorId") REFERENCES "colaboradores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "admissions_processType_collaboratorId_idx"
  ON "admissions"("processType", "collaboratorId");
