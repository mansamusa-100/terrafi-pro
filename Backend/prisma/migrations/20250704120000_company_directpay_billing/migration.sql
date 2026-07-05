-- Add DirectPay / EasyPay subscription billing columns to Company
ALTER TABLE "Company"
  ADD COLUMN "directpay_business_id" TEXT,
  ADD COLUMN "directpay_slug" TEXT,
  ADD COLUMN "directpay_subscription_id" TEXT,
  ADD COLUMN "subscription_status" TEXT,
  ADD COLUMN "subscription_plan_code" TEXT,
  ADD COLUMN "subscription_period_start" TIMESTAMP(3),
  ADD COLUMN "subscription_period_end" TIMESTAMP(3),
  ADD COLUMN "subscription_billing_interval" TEXT,
  ADD COLUMN "subscription_pay_url" TEXT,
  ADD COLUMN "subscription_synced_at" TIMESTAMP(3);

-- Unique DirectPay business id per company
CREATE UNIQUE INDEX "Company_directpay_business_id_key" ON "Company"("directpay_business_id");
