-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "departamento" TEXT;

-- CreateTable
CREATE TABLE "position_salaries" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "unitId" TEXT,
    "salario" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "position_salaries_unitId_idx" ON "position_salaries"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "position_salaries_positionId_unitId_key" ON "position_salaries"("positionId", "unitId");

-- AddForeignKey
ALTER TABLE "position_salaries" ADD CONSTRAINT "position_salaries_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_salaries" ADD CONSTRAINT "position_salaries_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Mantém a admissão digital funcionando: os salários que eram fixos no código viram o salário padrão (todas as unidades).
UPDATE "positions" SET "departamento" = 'Enfermagem' WHERE "name" IN ('Enfermeiro', 'Técnico de Enfermagem') AND "departamento" IS NULL;

INSERT INTO "position_salaries" ("id", "positionId", "unitId", "salario", "updatedAt")
SELECT 'ps' || md5(random()::text || p."id"), p."id", NULL, v.salario, CURRENT_TIMESTAMP
FROM "positions" p
JOIN (VALUES ('Enfermeiro', 3886.36), ('Técnico de Enfermagem', 2720.45)) AS v(name, salario) ON v.name = p."name"
WHERE NOT EXISTS (SELECT 1 FROM "position_salaries" s WHERE s."positionId" = p."id" AND s."unitId" IS NULL);
