-- Impede envelopes duplicados e numeração concorrente de aditivos.
CREATE UNIQUE INDEX "signature_envelopes_documentId_key"
  ON "signature_envelopes"("documentId");

CREATE UNIQUE INDEX "colaborador_aditivos_colaboradorId_numero_key"
  ON "colaborador_aditivos"("colaboradorId", "numero");
