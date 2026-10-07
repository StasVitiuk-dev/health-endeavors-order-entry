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
  "receive expense not rounded to cents (EXT4)|  v_total := round(v_items_value + v_extras, 2);|  v_total := v_items_value + v_extras;"
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

# EXT4: the column-type preflight is also checked by the install package tests.
sed 's/^     where c.data_type <> t.typ);$/     where false);/' "$DRAFT" > "$TMP/10_notypes.sql"
if grep -q "where false);" "$TMP/10_notypes.sql"; then
  if INSTALL_FILE="$TMP/10_notypes.sql" bash "$PKG" "${CONN[@]}" > "$TMP/pkg2.out" 2>&1; then echo "MISS install type check disabled → NOT CAUGHT"; missed=$((missed+1)); else echo "OK   install type check disabled → CAUGHT ($(grep -c FAIL "$TMP/pkg2.out") failing checks)"; caught=$((caught+1)); fi
else echo "MISS install type check disabled → MUTATION NOT APPLIED"; missed=$((missed+1)); fi

# EXT5: the PO line guard (drafts/17) is checked by the forced interleavings.
GUARD="$ROOT/docs/ops/sql/drafts/17_DRAFT_po_line_delete_guard.sql"
python3 - "$GUARD" "$TMP/17_noguard.sql" <<'PY'
import sys
s=open(sys.argv[1]).read()
f="  if found and v_status not in ('draft', 'ordered') then\n    raise exception 'Purchase order % is \"%\" now, so its lines can no longer be changed."
if s.count(f)!=1: print('NOTFOUND'); sys.exit(0)
open(sys.argv[2],'w').write(s.replace(f, f.replace('if found and', 'if false and'), 1))
PY
if [ -f "$TMP/17_noguard.sql" ]; then
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC_DB" >/dev/null
  psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$DRAFT" >/dev/null 2>&1
  if GUARD_FILE="$TMP/17_noguard.sql" bash "$ROOT/docs/ops/sql/local-test/po_race_interleavings.sh" "${CONN[@]}" -d "$DB" > "$TMP/race.out" 2>&1; then echo "MISS PO line guard disabled → NOT CAUGHT"; missed=$((missed+1)); else echo "OK   PO line guard disabled → CAUGHT ($(grep -o 'GUARDED FAILURES: [0-9]*' "$TMP/race.out"))"; caught=$((caught+1)); fi
else echo "MISS PO line guard disabled → MUTATION NOT APPLIED"; missed=$((missed+1)); fi

# EXT6: the guard's NOWAIT order lock (the fix for the dashboard's
# step-by-step receive) is checked by the browser-path interleavings. The
# mutant is the EXT5 version: a plain re-read with no lock.
python3 - "$GUARD" "$TMP/17_nolock.sql" <<'PY'
import sys
s=open(sys.argv[1]).read()
f="      perform 1 from purchase_orders where id = v_po for share nowait;"
if s.count(f)!=1: print('NOTFOUND'); sys.exit(0)
open(sys.argv[2],'w').write(s.replace(f, "      null;", 1))
PY
if [ -f "$TMP/17_nolock.sql" ]; then
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC_DB" >/dev/null
  if ONLY=guard KINDS="delete qty" GUARD_FILE="$TMP/17_nolock.sql" bash "$ROOT/docs/ops/sql/local-test/po_browser_path_races.sh" "${CONN[@]}" -d "$DB" > "$TMP/browser.out" 2>&1; then echo "MISS PO line guard order lock removed → NOT CAUGHT"; missed=$((missed+1)); else echo "OK   PO line guard order lock removed → CAUGHT ($(grep -o 'GUARDED: .*' "$TMP/browser.out"))"; caught=$((caught+1)); fi
else echo "MISS PO line guard order lock removed → MUTATION NOT APPLIED"; missed=$((missed+1)); fi

# EXT6: the request-key unique index (drafts/19) is checked by its own test.
KEYS="$ROOT/docs/ops/sql/drafts/19_DRAFT_request_keys.sql"
sed 's/create unique index if not exists %I/create index if not exists %I/' "$KEYS" > "$TMP/19_notunique.sql"
if grep -q "create index if not exists %I" "$TMP/19_notunique.sql"; then
  mkdir -p "$TMP/keys/drafts" "$TMP/keys/local-test"
  cp "$TMP/19_notunique.sql" "$TMP/keys/drafts/19_DRAFT_request_keys.sql"
  cp "$ROOT/docs/ops/sql/drafts/20_DRAFT_rollback_request_keys.sql" "$TMP/keys/drafts/"
  cp "$ROOT/docs/ops/sql/local-test/request_keys_test.sh" "$TMP/keys/local-test/"
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC_DB" >/dev/null
  if bash "$TMP/keys/local-test/request_keys_test.sh" "${CONN[@]}" -d "$DB" > "$TMP/keys.out" 2>&1; then echo "MISS request-key index not unique → NOT CAUGHT"; missed=$((missed+1)); else echo "OK   request-key index not unique → CAUGHT ($(grep -c FAIL "$TMP/keys.out") failing checks)"; caught=$((caught+1)); fi
else echo "MISS request-key index not unique → MUTATION NOT APPLIED"; missed=$((missed+1)); fi

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
rm -rf "$TMP"
echo "SQL MUTATIONS: $caught caught, $missed missed"
[ "$missed" -eq 0 ]
