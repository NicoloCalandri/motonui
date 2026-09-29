#!/usr/bin/env sh
# Runs every supabase/tests/*.test.sql against a database with all migrations
# applied. Each file runs in its own transaction and rolls back.
# Exits 1 on any failure.
#
#   Local Supabase (default URL):  npm run db:start && npm run test:rls
#   Plain Postgres (CI):           SQL_TESTS_BOOTSTRAP=1 SUPABASE_DB_URL=... npm run test:rls
#     SQL_TESTS_BOOTSTRAP=1 first loads supabase/tests/support/supabase-stub.sql
#     and every migration. Use it only on an empty throwaway database.
set -u

DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
status=0
log="$(mktemp)"

run_file() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -X -f "$1" >"$log" 2>&1
}

if [ "${SQL_TESTS_BOOTSTRAP:-0}" = "1" ]; then
  for file in supabase/tests/support/supabase-stub.sql supabase/migrations/*.sql; do
    echo "-- apply $file"
    if ! run_file "$file"; then
      cat "$log"
      echo "FAILED to apply $file"
      rm -f "$log"
      exit 1
    fi
  done
fi

for file in supabase/tests/*.test.sql; do
  echo "== $file"
  if run_file "$file"; then
    grep -E 'NOTICE:  ok' "$log" | sed 's/^.*NOTICE:  /  /'
  else
    cat "$log"
    echo "FAILED: $file"
    status=1
  fi
done

rm -f "$log"
exit $status
