-- Separar "Ausência" (dia inteiro) de "Ausência Parcial" (algumas horas, mesmo dia)
ALTER TYPE "TipoSolicitacao" ADD VALUE IF NOT EXISTS 'AUSENCIA_PARCIAL';
