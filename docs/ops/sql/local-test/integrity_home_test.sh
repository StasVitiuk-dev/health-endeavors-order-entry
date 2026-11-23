#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-11, extension 10). Never point this at Supabase.
# Tests drafts/29 (Query F results readable on Home) and drafts/30 (rollback):
# refuses before drafts/25; installs the switch OFF; a run is logged as ok with
# its checks; a failing run is logged as failed and keeps no half results;
# owner/admin can read, staff and anon cannot; nobody signed in can write or
# run it; twice = no change; rollback refuses while on, then restores drafts/25.
# Usage: integrity_home_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_inthome_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
as()  { psql "${CONN[@]}" -d "$DB" -qtAX -c "set role authenticated; set request.jwt.claim.sub to '$1'; $2" 2>&1; }
run() { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >/dev/null 2>"$ERRF"; echo $?; }
ERRF=$(mktemp)
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "create table if not exists public.feature_flags (id uuid primary key default gen_random_uuid(), flag_key text not null, label text, description text, enabled boolean not null default false)" >/dev/null
OWNER=00000000-0000-4000-8000-0000000000d1; STAFF=00000000-0000-4000-8000-0000000000d2
q "insert into profiles (id, email, role, is_active) values ('$OWNER','owner-d1@example.test','owner',true), ('$STAFF','staff-d2@example.test','employee',true) on conflict (id) do update set role = excluded.role, is_active = true" >/dev/null
echo "Integrity results on Home (throwaway database $DB)"
FL="select count(*)||':'||count(*) filter (where enabled) from feature_flags where flag_key = 'integrity_results_home'"

ok "refused before drafts/25" "$(run "$DIR/drafts/29_DRAFT_integrity_results_on_home.sql")" "3"
ok "  says to install drafts/25 first" "$(grep -c 'install drafts/25' "$ERRF")" "1"
ok "  nothing created" "$(q "select (to_regclass('public.integrity_check_runs') is null)::int || ':' || ($FL)")" "1:0:0"
ok "drafts/25 installs" "$(run "$DIR/drafts/25_DRAFT_integrity_check_schedule.sql")" "0"
ok "drafts/29 installs" "$(run "$DIR/drafts/29_DRAFT_integrity_results_on_home.sql")" "0"
ok "  switch present and OFF" "$(q "$FL")" "1:0"
ok "second install changes nothing" "$(run "$DIR/drafts/29_DRAFT_integrity_results_on_home.sql"; q "$FL")" "$(printf '0\n1:0')"
SNAP="select (select count(*) from tasks)||'/'||(select count(*) from inventory_adjustments)||'/'||(select coalesce(sum(available),0) from inventory)||'/'||(select count(*) from expenses)"
before=$(q "$SNAP"); checks=$(q "select count(*) from integrity_check_f")
ok "a run returns one row per check" "$(q "select public.run_integrity_check()")" "$checks"
ok "  the attempt is logged ok with its count" "$(q "select status||':'||checks||':'||(finished_at is not null)::text from integrity_check_runs order by id desc limit 1")" "ok:$checks:true"
ok "  results carry the run id" "$(q "select count(*) from integrity_check_results where run_id = (select max(id) from integrity_check_runs)")" "$checks"
ok "  business data unchanged" "$(q "$SNAP")" "$before"
# make the check fail: the view now divides by zero
q "create or replace view integrity_check_f as select 'X'::text as section, 'boom'::text as check_name, (1/0)::bigint as findings, null::text as examples" >/dev/null
q "select public.run_integrity_check()" >/dev/null
ok "a failing run is logged as failed with its error" "$(q "select status||':'||(error ilike '%division by zero%')::text from integrity_check_runs order by id desc limit 1")" "failed:true"
ok "  and leaves no half results" "$(q "select count(*) from integrity_check_results where run_id = (select max(id) from integrity_check_runs)")" "0"
ok "owner can read runs and results" "$(as $OWNER "select (select count(*) from integrity_check_runs) || ':' || ((select count(*) from integrity_check_results) > 0)::text")" "2:true"
ok "staff sees nothing" "$(as $STAFF "select (select count(*) from integrity_check_runs) || ':' || (select count(*) from integrity_check_results)")" "0:0"
ok "anon cannot read" "$(psql "${CONN[@]}" -d "$DB" -qtAX -c "set role anon; select count(*) from integrity_check_runs" 2>&1 | grep -c 'permission denied')" "1"
ok "owner cannot write the log" "$(as $OWNER "insert into integrity_check_runs default values" | grep -c 'permission denied')" "1"
ok "owner cannot run it from the browser" "$(as $OWNER "select public.run_integrity_check()" | grep -c 'permission denied')" "1"
q "update feature_flags set enabled = true where flag_key = 'integrity_results_home'" >/dev/null
ok "rollback refused while the switch is on" "$(run "$DIR/drafts/30_DRAFT_rollback_integrity_results_on_home.sql")" "3"
ok "  nothing removed" "$(q "select (to_regclass('public.integrity_check_runs') is not null)::int")" "1"
q "update feature_flags set enabled = false where flag_key = 'integrity_results_home'" >/dev/null
ok "rollback succeeds when off" "$(run "$DIR/drafts/30_DRAFT_rollback_integrity_results_on_home.sql")" "0"
ok "  run log, column, policies and switch gone" "$(q "select (to_regclass('public.integrity_check_runs') is null)::int + (select count(*) from information_schema.columns where table_name='integrity_check_results' and column_name='run_id')::int + (select count(*) from pg_policies where tablename='integrity_check_results')::int + (select count(*) from feature_flags where flag_key='integrity_results_home')::int")" "1"
q "create or replace view integrity_check_f as select 'F00'::text as section, 'ok'::text as check_name, 0::bigint as findings, null::text as examples" >/dev/null
ok "  drafts/25's function works again" "$(q "select public.run_integrity_check()")" "1"
ok "second rollback is harmless" "$(run "$DIR/drafts/30_DRAFT_rollback_integrity_results_on_home.sql")" "0"
ok "drafts/26 still removes the rest" "$(run "$DIR/drafts/26_DRAFT_rollback_integrity_check_schedule.sql")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
rm -f "$ERRF"
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
