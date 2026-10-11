#!/usr/bin/env bash
# LOCAL ONLY (2026-10-06, EXT3 workstream 9): install / re-install / rollback
# tests for the R1–R5 package (drafts/10 + drafts/11). Never point this at
# Supabase. It copies the local real-shape database into a throwaway database
# (he_pkg_test), runs every scenario there, and drops it at the end.
# Usage: install_package_test.sh <psql connection args without -d>
#   e.g. install_package_test.sh -h /var/tmp/hepg -p 5499 -U postgres
set -u
CONN=("$@")
SRC_DB=he_real
DB=he_pkg_test
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
INSTALL="${INSTALL_FILE:-$ROOT/docs/ops/sql/drafts/10_DRAFT_stock_functions.sql}"  # INSTALL_FILE: mutation runs only
ROLLBACK="$ROOT/docs/ops/sql/drafts/11_DRAFT_rollback_stock_functions.sql"
FUNCS="'_he_apply_stock_change','adjust_inventory','receive_purchase_order','quarantine_recall','receive_return','delete_unused_product'"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ok   $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL $1"; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" 2>&1; }
count_funcs() { q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ($FUNCS)"; }
fingerprint() { q "select md5(string_agg(p.proname || ':' || pg_get_function_identity_arguments(p.oid) || ':' || md5(p.prosrc), ',' order by p.proname)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ($FUNCS)"; }
expect_eq() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected '$3', got '$2')"; fi; }
fresh_db() {
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC_DB" >/dev/null || { echo "cannot copy $SRC_DB"; exit 2; }
  run "$ROLLBACK" >/dev/null   # start without the functions
}

echo "R1–R5 install package tests (throwaway database $DB)"

# 1. clean install ------------------------------------------------------------
fresh_db
expect_eq "1 start: no functions" "$(count_funcs)" "0"
out=$(run "$INSTALL"); [ -z "$(echo "$out" | grep ERROR)" ] && ok "1 clean install runs without error" || bad "1 clean install: $out"
expect_eq "1 six functions installed" "$(count_funcs)" "6"
expect_eq "1 anon can run none" "$(q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ($FUNCS) and has_function_privilege('anon', p.oid, 'EXECUTE')")" "0"
expect_eq "1 authenticated can run all six" "$(q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ($FUNCS) and has_function_privilege('authenticated', p.oid, 'EXECUTE')")" "6"
expect_eq "1 none runs with owner rights (security invoker)" "$(q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ($FUNCS) and p.prosecdef")" "0"
expect_eq "1 every function pins search_path" "$(q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ($FUNCS) and array_to_string(p.proconfig, ',') like '%search_path=public, pg_temp%'")" "6"
FP1=$(fingerprint)

# 2. second install (idempotent) ------------------------------------------------
out=$(run "$INSTALL"); [ -z "$(echo "$out" | grep ERROR)" ] && ok "2 second install runs without error" || bad "2 second install: $out"
expect_eq "2 still six functions" "$(count_funcs)" "6"
expect_eq "2 identical fingerprint after re-install" "$(fingerprint)" "$FP1"

# 3. partial prior state: only an old draft signature present -------------------
run "$ROLLBACK" >/dev/null
q "set role postgres; create function public.adjust_inventory(uuid, text, integer, text) returns integer language sql as 'select 1'" >/dev/null
out=$(run "$INSTALL"); [ -z "$(echo "$out" | grep ERROR)" ] && ok "3 install over a partial old state runs" || bad "3 partial: $out"
expect_eq "3 old draft signature removed, six current functions" "$(count_funcs)" "6"
expect_eq "3 same fingerprint as a clean install" "$(fingerprint)" "$FP1"

# 4. rollback, twice --------------------------------------------------------------
out=$(run "$ROLLBACK"); [ -z "$(echo "$out" | grep ERROR)" ] && ok "4 rollback runs" || bad "4 rollback: $out"
expect_eq "4 no functions left" "$(count_funcs)" "0"
out=$(run "$ROLLBACK"); [ -z "$(echo "$out" | grep ERROR)" ] && ok "4 second rollback is harmless" || bad "4 second rollback: $out"
expect_eq "4 rollback touches no table (products still readable)" "$(q "select (to_regclass('public.products') is not null and to_regclass('public.inventory') is not null)::text")" "true"

