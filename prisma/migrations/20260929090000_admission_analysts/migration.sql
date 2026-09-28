-- Outros analistas responsáveis pela admissão (além do responsável principal).
-- CreateTable
CREATE TABLE "_AdmissionAnalysts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_AdmissionAnalysts_AB_unique" ON "_AdmissionAnalysts"("A", "B");

-- CreateIndex
CREATE INDEX "_AdmissionAnalysts_B_index" ON "_AdmissionAnalysts"("B");

-- AddForeignKey
ALTER TABLE "_AdmissionAnalysts" ADD CONSTRAINT "_AdmissionAnalysts_A_fkey" FOREIGN KEY ("A") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdmissionAnalysts" ADD CONSTRAINT "_AdmissionAnalysts_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

