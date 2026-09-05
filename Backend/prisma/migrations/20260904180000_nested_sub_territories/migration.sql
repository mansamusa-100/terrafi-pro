ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "sub_territory_map" JSONB;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "sub_territory" TEXT;
