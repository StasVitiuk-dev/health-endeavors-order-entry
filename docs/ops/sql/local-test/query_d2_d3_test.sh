#!/usr/bin/env bash
# LOCAL TEST ONLY (written Nov 27, 2026; added to the repository the same night, after FIX 3 was applied).
# Tests read-only Query D2 (13_READONLY_D2_function_rights.sql) together with its reader
# (tests/tools/query-d2-interpret.js), and Query D3 (14_READONLY_D3_function_uses.sql), on a throwaway
# copy of the local database with planted stand-in functions (made-up bodies) for each case. The old
# reader (before #152) fails two of the D2 checks: it missed "everyone" listed last.
# Usage (from anywhere): query_d2_d3_test.sh -h <host> -p <port> -U <user>
set -u
CONN=("$@"); DB=he_d2_query_test; HERE="$(cd "$(dirname "$0")" && pwd)"; SQLDIR="$(cd "$HERE/.." && pwd)"; ROOT="$(cd "$HERE/../../../.." && pwd)"
READER="${READER:-$ROOT/tests/tools/query-d2-interpret.js}"; D2Q="$SQLDIR/13_READONLY_D2_function_rights.sql"; D3Q="$SQLDIR/14_READONLY_D3_function_uses.sql"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"; psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1; psql "${CONN[@]}" -d postgres -qX -c "drop role if exists d2_reader" >/dev/null 2>&1' EXIT
pass=0; fail=0
has() { if printf '%s' "$2" | grep -qF -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: [$3] not in output"; fi; }
hasnt() { if printf '%s' "$2" | grep -qF -- "$3"; then fail=$((fail+1)); echo "  FAIL $1: [$3] found"; else pass=$((pass+1)); echo "  ok   $1"; fi; }
q() { psql "${CONN[@]}" -d $DB -qtAX -v ON_ERROR_STOP=1 -c "$1" >/dev/null 2>&1 || { fail=$((fail+1)); echo "  SETUP FAILED: $1"; }; }
run() {   # $1 = output style: tab | pipe | csv
  case "$1" in
    tab)  psql "${CONN[@]}" -d $DB -qtAX -F $'\t' -c "begin read only;" -f "$D2Q" -c "commit;" > "$TMP/a.txt" 2>&1 ;;
    pipe) psql "${CONN[@]}" -d $DB -q -c "begin read only;" -f "$D2Q" -c "commit;" > "$TMP/a.txt" 2>&1 ;;
  esac
  local out code; out=$(node "$READER" "$TMP/a.txt" 2>&1); code=$?; printf '%s\nexit=%s' "$out" "$code"
}
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template he_real" >/dev/null || exit 2
q "do \$\$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end \$\$"
f() { q "create function public.$1 returns void language plpgsql $2 as \$b\$ begin $3 end \$b\$"; }
echo "Query D2 on planted stand-ins (throwaway database $DB)"
# 1 everyone may run it (never revoked), owner rights, no caller check, path not pinned
f "check_adverse_event_deadlines()" "security definer" "perform 1;"
# 2 visitors granted explicitly (Supabase's default for new functions)
f "check_break_glass_usage()" "security definer" "perform 1;"
q "revoke execute on function public.check_break_glass_usage() from public"; q "grant execute on function public.check_break_glass_usage() to anon, authenticated"
# 3 signed-in only: safe
f "check_stale_privacy_deletion_requests()" "security definer set search_path = public" "perform 1;"
q "revoke execute on function public.check_stale_privacy_deletion_requests() from public"; q "grant execute on function public.check_stale_privacy_deletion_requests() to authenticated"
# 4 everyone again after a revoke and re-grant (printed last); used by a scheduled job
f "escalate_overdue_tasks()" "security definer" "perform 1;"
q "revoke execute on function public.escalate_overdue_tasks() from public"; q "grant execute on function public.escalate_overdue_tasks() to authenticated"; q "grant execute on function public.escalate_overdue_tasks() to public"
# 5 everyone may run it, but the code checks the caller; path pinned
f "generate_daily_report()" "security definer set search_path = public" "if auth.uid() is null then raise exception 'no'; end if;"
# 6 two versions: one safe, one open to everyone (the open one must not hide behind the safe one)
f "log_customer_data_access(text)" "security definer" "perform 1;"
q "revoke execute on function public.log_customer_data_access(text) from public"; q "grant execute on function public.log_customer_data_access(text) to authenticated"
f "log_customer_data_access(text, integer)" "security definer" "perform 1;"
# 7, 8 safe
f "raise_activity_alert()" "security definer set search_path = public" "perform 1;"; q "revoke execute on function public.raise_activity_alert() from public"
f "record_alert()" "security definer set search_path = pg_catalog, public" "perform 1;"; q "revoke execute on function public.record_alert() from public"
# 10 checks the caller only through is_active_staff() (step 0 helper)
q "create or replace function public.is_active_staff() returns boolean language sql as 'select true'"
f "generate_account_number()" "security definer set search_path = public" "if not public.is_active_staff() then raise exception 'no'; end if;"
# (9 detect_unusual_activity left out on purpose for the first run)
echo " 1. one function missing: never a pass"
out=$(run tab)
has "exit 2" "$out" "exit=2"
has "names the missing one" "$out" "MISSING  detect_unusual_activity"
has "summary lists it as not found" "$(cat $TMP/a.txt)" "not found: detect_unusual_activity"
f "detect_unusual_activity()" "security definer set search_path = public" "perform 1;"; q "revoke execute on function public.detect_unusual_activity() from public"
echo " 2. no scheduled-job table"
out=$(run tab)
has "exit 0 (interpretable)" "$out" "exit=0"
has "summary says no job table" "$(cat $TMP/a.txt)" "scheduled-job table: not present"
has "everyone (never revoked) -> FAIL" "$out" "FAIL (visitor-callable, no caller gate -> FIX 3 target)  check_adverse_event_deadlines"
has "visitors granted -> FAIL" "$out" "FAIL (visitor-callable, no caller gate -> FIX 3 target)  check_break_glass_usage"
has "signed-in only -> OK" "$out" "OK (visitors already cannot call it)  check_stale_privacy_deletion_requests"
has "everyone printed last -> FAIL" "$out" "FAIL (visitor-callable, no caller gate -> FIX 3 target)  escalate_overdue_tasks"
has "code checks the caller -> REVIEW" "$out" "REVIEW (visitor-callable but gates on caller - read the gate)  generate_daily_report"
hasnt "  ... and its pinned path is seen" "$(printf '%s' "$out" | grep generate_daily_report)" "confirm pinned"
has "open second version is not hidden by the safe one -> FAIL" "$out" "FAIL (visitor-callable, no caller gate -> FIX 3 target)  log_customer_data_access"
has "unpinned path is flagged" "$(printf '%s' "$out" | grep check_adverse_event_deadlines)" "[search_path: confirm pinned]"
has "is_active_staff() gate: FAIL, never OK (the reader does not know that helper)" "$out" "FAIL (visitor-callable, no caller gate -> FIX 3 target)  generate_account_number"
has "the query itself names the helper" "$(grep generate_account_number $TMP/a.txt | grep 'D2 code')" "checks caller: is_active_staff()"
has "visitor check from the database itself" "$(grep 'D2 rights' $TMP/a.txt | grep check_break_glass_usage)" "visitor role can run it: YES"
has "overall" "$out" "Overall: FIX 3 targets confirmed"
hasnt "no function code in the answer" "$(cat $TMP/a.txt)" "perform 1"
echo " 3. with a scheduled-job table"
q "create schema cron"; q "create table cron.job (jobid bigint, jobname text, schedule text, command text)"
q "insert into cron.job values (1,'nightly-escalate','5 6 * * *','select public.escalate_overdue_tasks()'),(2,'other','0 * * * *','select 1'),(3,'not-a-match','0 1 * * *','select public.escalate_overdue_tasks_old()')"
out=$(run tab)
has "job noted on the right function" "$out" "escalate_overdue_tasks [used by a scheduled job -> keep privileged role]"
has "summary counts the jobs" "$(cat $TMP/a.txt)" "scheduled-job table: present, 3 jobs"
has "a similar name is not counted" "$out" "Scheduled jobs referencing these functions: 1"
echo " 4. a job table the reader may not read: said so, not 'no jobs'"
q "create role d2_reader nologin"; q "grant usage on schema cron to d2_reader"; q "grant select on all tables in schema public to d2_reader"
out=$(psql "${CONN[@]}" -d $DB -qtAX -F $'\t' -c "begin read only; set local role d2_reader;" -f "$D2Q" -c "commit;" 2>&1)
has "runs and says not readable" "$out" "present but NOT readable (jobs unknown)"
echo " 5. psql's own ' | ' layout reads the same"
out=$(run pipe)
has "same verdicts" "$out" "FAIL (visitor-callable, no caller gate -> FIX 3 target)  escalate_overdue_tasks [used by a scheduled job"
echo " 6. a cut-off answer is never a pass"
run tab >/dev/null; grep -v 'D2 summary' $TMP/a.txt > $TMP/cut.txt
node "$READER" $TMP/cut.txt >/dev/null 2>&1; c=$?; [ $c = 2 ] && { pass=$((pass+1)); echo "  ok   exit 2 without the summary"; } || { fail=$((fail+1)); echo "  FAIL exit $c"; }
echo " 7. it changes nothing (read-only transaction)"
before=$(psql "${CONN[@]}" -d $DB -qtAX -c "select md5(string_agg(oid::regprocedure::text||coalesce(proacl::text,''), ',' order by oid)) from pg_proc where pronamespace='public'::regnamespace")
run tab >/dev/null
after=$(psql "${CONN[@]}" -d $DB -qtAX -c "select md5(string_agg(oid::regprocedure::text||coalesce(proacl::text,''), ',' order by oid)) from pg_proc where pronamespace='public'::regnamespace")
[ "$before" = "$after" ] && { pass=$((pass+1)); echo "  ok   functions and rights unchanged"; } || { fail=$((fail+1)); echo "  FAIL changed"; }
echo " 8. a CSV copy (Supabase \"Copy as CSV\"), converted, reads the same"
psql "${CONN[@]}" -d $DB -q --csv -f "$D2Q" > "$TMP/a.csv" 2>&1; python3 -I -c 'import csv,sys
for r in csv.reader(open(sys.argv[1], newline="")): print("\t".join(c.replace("\t"," ").replace("\n"," ") for c in r))' "$TMP/a.csv" > "$TMP/b.txt"
r1=$(run tab); r2=$(node "$READER" "$TMP/b.txt" 2>&1; echo "exit=$?")
[ "$r1" = "$r2" ] && { pass=$((pass+1)); echo "  ok   same verdicts and exit code"; } || { fail=$((fail+1)); echo "  FAIL differs"; }

