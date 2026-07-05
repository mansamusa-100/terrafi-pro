ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "dismissed_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Alert_company_id_dismissed_at_idx" ON "Alert"("company_id", "dismissed_at");
