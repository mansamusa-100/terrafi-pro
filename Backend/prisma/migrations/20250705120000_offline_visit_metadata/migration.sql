-- Offline visit metadata: field capture time and device audit trail
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "offline_logged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "captured_at" TIMESTAMP(3);
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "device_id" TEXT;
