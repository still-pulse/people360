CREATE TABLE "admission_document_revisions" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "originalName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "status" "AdmissionDocumentStatus" NOT NULL,
  "uploadedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_document_revisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admission_document_revisions_documentId_version_key" ON "admission_document_revisions"("documentId", "version");
ALTER TABLE "admission_document_revisions" ADD CONSTRAINT "admission_document_revisions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "admission_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
