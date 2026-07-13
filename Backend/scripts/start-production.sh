#!/bin/sh
set -e

TRIES="${DB_CONNECT_RETRIES:-30}"
SLEEP="${DB_CONNECT_SLEEP:-3}"
REPAIRED=0

run_migrate() {
  OUTPUT=$(npx prisma migrate deploy 2>&1) && {
    echo "$OUTPUT"
    return 0
  }
  MIGRATE_EXIT=$?
  echo "$OUTPUT"
  return "$MIGRATE_EXIT"
}

try_repair_p3009() {
  if [ "$REPAIRED" = "1" ]; then
    return 1
  fi
  REPAIRED=1
  echo ""
  echo "P3009 detected — running automatic migration repair..."
  sh scripts/repair-migration.sh || return 1
  return 0
}

echo "Terrafi Pro — waiting for database..."

i=1
while [ "$i" -le "$TRIES" ]; do
  echo "Migration attempt $i/$TRIES..."

  if run_migrate; then
    echo "Database ready. Starting API..."
    exec node index.js
  fi

  if echo "$OUTPUT" | grep -q "P3009"; then
    if try_repair_p3009 && run_migrate; then
      echo "Database ready after repair. Starting API..."
      exec node index.js
    fi
    echo ""
    echo "ERROR: Migration repair failed (P3009)."
    echo "Run this SQL in the Coolify POSTGRES terminal, then redeploy:"
    echo '  DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
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
exit 1
