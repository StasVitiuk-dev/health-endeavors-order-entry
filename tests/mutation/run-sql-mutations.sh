#!/usr/bin/env bash
# LOCAL ONLY (2026-10-06, EXT3 workstream 6): mutation check for the R1–R5
# draft (docs/ops/sql/drafts/10_DRAFT_stock_functions.sql). For each
# mutation: copy the local real-shape database into a throwaway one, install
# a copy of the draft with ONE rule broken on purpose, run the SQL tests, and
# report whether they failed (= the tests really protect that rule). The
# draft file itself is never changed. Never point this at Supabase.
# Usage (repo root): tests/mutation/run-sql-mutations.sh -h /var/tmp/hepg -p 5499 -U postgres
set -u
CONN=("$@")
SRC_DB=he_real
DB=he_sqlmut
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DRAFT="$ROOT/docs/ops/sql/drafts/10_DRAFT_stock_functions.sql"
T15="$ROOT/docs/ops/sql/drafts/15_DRAFT_tests_stock_functions_real_shape.sql"
T16="$ROOT/docs/ops/sql/drafts/16_DRAFT_tests_hardening_and_failures.sql"
PKG="$ROOT/docs/ops/sql/local-test/install_package_test.sh"
TMP=$(mktemp -d)

# name | exact text to find (one line) | replacement
MUTATIONS=(
  "owner/admin check removed from the stock helper|  if not public.is_owner_or_admin() then\n    raise exception 'Only the Owner or an Administrator can change stock.'|  if false then\n    raise exception 'Only the Owner or an Administrator can change stock.'"
  "below-zero refusal removed|  if v_new < 0 then|  if false then"
  "purchase order can be received twice|  if v_po.status = 'received' then|  if false then"
  "fully received lines are stocked again|    continue when v_outstanding <= 0;|    continue when false;"
  "return restocked twice (status check removed)|  if v_ret.status <> 'approved' then|  if false then"
  "sold product can be deleted (X3-13)|  if exists (select 1 from order_items oi join products p on lower(p.sku) = lower(oi.sku)|  if false and exists (select 1 from order_items oi join products p on lower(p.sku) = lower(oi.sku)"
  "unknown stock bucket accepted|  if p_bucket not in ('available','reserved','damaged','sample','wholesale','promotional','returned','recalled') then|  if false then"
)

run_tests() {  # prints "FAILED" if any SQL test raised
  local out
  out=$( { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$T15"; psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$T16"; } 2>&1 )
  echo "$out" | grep -q "ERROR" && echo FAILED || echo passed
}

caught=0; missed=0
for m in "${MUTATIONS[@]}"; do
  name="${m%%|*}"; rest="${m#*|}"; find="${rest%%|*}"; repl="${rest#*|}"
  MUT="$TMP/10_mutated.sql"
  FIND="$find" REPL="$repl" python3 -c "
import os,sys
s=open(sys.argv[1]).read(); f=os.environ['FIND'].replace('\\\\n','\n'); r=os.environ['REPL'].replace('\\\\n','\n')
if s.count(f)!=1: print('NOTFOUND'); sys.exit(0)
open(sys.argv[2],'w').write(s.replace(f,r)); print('OK')" "$DRAFT" "$MUT" > "$TMP/applied"
  if [ "$(cat "$TMP/applied")" != OK ]; then echo "MISS $name → MUTATION NOT APPLIED (text not found)"; missed=$((missed+1)); continue; fi
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC_DB" >/dev/null || { echo "cannot copy $SRC_DB"; exit 2; }
  psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$MUT" >/dev/null 2>&1
  if [ "$(run_tests)" = FAILED ]; then echo "OK   $name → CAUGHT"; caught=$((caught+1)); else echo "MISS $name → NOT CAUGHT"; missed=$((missed+1)); fi
done

# The install preflight is checked by the install package tests, not 15/16.
sed 's/^  if array_length(missing, 1) > 0 then$/  if false then/' "$DRAFT" > "$TMP/10_nopre.sql"
if grep -q "if false then" "$TMP/10_nopre.sql"; then
  if INSTALL_FILE="$TMP/10_nopre.sql" bash "$PKG" "${CONN[@]}" > "$TMP/pkg.out" 2>&1; then echo "MISS install preflight disabled → NOT CAUGHT"; missed=$((missed+1)); else echo "OK   install preflight disabled → CAUGHT ($(grep -c FAIL "$TMP/pkg.out") failing checks)"; caught=$((caught+1)); fi
fi

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
rm -rf "$TMP"
echo "SQL MUTATIONS: $caught caught, $missed missed"
[ "$missed" -eq 0 ]
