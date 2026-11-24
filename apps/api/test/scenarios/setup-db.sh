#!/usr/bin/env bash
# تجهيز قاعدة بيانات الاختبارات: database فيها schema اسمها tenant_t متطبّق عليها كل الـ tenant migrations.
# الاستخدام: TEST_PG_HOST=localhost TEST_PG_PORT=5432 TEST_PG_USER=postgres bash apps/api/test/scenarios/setup-db.sh
set -euo pipefail
HOST=${TEST_PG_HOST:-/tmp}; PORT=${TEST_PG_PORT:-5544}; USER=${TEST_PG_USER:-postgres}; DB=${TEST_PG_DB:-nabtest}
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
PSQL="psql -h $HOST -p $PORT -U $USER -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 || $PSQL -d postgres -c "CREATE DATABASE $DB"
$PSQL -d "$DB" -c "DROP SCHEMA IF EXISTS tenant_t CASCADE; CREATE SCHEMA tenant_t;"
for f in "$ROOT"/packages/db/src/migrations/tenant/*.sql; do
  echo "→ $(basename "$f")"
  { echo "SET search_path TO tenant_t;"; cat "$f"; } | $PSQL -d "$DB" >/dev/null
done
echo "✅ $DB / tenant_t جاهزة"
