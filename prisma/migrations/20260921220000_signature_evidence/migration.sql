ALTER TABLE "signature_envelopes"
ADD COLUMN "signaturePath" TEXT,
ADD COLUMN "signatureMimeType" TEXT,
ADD COLUMN "signatureHash" TEXT,
ADD COLUMN "signedIp" TEXT,
ADD COLUMN "signedUserAgent" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "locationAccuracy" DOUBLE PRECISION;
