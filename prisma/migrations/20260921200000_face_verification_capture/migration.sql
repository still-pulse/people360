ALTER TABLE "face_verifications"
ADD COLUMN "capturePath" TEXT,
ADD COLUMN "captureMimeType" TEXT,
ADD COLUMN "captureSizeBytes" INTEGER,
ADD COLUMN "capturedAt" TIMESTAMP(3);
