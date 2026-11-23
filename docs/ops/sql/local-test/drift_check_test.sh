#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-11, extension 10). Never point this at Supabase.
# Tests Query H (07_READONLY_H_drift_check.sql) on a throwaway copy through
# every stage: nothing installed; each draft installed; a switch ON; a switch
# ON in the wrong order; a tampered function (fingerprint); anon granted
# EXECUTE. Also proves it runs inside a READ ONLY transaction.
# Usage: drift_check_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_drift_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
H="$DIR/07_READONLY_H_drift_check.sql"
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run() { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >/dev/null 2>&1; echo $?; }
st()  { psql "${CONN[@]}" -d "$DB" -qtAX -F '|' -f "$H" 2>&1 | awk -F'|' -v id="$1" '$1==id {print $5}'; }
all() { psql "${CONN[@]}" -d "$DB" -qtAX -F '|' -f "$H" 2>&1 | awk -F'|' '{printf "%s=%s ", $1, $5}'; }
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "create table if not exists public.feature_flags (id uuid primary key default gen_random_uuid(), flag_key text not null, label text, description text, enabled boolean not null default false)" >/dev/null
echo "Query H drift check (throwaway database $DB)"
# the shared source may already hold R1-R5 (other local tests install them): start from none
psql "${CONN[@]}" -d "$DB" -qX -f "$DIR/drafts/11_DRAFT_rollback_stock_functions.sql" >/dev/null 2>&1

ok "runs inside a READ ONLY transaction" "$( { echo 'begin read only;'; cat "$H"; echo 'commit;'; } | psql "${CONN[@]}" -d "$DB" -qtAX 2>&1 | grep -c ERROR)" "0"
ok "nothing installed: 11 rows" "$(psql "${CONN[@]}" -d "$DB" -qtAX -f "$H" | wc -l | tr -d ' ')" "11"
ok "  every row NOT INSTALLED" "$(all)" "H01=NOT INSTALLED H02=NOT INSTALLED H03=NOT INSTALLED H04=NOT INSTALLED H05=NOT INSTALLED H06=NOT INSTALLED H07=NOT INSTALLED H08=NOT INSTALLED H09=NOT INSTALLED H10=NOT INSTALLED H11=NOT INSTALLED "

# wrong order: switches ON before what they need exists
q "insert into feature_flags (flag_key, enabled) values ('request_keys', true), ('integrity_results_home', true), ('stock_fn_adjust', true)" >/dev/null
ok "request keys ON without the columns: FAIL" "$(st H08)" "FAIL"
ok "nightly Home switch ON without the tables: FAIL" "$(st H09)" "FAIL"
ok "stock switch ON without its function: FAIL" "$(st H06)" "FAIL"
q "delete from feature_flags" >/dev/null

ok "drafts/10 installs" "$(run "$DIR/drafts/10_DRAFT_stock_functions.sql")" "0"
ok "  R1-R5 PASS (reviewed fingerprint)" "$(st H01)" "PASS"
ok "  anon cannot run them: PASS" "$(st H02)" "PASS"
ok "drafts/21 installs" "$(run "$DIR/drafts/21_DRAFT_stock_function_switches.sql")" "0"
ok "  five switches OFF: PASS" "$(st H03)$(st H04)$(st H05)$(st H06)$(st H07)" "PASSPASSPASSPASSPASS"
q "update feature_flags set enabled = true where flag_key = 'stock_fn_receive_po'" >/dev/null
ok "  a switch ON with its function verified: WARN (confirm it was deliberate)" "$(st H03)" "WARN"
q "do \$\$ begin execute regexp_replace(pg_get_functiondef('public.adjust_inventory'::regproc), '\\mbegin\\M', 'begin /* tampered */', 'i'); end \$\$" >/dev/null
ok "tampered function: H01 FAIL" "$(st H01)" "FAIL"
ok "  and the switch that is ON now FAILs too (impossible combination)" "$(st H03)" "FAIL"
ok "  switches still OFF stay PASS" "$(st H04)" "PASS"
q "grant execute on function public.adjust_inventory(uuid, text, integer, text, integer) to anon" >/dev/null 2>&1 || true
q "do \$\$ declare f regprocedure; begin select p.oid::regprocedure into f from pg_proc p where p.proname = 'adjust_inventory' limit 1; execute format('grant execute on function %s to anon', f); end \$\$" >/dev/null
ok "anon granted EXECUTE: H02 FAIL" "$(st H02)" "FAIL"

ok "drafts/19 installs" "$(run "$DIR/drafts/19_DRAFT_request_keys.sql")" "0"
ok "drafts/27 installs" "$(run "$DIR/drafts/27_DRAFT_request_keys_switch.sql")" "0"
ok "  request keys installed, switch OFF: PASS" "$(st H08)" "PASS"
ok "drafts/25 installs" "$(run "$DIR/drafts/25_DRAFT_integrity_check_schedule.sql")" "0"
ok "drafts/29 installs" "$(run "$DIR/drafts/29_DRAFT_integrity_results_on_home.sql")" "0"
ok "  nightly check installed, switch OFF: PASS" "$(st H09)" "PASS"
ok "drafts/17 installs" "$(run "$DIR/drafts/17_DRAFT_po_line_delete_guard.sql")" "0"
ok "  PO line guard: PASS" "$(st H10)" "PASS"
ok "drafts/23 installs" "$(run "$DIR/drafts/23_DRAFT_integrity_constraints.sql")" "0"
ok "  four integrity rules: PASS" "$(st H11)" "PASS"
ok "the check printed no function code" "$(psql "${CONN[@]}" -d "$DB" -qtAX -f "$H" | grep -ci 'language plpgsql\|returns ')" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
