-- Field staff (ADR, team lead, etc.) may use the same personal email in different companies.
-- Managers, internal staff, and platform users remain globally unique per email.

DROP INDEX IF EXISTS "User_email_key";

CREATE UNIQUE INDEX "User_email_platform_key"
  ON "User"("email")
  WHERE "company_id" IS NULL;

CREATE UNIQUE INDEX "User_email_company_key"
  ON "User"("email", "company_id")
  WHERE "company_id" IS NOT NULL;
