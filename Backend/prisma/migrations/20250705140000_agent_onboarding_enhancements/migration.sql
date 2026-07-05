-- Agent onboarding enhancements
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "outlet_name" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "personal_phone" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "personal_phone_normalized" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "town_village" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "business_type_other" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "competitors_present" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "branding_present" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "location_photo_path" TEXT;

ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "business_types" JSONB;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "zone_names" JSONB;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "competitor_names" JSONB;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "branding_types" JSONB;
