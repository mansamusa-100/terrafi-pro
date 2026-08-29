-- Officer journey tracking + visit officer FK + configurable target classes

ALTER TABLE "Visit" ADD COLUMN "officer_id" TEXT;

UPDATE "Visit" v
SET "officer_id" = a."officer_id"
FROM "Agent" a
WHERE v."agent_id" = a.id AND a."officer_id" IS NOT NULL;

UPDATE "Visit" v
SET "officer_id" = u.id
FROM "User" u
WHERE v."officer_id" IS NULL
  AND v."officer" = u.name
  AND u.role = 'adr'
  AND u."company_id" = v."company_id";

ALTER TABLE "Visit"
  ADD CONSTRAINT "Visit_officer_id_fkey"
  FOREIGN KEY ("officer_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Visit_officer_id_visit_date_idx" ON "Visit"("officer_id", "visit_date");

ALTER TABLE "CompanySettings"
  ADD COLUMN "visit_target_classes" JSONB;

UPDATE "CompanySettings"
SET "visit_target_classes" = '{"exceeded_min":100,"met_min":80,"below_min":50}'::jsonb
WHERE "visit_target_classes" IS NULL;

CREATE TABLE "JourneySession" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "device_id" TEXT,
  CONSTRAINT "JourneySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LocationPing" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "session_id" TEXT,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "source" TEXT NOT NULL,
  "visit_id" INTEGER,
  "captured_at" TIMESTAMP(3) NOT NULL,
  "device_id" TEXT,
  CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "JourneySession"
  ADD CONSTRAINT "JourneySession_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JourneySession"
  ADD CONSTRAINT "JourneySession_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LocationPing"
  ADD CONSTRAINT "LocationPing_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LocationPing"
  ADD CONSTRAINT "LocationPing_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LocationPing"
  ADD CONSTRAINT "LocationPing_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "JourneySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LocationPing"
  ADD CONSTRAINT "LocationPing_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "JourneySession_user_id_started_at_idx" ON "JourneySession"("user_id", "started_at");
CREATE INDEX "JourneySession_company_id_started_at_idx" ON "JourneySession"("company_id", "started_at");
CREATE INDEX "LocationPing_user_id_captured_at_idx" ON "LocationPing"("user_id", "captured_at");
CREATE INDEX "LocationPing_company_id_captured_at_idx" ON "LocationPing"("company_id", "captured_at");
CREATE INDEX "LocationPing_session_id_idx" ON "LocationPing"("session_id");
