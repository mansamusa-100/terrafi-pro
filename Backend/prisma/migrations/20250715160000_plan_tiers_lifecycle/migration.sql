-- Terrafi Pro plan tiers + subscription access lifecycle
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "plan_tier" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "user_seats" INTEGER;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "subscription_grace_until" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "lock_state" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "renewal_notified_at" TIMESTAMP(3);

-- Backfill from legacy plan label when possible
UPDATE "Company"
SET "plan_tier" = CASE
  WHEN lower("plan") LIKE '%unlimited%' THEN 'unlimited'
  WHEN lower("plan") LIKE '%basic%' THEN 'basic'
  ELSE 'standard'
END
WHERE "plan_tier" IS NULL;

UPDATE "Company"
SET "user_seats" = CASE
  WHEN "plan_tier" = 'basic' THEN 25
  WHEN "plan_tier" = 'standard' THEN 50
  WHEN "plan_tier" = 'unlimited' THEN NULL
  ELSE 50
END
WHERE "plan_tier" IS NOT NULL AND "user_seats" IS NULL AND "plan_tier" <> 'unlimited';
