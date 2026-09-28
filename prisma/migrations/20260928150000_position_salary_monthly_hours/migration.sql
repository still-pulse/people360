-- Salário por cargo + unidade + carga horária mensal. Nulo = vale para qualquer carga (salários atuais).
ALTER TABLE "position_salaries" ADD COLUMN "carga_horaria_mensal" INTEGER;

-- A unicidade passa a incluir a carga horária.
DROP INDEX "position_salaries_positionId_unitId_key";
CREATE UNIQUE INDEX "position_salaries_positionId_unitId_carga_horaria_mensal_key" ON "position_salaries"("positionId", "unitId", "carga_horaria_mensal");
