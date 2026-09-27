-- AlterTable
ALTER TABLE "badge_photos" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- Fotos já confirmadas antes da aprovação pelo RH existir continuam válidas.
UPDATE "badge_photos" SET "approvedAt" = "confirmedAt" WHERE "confirmedAt" IS NOT NULL;
