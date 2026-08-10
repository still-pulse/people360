-- Espelho de Employee (ERPNext) no People360
CREATE TABLE IF NOT EXISTS "colaboradores" (
    "id" TEXT NOT NULL,
    "erpnextId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "company" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "cellNumber" TEXT,
    "personalEmail" TEXT,
    "companyEmail" TEXT,
    "dateOfJoining" TIMESTAMP(3),
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "reportsTo" TEXT,
    "reportsToName" TEXT,
    "imagePath" TEXT,
    "employmentType" TEXT,
    "relievingDate" TIMESTAMP(3),
    "matricula" TEXT,
    "cpf" TEXT,
    "rg" TEXT,
    "secao" TEXT,
    "pcd" BOOLEAN NOT NULL DEFAULT false,
    "tipoDeficiencia" TEXT,
    "etnia" TEXT,
    "cargaHoraria" TEXT,
    "naturalidade" TEXT,
    "unitId" TEXT,
    "erpnextModified" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "colaboradores_erpnextId_key" ON "colaboradores"("erpnextId");
CREATE INDEX IF NOT EXISTS "colaboradores_status_idx" ON "colaboradores"("status");
CREATE INDEX IF NOT EXISTS "colaboradores_company_idx" ON "colaboradores"("company");
CREATE INDEX IF NOT EXISTS "colaboradores_designation_idx" ON "colaboradores"("designation");
CREATE INDEX IF NOT EXISTS "colaboradores_employeeName_idx" ON "colaboradores"("employeeName");
CREATE INDEX IF NOT EXISTS "colaboradores_unitId_idx" ON "colaboradores"("unitId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'colaboradores_unitId_fkey'
  ) THEN
    ALTER TABLE "colaboradores"
      ADD CONSTRAINT "colaboradores_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "units"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
