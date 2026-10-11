#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-10, extension 9). Never point this at Supabase.
# Tests drafts/25 (nightly Query F with saved results) and drafts/26
# (rollback) on a throwaway copy: installs without pg_cron (says it did not
# schedule), the view gives exactly Query F's answer, a run saves one row per
# check and changes no business data, staff cannot read the results, rollback
# removes everything.
# Usage: integrity_schedule_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_schedule_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run() { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
OUTF=$(mktemp)
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
echo "Nightly integrity check (throwaway database $DB)"

ok "install succeeds" "$(run "$DIR/drafts/25_DRAFT_integrity_check_schedule.sql")" "0"
ok "  says it did not schedule (no pg_cron here)" "$(grep -c 'NOT scheduled' "$OUTF")" "1"
F="$DIR/05_READONLY_F_daily_integrity_check.sql"
ok "the view gives exactly Query F's answer" "$(diff <(psql "${CONN[@]}" -d "$DB" -qtAX -f "$F" | sort) <(q "select section, check_name, findings, examples from integrity_check_f" | sort) >/dev/null && echo same)" "same"
SNAP="select (select count(*) from tasks)||'/'||(select count(*) from inventory_adjustments)||'/'||(select coalesce(sum(available),0) from inventory)||'/'||(select count(*) from expenses)"
before=$(q "$SNAP"); checks=$(q "select count(*) from integrity_check_f")
ok "a run saves one row per check" "$(q "select public.run_integrity_check()")" "$checks"
ok "  and they are stored" "$(q "select count(*) from integrity_check_results")" "$checks"
ok "  business data unchanged" "$(q "$SNAP")" "$before"
q "insert into integrity_check_results (run_at, section, check_name, found) values (now() - interval '100 days', 'old', 'old', 0)" >/dev/null
q "select public.run_integrity_check()" >/dev/null
ok "results older than 90 nights are dropped" "$(q "select count(*) from integrity_check_results where section = 'old'")" "0"
ok "signed-in users cannot read the results (no policy yet)" "$(psql "${CONN[@]}" -d "$DB" -qtAX -c "set role authenticated; select count(*) from integrity_check_results" 2>&1 | grep -c 'permission denied')" "1"
ok "signed-in users cannot run it" "$(psql "${CONN[@]}" -d "$DB" -qtAX -c "set role authenticated; select public.run_integrity_check()" 2>&1 | grep -c 'permission denied')" "1"
ok "rollback succeeds" "$(run "$DIR/drafts/26_DRAFT_rollback_integrity_check_schedule.sql")" "0"
ok "rollback removed view, table and function" "$(q "select (to_regclass('public.integrity_check_f') is null)::int + (to_regclass('public.integrity_check_results') is null)::int + (to_regprocedure('public.run_integrity_check()') is null)::int")" "3"
ok "second rollback is harmless" "$(run "$DIR/drafts/26_DRAFT_rollback_integrity_check_schedule.sql")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
rm -f "$OUTF"
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
