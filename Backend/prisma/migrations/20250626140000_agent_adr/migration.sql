-- Link agents to ADR users (field officers)
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "officer_id" TEXT;

ALTER TABLE "Agent" DROP CONSTRAINT IF EXISTS "Agent_officer_id_fkey";
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_officer_id_fkey"
  FOREIGN KEY ("officer_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill officer_id from ADR user names in seed data
UPDATE "Agent" a
SET "officer_id" = u.id
FROM "User" u
WHERE u.role = 'adr'
  AND u.name = a.officer
  AND u.company_id = a.company_id
  AND a.officer_id IS NULL;
