-- Libera admissões que estavam aguardando a etapa biométrica agora desativada.
UPDATE "admissions"
SET
  "status" = 'CONTRACT_PENDING',
  "currentStep" = 'revisao',
  "progress" = GREATEST("progress", 82),
  "lastActivityAt" = CURRENT_TIMESTAMP
WHERE
  "processType" = 'ADMISSION'
  AND (
    "status" = 'FACE_VALIDATION_PENDING'
    OR ("currentStep" = 'validacao-facial' AND "status" = 'DOCUMENTS_APPROVED')
  );

-- Atualizações cadastrais não devem permanecer presas em um status biométrico legado.
UPDATE "admissions"
SET
  "status" = 'DOCUMENTS_UNDER_REVIEW',
  "currentStep" = 'conclusao',
  "progress" = 100,
  "lastActivityAt" = CURRENT_TIMESTAMP
WHERE
  "processType" = 'REGISTRATION_UPDATE'
  AND ("status" = 'FACE_VALIDATION_PENDING' OR "currentStep" = 'validacao-facial');
