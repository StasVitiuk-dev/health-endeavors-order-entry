#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-10, extension 9). Never point this at Supabase.
# Tests drafts/21 (stock function switches) and drafts/22 (its rollback) on a
# throwaway copy of the local database: all off, run twice = no change,
# refuses without R1–R5 or without an id default, rollback refuses while a
# switch is on, rollback removes exactly the five rows.
# Usage: stock_switches_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_switch_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >/dev/null 2>"$ERRF"; echo $?; }
fresh(){ psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
         psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
         q "create table if not exists public.feature_flags (id uuid primary key default gen_random_uuid(), flag_key text not null, label text, description text, enabled boolean not null default false);
            insert into public.feature_flags (flag_key, label, enabled) select 'shopify_order_sync', 'Shopify order sync', false where not exists (select 1 from public.feature_flags where flag_key='shopify_order_sync');" >/dev/null; }
ERRF=$(mktemp)
echo "Stock function switches (throwaway database $DB)"

fresh
ok "R1–R5 present in the copy" "$(q "select count(*) from pg_proc where proname in ('receive_purchase_order','adjust_inventory','quarantine_recall','receive_return','delete_unused_product')")" "5"
ok "install succeeds" "$(run "$DIR/drafts/21_DRAFT_stock_function_switches.sql")" "0"
ok "five switches, all off" "$(q "select count(*)||':'||count(*) filter (where enabled) from feature_flags where flag_key like 'stock_fn_%'")" "5:0"
ok "existing switch untouched" "$(q "select count(*) from feature_flags where flag_key='shopify_order_sync'")" "1"
ok "second install succeeds" "$(run "$DIR/drafts/21_DRAFT_stock_function_switches.sql")" "0"
ok "second install adds nothing" "$(q "select count(*) from feature_flags where flag_key like 'stock_fn_%'")" "5"
q "update feature_flags set enabled = true where flag_key = 'stock_fn_receive_po'" >/dev/null
ok "re-install keeps a switch the owner turned on" "$(run "$DIR/drafts/21_DRAFT_stock_function_switches.sql"; q "select enabled from feature_flags where flag_key='stock_fn_receive_po'")" "$(printf '0\nt')"
ok "rollback refused while a switch is on" "$(run "$DIR/drafts/22_DRAFT_rollback_stock_function_switches.sql")" "3"
ok "  with a plain message" "$(grep -c 'still on' "$ERRF")" "1"
ok "  and nothing removed" "$(q "select count(*) from feature_flags where flag_key like 'stock_fn_%'")" "5"
q "update feature_flags set enabled = false where flag_key like 'stock_fn_%'" >/dev/null
ok "rollback succeeds once all are off" "$(run "$DIR/drafts/22_DRAFT_rollback_stock_function_switches.sql")" "0"
ok "rollback removed exactly the five" "$(q "select count(*) from feature_flags where flag_key like 'stock_fn_%'")||$(q "select count(*) from feature_flags")" "0||1"

fresh
q "drop function public.receive_purchase_order(uuid, jsonb, date)" >/dev/null
ok "refused when R1–R5 are not installed" "$(run "$DIR/drafts/21_DRAFT_stock_function_switches.sql")" "3"
ok "  with a plain message" "$(grep -c 'install drafts/10' "$ERRF")" "1"
ok "  and nothing inserted" "$(q "select count(*) from feature_flags where flag_key like 'stock_fn_%'")" "0"

fresh
q "alter table feature_flags alter column id drop default" >/dev/null
ok "refused when id has no default" "$(run "$DIR/drafts/21_DRAFT_stock_function_switches.sql")" "3"
ok "  and nothing inserted" "$(q "select count(*) from feature_flags where flag_key like 'stock_fn_%'")" "0"

fresh
# The dashboard's install probes (owner-login.html STOCK_FN_PROBES) must never change anything.
q "insert into profiles (id, email, role) values ('00000000-0000-4000-8000-0000000000a9','own9@example.test','owner') on conflict (id) do update set role='owner'" >/dev/null
SNAP="select (select count(*) from inventory_adjustments)||'/'||(select coalesce(sum(available),0) from inventory)||'/'||(select count(*) from expenses)||'/'||(select count(*) from purchase_orders where status='received')||'/'||(select count(*) from products)||'/'||(select count(*) from returns where status='received')||'/'||(select count(*) from recalls where status='quarantined')"
before=$(q "$SNAP")
probe() { psql "${CONN[@]}" -d "$DB" -qtAX -c "set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000a9',false); $1" 2>&1 | grep -v "^CONTEXT\|^00000000-0000-4000" | head -1; }
Z=00000000-0000-0000-0000-000000000000
ok "R1 probe refused at its first check" "$(probe "select public.receive_purchase_order('$Z', '\"not-a-list\"'::jsonb)" | grep -c 'must be a list')" "1"
ok "R2 probe finds nothing" "$(probe "select public.quarantine_recall('$Z')" | grep -c 'no longer exists')" "1"
ok "R3 probe refused at its first check" "$(probe "select public.receive_return('$Z', '')" | grep -c 'Pick what happens')" "1"
ok "R4 probe finds no product" "$(probe "select public.adjust_inventory('$Z', 'available', 0)" | grep -c 'no longer exists')" "1"
ok "R5 probe finds nothing to delete" "$(probe "select public.delete_unused_product('$Z')")" '{"reason": "not_found", "deleted": false}'
ok "the probes changed nothing" "$(q "$SNAP")" "$before"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
rm -f "$ERRF"
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
