#!/bin/sh
# Clears a stuck failed Prisma migration (P3009) on fresh production databases.
set -e

cd "$(dirname "$0")/.."

MIGRATION="${1:-20250626200000_company_settings}"

echo "Repairing failed migration: $MIGRATION"

echo "Dropping partial CompanySettings table if present..."
npx prisma db execute --stdin <<'SQL' || true
DROP TABLE IF EXISTS "CompanySettings" CASCADE;
SQL

echo "Marking migration as rolled back..."
npx prisma migrate resolve --rolled-back "$MIGRATION"

echo "Re-applying migrations..."
npx prisma migrate deploy

echo "Repair complete."