# 5. failure halfway: an error injected just before COMMIT --------------------------
SAB=$(mktemp); sed 's/^commit;$/select 1\/0;\ncommit;/' "$INSTALL" > "$SAB"
run "$SAB" >/dev/null
expect_eq "5 failure halfway installs nothing" "$(count_funcs)" "0"
run "$INSTALL" >/dev/null
sed 's/^commit;$/select 1\/0;\ncommit;/' "$INSTALL" > "$SAB"; run "$SAB" >/dev/null
expect_eq "5 a failed re-install leaves the previous six intact" "$(count_funcs)" "6"
expect_eq "5 ...unchanged (same fingerprint)" "$(fingerprint)" "$FP1"
rm -f "$SAB"

# 6. missing prerequisite: is_owner_or_admin() absent -------------------------------
fresh_db
q "alter function public.is_owner_or_admin() rename to is_owner_or_admin_hidden" >/dev/null
out=$(run "$INSTALL")
echo "$out" | grep -q "missing: .*function public.is_owner_or_admin()" && ok "6 refuses and names the missing function" || bad "6 missing function: $out"
expect_eq "6 nothing installed" "$(count_funcs)" "0"

# 7. wrong schema shape: a column the functions use is missing ------------------------
fresh_db
q "alter table public.purchase_order_items drop column landed_unit_cost" >/dev/null
out=$(run "$INSTALL")
echo "$out" | grep -q "column purchase_order_items.landed_unit_cost" && ok "7 refuses and names the missing column" || bad "7 wrong shape: $out"
expect_eq "7 nothing installed" "$(count_funcs)" "0"

# 8. wrong constraint: the lot unique index (needed by ON CONFLICT) is missing ----------
fresh_db
IDX=$(q "select indexrelid::regclass from pg_index where indrelid='public.inventory_lots'::regclass and indisunique and pg_get_indexdef(indexrelid) ~* 'lower'")
if [ -n "$IDX" ]; then
  q "drop index $IDX" >/dev/null 2>&1 || q "alter table public.inventory_lots drop constraint $IDX" >/dev/null
  out=$(run "$INSTALL")
  echo "$out" | grep -q "unique index on inventory_lots" && ok "8 refuses when the lot unique index is missing" || bad "8 constraint: $out"
  expect_eq "8 nothing installed" "$(count_funcs)" "0"
else bad "8 could not find the lot unique index in the local schema"; fi

# 8b. wrong column type / missing table (EXT4) ----------------------------------------
fresh_db
q "alter table public.inventory alter column available type numeric" >/dev/null
out=$(run "$INSTALL")
echo "$out" | grep -q "type of inventory.available is numeric, expected integer" && ok "8b refuses a wrong column type and names it" || bad "8b wrong type: $out"
expect_eq "8b nothing installed" "$(count_funcs)" "0"
fresh_db
q "alter table public.recalls rename to recalls_hidden" >/dev/null
out=$(run "$INSTALL")
echo "$out" | grep -q "table public.recalls" && ok "8b refuses a missing table and names it" || bad "8b missing table: $out"
expect_eq "8b nothing installed (missing table)" "$(count_funcs)" "0"

