#!/usr/bin/env bash
# LOCAL ONLY (Nov 27, 2026). Tests the read-only drift check for the owner's applied security fixes
# (docs/ops/sql/11_READONLY_security_fix_drift_check.sql) on the local throwaway database: the
# correct setup gives PASS three times, and each way it can drift gives its own FAIL, including the
# view having been removed. Until Nov 27 the query used a direct reference ('...'::regclass) that
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
  printf '%s\n' "$out" | cut -d'|' -f2 | paste -sd'#' | sed 's/#/ | /g'
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

echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