echo "Query D3 (where the functions are used) on a second throwaway copy"
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template he_real" >/dev/null || exit 2
q "create function public.generate_account_number() returns text language sql security definer set search_path=public as \$\$ select 'HE-0001' \$\$"
q "create table public.zz_accounts (id int, acct text default public.generate_account_number())"
q "create function public.record_alert() returns trigger language plpgsql security definer as \$\$ begin return new; end \$\$"
q "create trigger zz_alert after insert on public.zz_accounts for each row execute function public.record_alert()"
q "create function public.raise_activity_alert() returns void language plpgsql security definer as \$\$ begin perform 1; end \$\$"
q "create function public.zz_caller() returns trigger language plpgsql as \$\$ begin perform public.raise_activity_alert(); return new; end \$\$"
q "create trigger zz_call before update on public.zz_accounts for each row execute function public.zz_caller()"
q "create function public.generate_daily_report() returns table(day date, total numeric) language sql security definer as \$\$ select current_date, 0::numeric \$\$"
q "create view public.zz_report as select * from public.generate_daily_report()"
q "create function public.log_customer_data_access(p_customer_email text, p_reason text) returns void language plpgsql security definer as \$\$ begin perform 1; end \$\$"
q "alter table public.zz_accounts enable row level security"
q "create policy zz_pol on public.zz_accounts for select using (public.generate_account_number() is not null)"
q "create function public.escalate_overdue_tasks_v2() returns void language sql as \$\$ select 1 \$\$"
out=$(psql "${CONN[@]}" -d $DB -qtAX -F $'\t' -c "begin read only;" -f "$D3Q" -c "commit;" 2>&1)

