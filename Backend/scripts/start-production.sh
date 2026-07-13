#!/bin/sh
set -e

TRIES="${DB_CONNECT_RETRIES:-30}"
SLEEP="${DB_CONNECT_SLEEP:-3}"

echo "Terrafi Pro — waiting for database..."

i=1
while [ "$i" -le "$TRIES" ]; do
  echo "Migration attempt $i/$TRIES..."
  if npx prisma migrate deploy; then
    echo "Database ready. Starting API..."
    exec node index.js
  fi
  echo "Database unreachable. Retrying in ${SLEEP}s..."
  sleep "$SLEEP"
  i=$((i + 1))
done

echo "ERROR: Could not reach database after $TRIES attempts."
echo "Check Coolify: app and PostgreSQL must be in the same project/environment/server,"
echo "and DATABASE_URL must use the Postgres INTERNAL connection URL."
exit 1
