-- Team Lead (Regional Lead) role: ADR supervision assignments
CREATE TABLE IF NOT EXISTS "LeadAdrAssignment" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "adr_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,

    CONSTRAINT "LeadAdrAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadAdrAssignment_lead_id_adr_id_key" ON "LeadAdrAssignment"("lead_id", "adr_id");
CREATE INDEX IF NOT EXISTS "LeadAdrAssignment_lead_id_idx" ON "LeadAdrAssignment"("lead_id");
CREATE INDEX IF NOT EXISTS "LeadAdrAssignment_adr_id_idx" ON "LeadAdrAssignment"("adr_id");

ALTER TABLE "LeadAdrAssignment" DROP CONSTRAINT IF EXISTS "LeadAdrAssignment_lead_id_fkey";
ALTER TABLE "LeadAdrAssignment" ADD CONSTRAINT "LeadAdrAssignment_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadAdrAssignment" DROP CONSTRAINT IF EXISTS "LeadAdrAssignment_adr_id_fkey";
ALTER TABLE "LeadAdrAssignment" ADD CONSTRAINT "LeadAdrAssignment_adr_id_fkey" FOREIGN KEY ("adr_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadAdrAssignment" DROP CONSTRAINT IF EXISTS "LeadAdrAssignment_company_id_fkey";
ALTER TABLE "LeadAdrAssignment" ADD CONSTRAINT "LeadAdrAssignment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
