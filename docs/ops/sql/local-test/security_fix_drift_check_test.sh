#!/usr/bin/env bash
# LOCAL ONLY (Nov 27, 2026). Tests the read-only drift check for the owner's applied security fixes
# (docs/ops/sql/11_READONLY_security_fix_drift_check.sql) on the local throwaway database: the
# correct setup gives PASS, and each way it can drift gives its own FAIL, including the
# view having been removed. Nov 27 (late night): four FIX 3 rows (the ten owner-rights functions) added, section 4. Until Nov 27 the query used a direct reference ('...'::regclass) that
# made it STOP WITH AN ERROR when the view was missing, instead of saying "FAIL: view missing"; the
# last case proves the old text still fails that way, so the fix is what makes the difference.
# Every case runs inside BEGIN ... ROLLBACK on he_real: nothing is left behind.
# Usage (from the repository root): bash docs/ops/sql/local-test/security_fix_drift_check_test.sh -h <host> -p <port> -U <user>
set -u
C="$*"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
Q="$ROOT/docs/ops/sql/11_READONLY_security_fix_drift_check.sql"
pass=0; fail=0
ok() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
VIEW="create view public.activity_timeline with (security_invoker = true) as select 1 as x; revoke all on public.activity_timeline from anon;"
FN="create function public.guard_profile_privileged_columns() returns trigger language plpgsql as \$f\$ begin return new; end \$f\$;"
TRG="create trigger profiles_guard_privileged_columns before update on public.profiles for each row execute function public.guard_profile_privileged_columns();"
# run <setup sql> [query file] -> the three verdicts joined by " | ", or ERROR
run() {
  local out
  out=$(printf '%s\n' "begin;" "$1" "\\i ${2:-$Q}" "rollback;" | psql $C -d he_real -qAtX -F'|' -v ON_ERROR_STOP=1 2>&1) || { echo ERROR; return; }
  printf '%s\n' "$out" | sed -n "${ROWS:-1,3}p" | cut -d'|' -f2 | paste -sd'#' | sed 's/#/ | /g'
}

echo "1. the correct setup"
ok "PASS three times" "$(run "$VIEW $FN $TRG")" "PASS | PASS | PASS"

echo "2. each way the setup can drift is its own FAIL"
ok "the view removed (used to stop with an error)" "$(run "$FN $TRG")" "FAIL: view missing | FAIL: view missing | PASS"
ok "visitors may read the view again" "$(run "$VIEW grant select on public.activity_timeline to anon; $FN $TRG")" "FAIL: visitors can still read it | PASS | PASS"
ok "the view no longer uses the caller's rights" "$(run "$VIEW alter view public.activity_timeline set (security_invoker = false); $FN $TRG")" "PASS | FAIL: security_invoker not set | PASS"
ok "the guard removed" "$(run "$VIEW")" "PASS | PASS | FAIL: guard trigger missing"
ok "the guard switched off" "$(run "$VIEW $FN $TRG alter table public.profiles disable trigger profiles_guard_privileged_columns;")" "PASS | PASS | FAIL: guard trigger disabled"
ok "the guard runs after the change" "$(run "$VIEW $FN ${TRG/before update/after update}")" "PASS | PASS | FAIL: not a BEFORE trigger"
ok "the guard watches inserts, not updates" "$(run "$VIEW $FN ${TRG/before update/before insert}")" "PASS | PASS | FAIL: not on UPDATE"
ok "another function attached" "$(run "$VIEW $FN create function public.other_fn() returns trigger language plpgsql as \$f\$ begin return new; end \$f\$; ${TRG/guard_profile_privileged_columns()/other_fn()}")" "PASS | PASS | FAIL: wrong function attached (other_fn)"
ok "nothing there at all" "$(run "")" "FAIL: view missing | FAIL: view missing | FAIL: guard trigger missing"

echo "3. the old text stopped with an error when the view was missing"
OLD="$(mktemp)"; trap 'rm -f "$OLD"' EXIT
sed "s/c.oid = to_regclass('public.activity_timeline')/c.oid='public.activity_timeline'::regclass/" "$Q" > "$OLD"
ok "the old text (direct reference) errors" "$(run "$FN $TRG" "$OLD")" "ERROR"

