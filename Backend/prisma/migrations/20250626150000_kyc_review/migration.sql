-- KYC review workflow fields on agents
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "kyc_review_note" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "kyc_reviewed_at" TIMESTAMP(3);
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "kyc_reviewed_by_id" TEXT;

ALTER TABLE "Agent" DROP CONSTRAINT IF EXISTS "Agent_kyc_reviewed_by_id_fkey";
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_kyc_reviewed_by_id_fkey"
  FOREIGN KEY ("kyc_reviewed_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
