-- Agent float sync fields + biReports delivery log

ALTER TABLE "Agent" ADD COLUMN "phone_normalized" TEXT;
ALTER TABLE "Agent" ADD COLUMN "last_float_snapshot_at" TIMESTAMP(3);
ALTER TABLE "Agent" ADD COLUMN "float_balance_as_of" TIMESTAMP(3);
ALTER TABLE "Agent" ADD COLUMN "last_float_delivery_id" TEXT;

CREATE UNIQUE INDEX "Agent_company_id_phone_normalized_key"
  ON "Agent"("company_id", "phone_normalized");

CREATE TABLE "FloatDelivery" (
  "delivery_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "snapshot_at" TIMESTAMP(3) NOT NULL,
  "record_count" INTEGER NOT NULL,
  "updated_count" INTEGER NOT NULL,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "unknown_count" INTEGER NOT NULL DEFAULT 0,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'completed',
  CONSTRAINT "FloatDelivery_pkey" PRIMARY KEY ("delivery_id")
);