echo "4. FIX 3 rows (4-7): the ten owner-rights functions"
F3NAMES="check_adverse_event_deadlines check_break_glass_usage check_stale_privacy_deletion_requests detect_unusual_activity escalate_overdue_tasks generate_daily_report"
F3="$(for f in $F3NAMES; do echo "create function public.$f() returns void language plpgsql security definer set search_path = public as \$f\$ begin end \$f\$;"; done)
create function public.raise_activity_alert(text,text,text,text) returns void language plpgsql security definer set search_path = public as \$f\$ begin end \$f\$;
create function public.log_customer_data_access(text,text) returns void language plpgsql security definer as \$f\$ begin end \$f\$;
create function public.record_alert(text,text,text,text,text,text,integer) returns boolean language plpgsql security definer as \$f\$ begin return true; end \$f\$;
create function public.generate_account_number() returns text language plpgsql security definer set search_path = public as \$f\$ begin return 'x'; end \$f\$;
alter function public.check_stale_privacy_deletion_requests() reset search_path; alter function public.escalate_overdue_tasks() reset search_path;"
JOBONLY="public.check_adverse_event_deadlines(), public.check_break_glass_usage(), public.check_stale_privacy_deletion_requests(), public.detect_unusual_activity(), public.escalate_overdue_tasks(), public.generate_daily_report(), public.raise_activity_alert(text,text,text,text)"
STAFF="public.log_customer_data_access(text,text), public.record_alert(text,text,text,text,text,text,integer), public.generate_account_number()"
# production before FIX 3: everyone (PUBLIC) plus visitors and staff by name; four paths unpinned
BEFORE="$F3 grant execute on function $JOBONLY, $STAFF to anon, authenticated;"
# production after FIX 3 (the end state the change-log SQL produces)
AFTER="$F3 revoke execute on function $JOBONLY from public, anon, authenticated; revoke execute on function $STAFF from public, anon;
grant execute on function $STAFF to authenticated;
alter function public.check_stale_privacy_deletion_requests() set search_path = public, extensions, pg_temp;
alter function public.escalate_overdue_tasks() set search_path = public, extensions, pg_temp;
alter function public.log_customer_data_access(text,text) set search_path = public, extensions, pg_temp;
alter function public.record_alert(text,text,text,text,text,text,integer) set search_path = public, extensions, pg_temp;"
export ROWS=4,7
ok "after FIX 3: PASS four times" "$(run "$AFTER")" "PASS | PASS | PASS | PASS"
ok "before FIX 3: each problem named" "$(run "$BEFORE")" "FAIL: visitors can run check_adverse_event_deadlines, check_break_glass_usage, check_stale_privacy_deletion_requests, detect_unusual_activity, escalate_overdue_tasks, generate_account_number, generate_daily_report, log_customer_data_access, raise_activity_alert, record_alert | FAIL: staff can run check_adverse_event_deadlines, check_break_glass_usage, check_stale_privacy_deletion_requests, detect_unusual_activity, escalate_overdue_tasks, generate_daily_report, raise_activity_alert | PASS | FAIL: no fixed path: check_stale_privacy_deletion_requests, escalate_overdue_tasks, log_customer_data_access, record_alert"
ok "visitors given one back" "$(run "$AFTER grant execute on function public.record_alert(text,text,text,text,text,text,integer) to anon;")" "FAIL: visitors can run record_alert | PASS | PASS | PASS"
ok "everyone (PUBLIC) given one back counts too" "$(run "$AFTER grant execute on function public.generate_daily_report() to public;")" "FAIL: visitors can run generate_daily_report | FAIL: staff can run generate_daily_report | PASS | PASS"
ok "staff given a job-only one" "$(run "$AFTER grant execute on function public.escalate_overdue_tasks() to authenticated;")" "PASS | FAIL: staff can run escalate_overdue_tasks | PASS | PASS"
ok "staff lose the privacy log (the dashboard would break)" "$(run "$AFTER revoke execute on function public.log_customer_data_access(text,text) from authenticated;")" "PASS | PASS | FAIL: staff cannot run public.log_customer_data_access(text,text) | PASS"
ok "a path unlocked again" "$(run "$AFTER alter function public.record_alert(text,text,text,text,text,text,integer) reset search_path;")" "PASS | PASS | PASS | FAIL: no fixed path: record_alert"
ok "one function gone" "$(run "$AFTER drop function public.raise_activity_alert(text,text,text,text);")" "FAIL: missing public.raise_activity_alert(text,text,text,text) | PASS | PASS | PASS"
ok "the sign-up service without the account number" "$(run "do \$r\$ begin if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if; end \$r\$; $AFTER")" "PASS | PASS | FAIL: sign-up service cannot run public.generate_account_number() | PASS"
ok "  ... and with it" "$(run "do \$r\$ begin if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if; end \$r\$; $AFTER grant execute on function public.generate_account_number() to supabase_auth_admin;")" "PASS | PASS | PASS | PASS"
unset ROWS
ok "FIX 1A, 1B and 2 rows unchanged by the new rows" "$(run "$VIEW $FN $TRG $AFTER")" "PASS | PASS | PASS"

echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
