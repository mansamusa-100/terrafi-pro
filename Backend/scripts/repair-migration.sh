#!/bin/sh
# One-time repair when prisma migrate deploy is blocked by P3009 (failed migration record).
# Use on a fresh Coolify DB with no production data. See README / Coolify deploy notes.
set -e

cd "$(dirname "$0")/.."

echo "Marking failed company_settings migration as rolled back..."
npx prisma migrate resolve --rolled-back "20250626200000_company_settings"

echo "Re-applying migrations..."
npx prisma migrate deploy

echo "Done. Restart the application container."
