#!/usr/bin/env sh
# Runs every supabase/tests/*.test.sql against a database with all migrations
# applied (local Supabase by default: run `npm run db:start` first).
# Each file runs in its own transaction and rolls back. Exits 1 on any failure.
set -u

DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
status=0
log="$(mktemp)"

for file in supabase/tests/*.test.sql; do
  echo "== $file"
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -X -f "$file" >"$log" 2>&1; then
    grep -E 'NOTICE:  ok' "$log" | sed 's/^.*NOTICE:  /  /'
  else
    cat "$log"
    echo "FAILED: $file"
    status=1
  fi
done

rm -f "$log"
exit $status
