-- Per-company PrixBI / biReports agent float integration credentials
CREATE TABLE "CompanyFloatIntegration" (
  "company_id" TEXT NOT NULL,
  "bireports_organization_id" TEXT,
  "api_key_enc" TEXT,
  "hmac_secret_enc" TEXT,
  "encryption_key_enc" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyFloatIntegration_pkey" PRIMARY KEY ("company_id"),
  CONSTRAINT "CompanyFloatIntegration_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CompanyFloatIntegration_bireports_organization_id_idx"
  ON "CompanyFloatIntegration"("bireports_organization_id");
