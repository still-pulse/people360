-- Pacote de documentos da admissão enviado à Autentique (assinatura eletrônica externa).
-- CreateTable
CREATE TABLE "external_signature_requests" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT,
    "signerPublicId" TEXT,
    "signLink" TEXT,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "packagePath" TEXT NOT NULL,
    "packageHash" TEXT NOT NULL,
    "pageMap" JSONB NOT NULL,
    "signedPath" TEXT,
    "signedHash" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedIp" TEXT,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_signature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_signature_requests_externalId_key" ON "external_signature_requests"("externalId");

-- CreateIndex
CREATE INDEX "external_signature_requests_admissionId_status_idx" ON "external_signature_requests"("admissionId", "status");

-- AddForeignKey
ALTER TABLE "external_signature_requests" ADD CONSTRAINT "external_signature_requests_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