has "return type of a function returning rows" "$out" $'D3 returns\tpublic.generate_daily_report()\tTABLE(day date, total numeric)'
has "arguments shown" "$out" "public.log_customer_data_access(p_customer_email text, p_reason text)"
has "column default found" "$out" $'D3 used by default\tpublic.generate_account_number()\tzz_accounts.acct'
has "trigger found" "$out" $'D3 is trigger on\tpublic.record_alert()\tzz_accounts.zz_alert'
has "called from another function, which runs with the caller's rights, and its trigger" "$out" $'D3 called by function\tpublic.raise_activity_alert()\tpublic.zz_caller (caller rights) | trigger on zz_accounts'
has "view found" "$out" $'D3 used by view\tpublic.generate_daily_report()\tpublic.zz_report'
has "policy found" "$out" $'D3 used by policy\tpublic.generate_account_number()\tzz_accounts.zz_pol'
has "who can run it" "$out" $'D3 can run it\tpublic.generate_account_number()\tanon, authenticated, postgres'
has "a longer, different name is not a use" "$(printf '%s' "$out" | grep -c escalate_overdue_tasks_v2 || true)" "0"
has "summary" "$out" "D3 summary"
q "revoke execute on function public.generate_account_number() from public, anon"
out=$(psql "${CONN[@]}" -d $DB -qtAX -F $'\t' -f "$D3Q" 2>&1)
has "after a revoke, the list shrinks" "$out" $'D3 can run it\tpublic.generate_account_number()\tpostgres'
echo "passed $pass, failed $fail"; [ $fail -eq 0 ]
