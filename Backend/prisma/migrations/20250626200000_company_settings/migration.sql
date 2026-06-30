-- CreateTable
CREATE TABLE "CompanySettings" (
    "company_id" TEXT NOT NULL,
    "default_float_threshold" INTEGER NOT NULL DEFAULT 5000,
    "visit_frequency_target" INTEGER NOT NULL DEFAULT 25,
    "alert_notification_delay_minutes" INTEGER NOT NULL DEFAULT 5,
    "auto_suspend_missed_visits_days" INTEGER NOT NULL DEFAULT 14,
    "active_zones" INTEGER NOT NULL DEFAULT 7,
    "sub_territories" INTEGER NOT NULL DEFAULT 24,
    "coverage_model" TEXT NOT NULL DEFAULT 'Officer-based',
    "core_wallet_api_status" TEXT NOT NULL DEFAULT 'Connected',
    "sms_gateway_status" TEXT NOT NULL DEFAULT 'Active',
    "email_notifications_status" TEXT NOT NULL DEFAULT 'Active',
    "export_format" TEXT NOT NULL DEFAULT 'Excel, PDF',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("company_id")
);

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed defaults for demo company
INSERT INTO "CompanySettings" ("company_id", "default_float_threshold", "visit_frequency_target", "alert_notification_delay_minutes", "auto_suspend_missed_visits_days", "active_zones", "sub_territories", "coverage_model", "core_wallet_api_status", "sms_gateway_status", "email_notifications_status", "export_format", "updated_at")
VALUES ('co-aps', 5000, 25, 5, 14, 7, 24, 'Officer-based', 'Connected', 'Active', 'Active', 'Excel, PDF', CURRENT_TIMESTAMP)
ON CONFLICT ("company_id") DO NOTHING;
