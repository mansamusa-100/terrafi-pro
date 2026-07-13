#!/bin/sh
set -e

TRIES="${DB_CONNECT_RETRIES:-30}"
SLEEP="${DB_CONNECT_SLEEP:-3}"

echo "Terrafi Pro — waiting for database..."

i=1
while [ "$i" -le "$TRIES" ]; do
  echo "Migration attempt $i/$TRIES..."
  OUTPUT=$(npx prisma migrate deploy 2>&1) || MIGRATE_EXIT=$?
  if [ -z "${MIGRATE_EXIT:-}" ]; then
    echo "$OUTPUT"
    echo "Database ready. Starting API..."
    exec node index.js
  fi

  echo "$OUTPUT"

  if echo "$OUTPUT" | grep -q "P3009"; then
    echo ""
    echo "ERROR: Failed migration recorded in the database (P3009)."
    echo "On a fresh deploy, reset Postgres or run: sh scripts/repair-migration.sh"
    echo "See: https://www.prisma.io/docs/guides/migrate/production-troubleshooting"
    exit 1
  fi

  if echo "$OUTPUT" | grep -q "P1001"; then
    echo "Database unreachable. Retrying in ${SLEEP}s..."
    sleep "$SLEEP"
    i=$((i + 1))
    continue
  fi

  echo "Migration failed. Retrying in ${SLEEP}s..."
  sleep "$SLEEP"
  i=$((i + 1))
done

echo "ERROR: Could not reach database after $TRIES attempts."
echo "Check Coolify: app and PostgreSQL must be in the same project/environment/server,"
echo "and DATABASE_URL must use the Postgres INTERNAL connection URL."
exit 1
