-- Remove built-in trial period (billing handled by external payment system)
UPDATE "Company" SET status = 'active' WHERE status = 'trial';
ALTER TABLE "Company" DROP COLUMN IF EXISTS "trial_ends_at";
