-- Ops activity report (sidebar page). Separate from in-app Notification inbox.
CREATE TABLE IF NOT EXISTS "NotificationReport" (
    "id" SERIAL NOT NULL,
    "scope" TEXT NOT NULL,
    "company_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "actor_email" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "entity_label" TEXT,
    "temporary_password" TEXT,
    "credential_delivery" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotificationReport_company_id_created_at_idx"
  ON "NotificationReport"("company_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "NotificationReport_scope_created_at_idx"
  ON "NotificationReport"("scope", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "NotificationReport_type_idx"
  ON "NotificationReport"("type");

ALTER TABLE "NotificationReport" DROP CONSTRAINT IF EXISTS "NotificationReport_company_id_fkey";
ALTER TABLE "NotificationReport" ADD CONSTRAINT "NotificationReport_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