# 8c. a hostile search_path cannot change who may change stock (EXT4) ----------------
fresh_db; run "$INSTALL" >/dev/null
out=$(q "insert into profiles (id, email, role) values ('00000000-0000-4000-8000-0000000000e8','emp8@example.test','employee') on conflict (id) do update set role='employee';
  create schema if not exists evil; create or replace function evil.is_owner_or_admin() returns boolean language sql as 'select true';
  grant usage on schema evil to authenticated; grant execute on function evil.is_owner_or_admin() to authenticated;
  set role authenticated; set search_path = evil, public; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000e8',false);
  select public.adjust_inventory((select id from public.products limit 1), 'available', 1, 'test', null)")
echo "$out" | grep -q "Only the Owner or an Administrator" && ok "8c a look-alike permission check earlier in search_path is ignored" || bad "8c search_path: $out"
expect_eq "8c functions are owned by the installing role" "$(q "select count(distinct pg_get_userbyid(p.proowner)) || ':' || min(pg_get_userbyid(p.proowner)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ($FUNCS)")" "1:postgres"

# 8d. reinstall after rollback gives the same functions (EXT4) ------------------------
run "$ROLLBACK" >/dev/null; run "$INSTALL" >/dev/null
expect_eq "8d reinstall after rollback: same fingerprint" "$(fingerprint)" "$FP1"
RUNBOOK_FP=$(grep -o 'Expected for the version reviewed on [0-9-]*: `[0-9a-f]\{32\}`' "$ROOT/docs/ops/R1-R5-INSTALL-RUNBOOK.md" | grep -o '[0-9a-f]\{32\}')
expect_eq "8d the runbook's expected fingerprint matches this file (update the runbook when the file changes)" "$RUNBOOK_FP" "$FP1"

# 9. permission refusal --------------------------------------------------------------
fresh_db; run "$INSTALL" >/dev/null
out=$(q "set role anon; select public.adjust_inventory(gen_random_uuid(), 'available', 1, 'test', null)")
echo "$out" | grep -q "permission denied" && ok "9 the public anon role is refused" || bad "9 anon: $out"
out=$(q "insert into profiles (id, email, role) values ('00000000-0000-4000-8000-0000000000e9','emp9@example.test','employee') on conflict (id) do update set role='employee'; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000e9',false); select public.adjust_inventory((select id from products limit 1), 'available', 1, 'test', null)")
echo "$out" | grep -q "Only the Owner or an Administrator" && ok "9 an employee is refused with a plain message" || bad "9 employee: $out"

# 10. re-install while staff are using the functions -----------------------------------
q "insert into profiles (id, email, role) values ('00000000-0000-4000-8000-0000000000a9','own9@example.test','owner') on conflict (id) do update set role='owner'" >/dev/null
PID=$(q "insert into products (name, sku) values ('PKG TEST', 'PKG-T') returning id")
q "insert into inventory (product_id, available) values ('$PID', 1000)" >/dev/null
ERRF=$(mktemp)
( for i in $(seq 1 40); do psql "${CONN[@]}" -d "$DB" -tAX -c "set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000a9',false); select public.adjust_inventory('$PID', 'available', 1, 'pkg test', null)" >/dev/null 2>>"$ERRF"; done ) &
LOOP=$!
for i in 1 2 3 4 5; do run "$INSTALL" >/dev/null; done
wait $LOOP
calls_ok=$(q "select count(*) from inventory_adjustments where product_id='$PID'")
stock=$(q "select available from inventory where product_id='$PID'")
[ "${calls_ok:-0}" -gt 0 ] && ok "10 calls really ran during the re-installs ($calls_ok of 40)" || bad "10 no call succeeded, so the check below proves nothing"
expect_eq "10 re-install during use: every successful call left exactly one history row (stock = 1000 + rows)" "$stock" "$((1000 + calls_ok))"
others=$(grep -v "does not exist" "$ERRF" | grep -c ERROR)
expect_eq "10 no unexpected errors during re-install (missing-function blips only)" "$others" "0"
expect_eq "10 still six functions afterwards" "$(count_funcs)" "6"
rm -f "$ERRF"

# 12. adversarial (EXT5) -----------------------------------------------------------------
fresh_db
# 12a. two installs at the same moment: both finish, one consistent result
( run "$INSTALL" > /tmp/he_inst_a.out 2>&1 ) & ( run "$INSTALL" > /tmp/he_inst_b.out 2>&1 ) & wait
expect_eq "12a two simultaneous installs: six functions, same fingerprint" "$(count_funcs):$(fingerprint)" "6:$FP1"
expect_eq "12a both copies finish without any error (the second waits for the first)" "$(cat /tmp/he_inst_a.out /tmp/he_inst_b.out | grep -c ERROR)" "0"
# 12b. third install in a row
run "$INSTALL" >/dev/null; run "$INSTALL" >/dev/null
expect_eq "12b third install: unchanged" "$(count_funcs):$(fingerprint)" "6:$FP1"
# 12c. same name and signature, different (old / wrong) body is replaced
q "create or replace function public.adjust_inventory(p_product_id uuid, p_bucket text, p_change integer, p_reason text default null, p_expected integer default null) returns jsonb language sql as \$x\$ select '{}'::jsonb \$x\$" >/dev/null
[ "$(fingerprint)" != "$FP1" ] && ok "12c a different body is visible in the fingerprint" || bad "12c fingerprint did not change for a different body"
run "$INSTALL" >/dev/null
expect_eq "12c re-install replaces the wrong body (fingerprint back to the reviewed one)" "$(fingerprint)" "$FP1"
# 12d. an unexpected extra index does not stop or change the install
fresh_db
q "create index he_extra_test_idx on public.inventory_lots (purchase_order_id)" >/dev/null
out=$(run "$INSTALL"); [ -z "$(echo "$out" | grep ERROR)" ] && ok "12d extra index: install runs" || bad "12d extra index: $out"
expect_eq "12d extra index: same fingerprint" "$(fingerprint)" "$FP1"
# 12e. rollback after a partial (hand-made) install, then install again
fresh_db
q "create function public._he_apply_stock_change(p uuid) returns void language sql as 'select'; create function public.quarantine_recall(p_recall_id uuid) returns jsonb language sql as \$x\$ select '{}'::jsonb \$x\$" >/dev/null
out=$(run "$ROLLBACK"); [ -z "$(echo "$out" | grep ERROR)" ] && ok "12e rollback over a partial install runs" || bad "12e rollback partial: $out"
left=$(q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ($FUNCS) and pg_get_function_identity_arguments(p.oid) <> 'p uuid'")
expect_eq "12e the reviewed signatures are gone after rollback" "$left" "0"
q "drop function if exists public._he_apply_stock_change(uuid)" >/dev/null
out=$(run "$INSTALL"); expect_eq "12e install after that rollback: six functions, reviewed fingerprint" "$(count_funcs):$(fingerprint)" "6:$FP1"
# 12f. reads keep working while the package is (re)installed
RF=$(mktemp)
( for i in $(seq 1 60); do psql "${CONN[@]}" -d "$DB" -tAX -c "select count(*) from products; select count(*) from inventory" >/dev/null 2>>"$RF"; done ) &
RL=$!
for i in 1 2 3 4; do run "$INSTALL" >/dev/null; done
wait $RL
expect_eq "12f table reads during re-installs: no error" "$(grep -c ERROR "$RF")" "0"
rm -f "$RF"
# 12g. a database without auth.uid() is refused by the preflight
fresh_db
q "alter function auth.uid() rename to uid_hidden" >/dev/null
out=$(run "$INSTALL")
echo "$out" | grep -q "function auth.uid()" && ok "12g refuses when auth.uid() is missing" || bad "12g auth.uid: $out"
expect_eq "12g nothing installed" "$(count_funcs)" "0"

# 13. PO line guard package (drafts/17 + 18, EXT5) -----------------------------------------
G17="$ROOT/docs/ops/sql/drafts/17_DRAFT_po_line_delete_guard.sql"; G18="$ROOT/docs/ops/sql/drafts/18_DRAFT_rollback_po_line_delete_guard.sql"
gcount() { q "select count(*) from pg_trigger where tgname='he_po_line_delete_guard'"; }
fresh_db
out=$(run "$G17"); [ -z "$(echo "$out" | grep ERROR)" ] && ok "13 guard installs" || bad "13 guard install: $out"
run "$G17" >/dev/null; expect_eq "13 second guard install: still exactly one trigger" "$(gcount)" "1"
run "$G18" >/dev/null; run "$G18" >/dev/null; expect_eq "13 rollback twice: no trigger, no error" "$(gcount)" "0"
expect_eq "13 rollback removes the function too" "$(q "select count(*) from pg_proc where proname='_he_po_line_delete_guard'")" "0"
q "alter table public.purchase_order_items rename to poi_hidden" >/dev/null
out=$(run "$G17"); echo "$out" | grep -q "Install stopped, nothing was changed" && ok "13 guard preflight refuses a missing table" || bad "13 guard preflight: $out"
q "alter table public.poi_hidden rename to purchase_order_items" >/dev/null
expect_eq "13 nothing installed after the refusal" "$(gcount)" "0"

# 11. the install file itself: one transaction, preflight first --------------------------
first_stmt=$(grep -vE '^\s*(--|$)' "$INSTALL" | head -1)
expect_eq "11 first statement is BEGIN" "$first_stmt" "begin;"
last_stmt=$(grep -vE '^\s*(--|$)' "$INSTALL" | tail -1)
expect_eq "11 last statement is COMMIT" "$last_stmt" "commit;"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "TOTAL: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
