-- Rollback manual e deliberado da migração de Admissão Digital.
-- Não é executado automaticamente pelo Prisma. Faça backup e interrompa a aplicação antes do uso.

DROP TABLE IF EXISTS "admission_audit_logs";
DROP TABLE IF EXISTS "erpnext_syncs";
DROP TABLE IF EXISTS "consent_records";
DROP TABLE IF EXISTS "signature_events";
DROP TABLE IF EXISTS "signature_envelopes";
DROP TABLE IF EXISTS "generated_documents";
DROP TABLE IF EXISTS "document_templates";
DROP TABLE IF EXISTS "face_verifications";
DROP TABLE IF EXISTS "badge_photos";
DROP TABLE IF EXISTS "admission_documents";
DROP TABLE IF EXISTS "admission_document_types";
DROP TABLE IF EXISTS "admission_transport_routes";
DROP TABLE IF EXISTS "admission_transports";
DROP TABLE IF EXISTS "admission_dependents";
DROP TABLE IF EXISTS "admission_fields";
DROP TABLE IF EXISTS "admission_tokens";
DROP TABLE IF EXISTS "admissions";

DROP TYPE IF EXISTS "ERPNextSyncStatus";
DROP TYPE IF EXISTS "SignatureEnvelopeStatus";
DROP TYPE IF EXISTS "GeneratedDocumentStatus";
DROP TYPE IF EXISTS "FaceVerificationStatus";
DROP TYPE IF EXISTS "AdmissionPriority";
DROP TYPE IF EXISTS "AdmissionDocumentStatus";
DROP TYPE IF EXISTS "AdmissionStatus";
