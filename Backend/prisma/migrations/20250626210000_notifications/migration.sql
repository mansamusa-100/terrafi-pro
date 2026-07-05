CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_user_id_read_at_idx" ON "Notification"("user_id", "read_at");
CREATE INDEX "Notification_user_id_created_at_idx" ON "Notification"("user_id", "created_at" DESC);

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
