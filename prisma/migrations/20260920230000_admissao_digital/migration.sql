-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('DRAFT', 'LINK_SENT', 'IN_PROGRESS', 'AWAITING_DOCUMENTS', 'DOCUMENTS_UNDER_REVIEW', 'CORRECTION_REQUESTED', 'DOCUMENTS_APPROVED', 'FACE_VALIDATION_PENDING', 'CONTRACT_PENDING', 'SIGNATURE_PENDING', 'SIGNED', 'READY_FOR_ERPNEXT', 'SYNCING', 'SYNCED', 'ERPNEXT_ERROR', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AdmissionDocumentStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "AdmissionPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "FaceVerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'MANUAL_REVIEW', 'ERROR');

-- CreateEnum
CREATE TYPE "GeneratedDocumentStatus" AS ENUM ('DRAFT', 'GENERATED', 'SENT', 'SIGNED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SignatureEnvelopeStatus" AS ENUM ('CREATED', 'SENT', 'VIEWED', 'AUTHENTICATED', 'SIGNED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ERPNextSyncStatus" AS ENUM ('WAITING', 'PROCESSING', 'SUCCESS', 'ERROR', 'RETRYING');

-- CreateTable
CREATE TABLE "admissions" (
    "id" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "candidateId" TEXT,
    "vacancyId" TEXT,
    "unitId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdById" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT,
    "candidatePhone" TEXT,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "salary" DOUBLE PRECISION,
    "hazardPayPercentage" DOUBLE PRECISION,
    "workSchedule" TEXT,
    "breakSchedule" TEXT,
    "weeklyHours" INTEGER,
    "contractType" TEXT NOT NULL,
    "experienceDays" INTEGER,
    "contractEndDate" TIMESTAMP(3),
    "status" "AdmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" TEXT NOT NULL DEFAULT 'presentation',
    "priority" "AdmissionPriority" NOT NULL DEFAULT 'NORMAL',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_tokens" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenHint" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "firstUsedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_fields" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "searchHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_dependents" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpfMasked" TEXT,
    "cpfHash" TEXT,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "relationship" TEXT NOT NULL,
    "irrfDependent" BOOLEAN NOT NULL DEFAULT false,
    "childUnder14" BOOLEAN NOT NULL DEFAULT false,
    "proofPath" TEXT,
    "proofMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_dependents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_transports" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "requested" BOOLEAN NOT NULL,
    "refusalReason" TEXT,
    "declarationVersion" TEXT NOT NULL,
    "declarationAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_transports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_transport_routes" (
    "id" TEXT NOT NULL,
    "transportId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "outbound" DOUBLE PRECISION NOT NULL,
    "returnValue" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_transport_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_document_types" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "allowedMimeTypes" TEXT[] DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png']::TEXT[],
    "maxSizeBytes" INTEGER NOT NULL DEFAULT 15728640,
    "maxFiles" INTEGER NOT NULL DEFAULT 1,
    "requiresFrontBack" BOOLEAN NOT NULL DEFAULT false,
    "company" TEXT,
    "unitId" TEXT,
    "jobTitle" TEXT,
    "contractType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_documents" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "status" "AdmissionDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "side" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "storagePath" TEXT,
    "originalName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_photos" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "processedPath" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_verifications" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerRef" TEXT,
    "status" "FaceVerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resultMetadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "face_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_documents" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "status" "GeneratedDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "storagePath" TEXT,
    "signedStoragePath" TEXT,
    "originalHash" TEXT,
    "finalHash" TEXT,
    "validationTokenHash" TEXT,
    "validationCode" TEXT,
    "generatedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_envelopes" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerRef" TEXT,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT,
    "status" "SignatureEnvelopeStatus" NOT NULL DEFAULT 'CREATED',
    "transactionId" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_envelopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_events" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "hash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erpnext_syncs" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "status" "ERPNextSyncStatus" NOT NULL DEFAULT 'WAITING',
    "operation" TEXT NOT NULL DEFAULT 'CREATE_OR_UPDATE_EMPLOYEE',
    "idempotencyKey" TEXT NOT NULL,
    "employeeId" TEXT,
    "employeeCode" TEXT,
    "mappingVersion" TEXT NOT NULL DEFAULT 'v1',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "payloadSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erpnext_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_audit_logs" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admissions_protocol_key" ON "admissions"("protocol");

-- CreateIndex
CREATE INDEX "admissions_status_updatedAt_idx" ON "admissions"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "admissions_unitId_status_idx" ON "admissions"("unitId", "status");

-- CreateIndex
CREATE INDEX "admissions_ownerId_idx" ON "admissions"("ownerId");

-- CreateIndex
CREATE INDEX "admissions_candidateName_idx" ON "admissions"("candidateName");

-- CreateIndex
CREATE INDEX "admissions_hireDate_idx" ON "admissions"("hireDate");

-- CreateIndex
CREATE UNIQUE INDEX "admission_tokens_tokenHash_key" ON "admission_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "admission_tokens_admissionId_expiresAt_idx" ON "admission_tokens"("admissionId", "expiresAt");

-- CreateIndex
CREATE INDEX "admission_fields_admissionId_section_idx" ON "admission_fields"("admissionId", "section");

-- CreateIndex
CREATE INDEX "admission_fields_key_searchHash_idx" ON "admission_fields"("key", "searchHash");

-- CreateIndex
CREATE UNIQUE INDEX "admission_fields_admissionId_key_key" ON "admission_fields"("admissionId", "key");

-- CreateIndex
CREATE INDEX "admission_dependents_admissionId_idx" ON "admission_dependents"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "admission_transports_admissionId_key" ON "admission_transports"("admissionId");

-- CreateIndex
CREATE INDEX "admission_transport_routes_transportId_position_idx" ON "admission_transport_routes"("transportId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "admission_document_types_key_key" ON "admission_document_types"("key");

-- CreateIndex
CREATE INDEX "admission_document_types_unitId_active_position_idx" ON "admission_document_types"("unitId", "active", "position");

-- CreateIndex
CREATE INDEX "admission_documents_admissionId_status_idx" ON "admission_documents"("admissionId", "status");

-- CreateIndex
CREATE INDEX "admission_documents_status_uploadedAt_idx" ON "admission_documents"("status", "uploadedAt");

-- CreateIndex
CREATE INDEX "badge_photos_admissionId_createdAt_idx" ON "badge_photos"("admissionId", "createdAt");

-- CreateIndex
CREATE INDEX "face_verifications_admissionId_createdAt_idx" ON "face_verifications"("admissionId", "createdAt");

-- CreateIndex
CREATE INDEX "document_templates_key_active_idx" ON "document_templates"("key", "active");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_key_version_key" ON "document_templates"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "generated_documents_validationTokenHash_key" ON "generated_documents"("validationTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "generated_documents_validationCode_key" ON "generated_documents"("validationCode");

-- CreateIndex
CREATE INDEX "generated_documents_admissionId_status_idx" ON "generated_documents"("admissionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "signature_envelopes_providerRef_key" ON "signature_envelopes"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "signature_envelopes_transactionId_key" ON "signature_envelopes"("transactionId");

-- CreateIndex
CREATE INDEX "signature_envelopes_admissionId_status_idx" ON "signature_envelopes"("admissionId", "status");

-- CreateIndex
CREATE INDEX "signature_events_envelopeId_createdAt_idx" ON "signature_events"("envelopeId", "createdAt");

-- CreateIndex
CREATE INDEX "consent_records_admissionId_type_idx" ON "consent_records"("admissionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "erpnext_syncs_idempotencyKey_key" ON "erpnext_syncs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "erpnext_syncs_status_nextAttemptAt_idx" ON "erpnext_syncs"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "erpnext_syncs_admissionId_createdAt_idx" ON "erpnext_syncs"("admissionId", "createdAt");

-- CreateIndex
CREATE INDEX "admission_audit_logs_admissionId_createdAt_idx" ON "admission_audit_logs"("admissionId", "createdAt");

-- CreateIndex
CREATE INDEX "admission_audit_logs_action_createdAt_idx" ON "admission_audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vagas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_tokens" ADD CONSTRAINT "admission_tokens_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_fields" ADD CONSTRAINT "admission_fields_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_dependents" ADD CONSTRAINT "admission_dependents_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_transports" ADD CONSTRAINT "admission_transports_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_transport_routes" ADD CONSTRAINT "admission_transport_routes_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "admission_transports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_document_types" ADD CONSTRAINT "admission_document_types_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "admission_document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_photos" ADD CONSTRAINT "badge_photos_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_verifications" ADD CONSTRAINT "face_verifications_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "document_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "generated_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_events" ADD CONSTRAINT "signature_events_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "signature_envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erpnext_syncs" ADD CONSTRAINT "erpnext_syncs_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_audit_logs" ADD CONSTRAINT "admission_audit_logs_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_audit_logs" ADD CONSTRAINT "admission_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
