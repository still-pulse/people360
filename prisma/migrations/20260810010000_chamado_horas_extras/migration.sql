-- Separar "Horas extras" (crédito) de "Usar banco de horas" (débito)
ALTER TYPE "TipoSolicitacao" ADD VALUE IF NOT EXISTS 'HORAS_EXTRAS';
