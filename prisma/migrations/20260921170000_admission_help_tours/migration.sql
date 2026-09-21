CREATE TYPE "AdmissionTourProgressStatus" AS ENUM ('STARTED', 'SKIPPED', 'COMPLETED');

CREATE TABLE "admission_tour_progress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "AdmissionTourProgressStatus" NOT NULL DEFAULT 'STARTED',
  "currentStep" INTEGER NOT NULL DEFAULT 0,
  "totalSteps" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admission_tour_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admission_tour_events" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "event" TEXT NOT NULL,
  "stepIndex" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_tour_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admission_tour_progress_userId_tourId_version_key" ON "admission_tour_progress"("userId", "tourId", "version");
CREATE INDEX "admission_tour_progress_userId_status_idx" ON "admission_tour_progress"("userId", "status");
CREATE INDEX "admission_tour_events_userId_tourId_version_idx" ON "admission_tour_events"("userId", "tourId", "version");
CREATE INDEX "admission_tour_events_event_createdAt_idx" ON "admission_tour_events"("event", "createdAt");

ALTER TABLE "admission_tour_progress" ADD CONSTRAINT "admission_tour_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admission_tour_events" ADD CONSTRAINT "admission_tour_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
