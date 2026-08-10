-- Horários obrigatórios em solicitações de horas (entrada/saída)
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "horaEntrada" TEXT;
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "horaSaida" TEXT;
