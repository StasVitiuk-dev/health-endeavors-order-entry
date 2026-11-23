#!/usr/bin/env bash
# LOCAL TEST ONLY (EXT20, 2026-10-17). Never point this at Supabase.
# Runs Query A and Query A2 read-only on a throwaway copy of the local database,
# feeds the CSV to tests/tools/schema-drift.js, and checks the verdicts:
#   as shipped locally          → no FAIL (the local schema is what the page expects)
#   column renamed (display_name → full_name, the EXT19 bug in reverse) → FAIL naming it
#   a table the page reads dropped → FAIL "missing table"
#   a column type changed        → WARN "type mismatch"
# Usage: schema_drift_test.sh -h localhost -p 5433 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_drift_test
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"; SQL="$ROOT/docs/ops/sql"
T=$(mktemp -d)
pass=0; fail=0
ok() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q() { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
export_csv() { # Query A + A2 inside READ ONLY transactions, CSV like the Supabase export
  psql "${CONN[@]}" -d "$DB" -qX --csv -v ON_ERROR_STOP=1 -c "begin read only;" -f "$SQL/00_READONLY_A_schema.sql" -c "commit;" > "$T/a.csv" 2>"$T/a.err" || cat "$T/a.err"
  psql "${CONN[@]}" -d "$DB" -qX --csv -v ON_ERROR_STOP=1 -c "begin read only;" -f "$SQL/08_READONLY_A2_outside_tables.sql" -c "commit;" > "$T/a2.csv" 2>"$T/a2.err" || cat "$T/a2.err"
}
drift() { node "$ROOT/tests/tools/schema-drift.js" --export "$T/a.csv" --export "$T/a2.csv" 2>&1; }
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
echo "Schema drift (throwaway database $DB)"

export_csv
ok "Query A runs read-only (no error)" "$(cat "$T/a.err" | grep -c ERROR)" "0"
ok "Query A2 runs read-only (no error)" "$(cat "$T/a2.err" | grep -c ERROR)" "0"
out=$(drift)
ok "as shipped locally: no FAIL except the 24 outside tables the local database does not have" "$(echo "$out" | grep '^FAIL' | grep -vc 'missing table')|$(echo "$out" | grep -c '^FAIL missing table')" "0|24"
ok "  outside tables not present locally are reported by A2 as missing, not guessed" "$( [ "$(grep -c '^0 table missing' "$T/a2.csv")" -gt 10 ] && echo yes)" "yes"

q "alter table profiles rename column display_name to full_name" >/dev/null
q "drop table returns cascade" >/dev/null
q "alter table expenses alter column amount type double precision" >/dev/null
export_csv; out=$(drift)
ok "renamed column the page reads is FAIL" "$(echo "$out" | grep -c '^FAIL missing column: profiles.display_name')" "1"
ok "dropped table the page reads is FAIL" "$(echo "$out" | grep -c '^FAIL missing table: returns')" "1"
ok "changed column type is WARN" "$(echo "$out" | grep -c '^WARN type mismatch: expenses.amount')" "1"
ok "overall verdict FAIL" "$(echo "$out" | tail -1 | grep -c 'SCHEMA DRIFT: FAIL')" "1"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
rm -rf "$T"
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
