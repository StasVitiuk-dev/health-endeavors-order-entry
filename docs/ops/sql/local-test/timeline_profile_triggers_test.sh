#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-18). Never point this at Supabase.
# Runs Query G3 (10_READONLY_G3_timeline_view_and_profile_triggers.sql) read-only
# on a throwaway copy of the local database with a planted activity_timeline
# view and a planted profiles trigger, and checks: the caller-filter verdict,
# the column list, a row COUNT only (no rows), the view text, trigger source
# with secret-looking lines removed, and the profiles update policies.
# Usage: timeline_profile_triggers_test.sh -h localhost -p 5433 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_g3_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"; Q="$DIR/10_READONLY_G3_timeline_view_and_profile_triggers.sql"
pass=0; fail=0
ok() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q() { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
g() { psql "${CONN[@]}" -d "$DB" -qtAX -F '|' -c "begin read only;" -f "$Q" -c "commit;" 2>&1; }
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
echo "Query G3 timeline view and profile triggers (throwaway database $DB)"
out=$(g)
ok "runs read-only with no timeline view present (no error, no T1 rows)" "$(echo "$out" | grep -c ERROR)|$(echo "$out" | grep -c '^T1')" "0|0"
q "insert into tasks (title) values ('SYNTHETIC a'), ('SYNTHETIC b');
   create view activity_timeline as select 'task'::text as kind, id::text as ref, title as summary, created_at as at from tasks;
   create function _g3_guard() returns trigger language plpgsql as \$f\$
   begin
     -- api_key = 'synthetic-not-a-secret'
     if new.role <> old.role and public."current_role"() <> 'owner' then raise exception 'only the owner can change roles'; end if;
     return new;
   end \$f\$;
   create trigger g3_role_guard before update on profiles for each row execute function _g3_guard();
   create policy g3_update_self on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());" >/dev/null
out=$(g)
ok "runs read-only (no error)" "$(echo "$out" | grep -c ERROR)" "0"
ok "unfiltered view is reported as NOT checking the caller" "$(echo "$out" | grep -c '^T1 view filters by caller|activity_timeline|NO:')" "1"
ok "columns are listed" "$(echo "$out" | grep '^T1 view columns|' | grep -c 'summary text')" "1"
ok "row count is a number only" "$(echo "$out" | grep -c '^T1 view row count|activity_timeline|2 rows in total')" "1"
ok "no row content is shown" "$(echo "$out" | grep -c 'SYNTHETIC a')" "0"
ok "trigger source is shown" "$(echo "$out" | grep -c 'only the owner can change roles')" "1"
ok "a secret-looking line is removed" "$(echo "$out" | grep -c 'synthetic-not-a-secret')|$(echo "$out" | grep -c '\[line removed\]')" "0|1"
ok "profiles update policies are listed" "$(echo "$out" | grep -c '^T2 profiles update policies|g3_update_self|PERMISSIVE UPDATE')" "1"
q "create or replace view activity_timeline as select 'task'::text as kind, id::text as ref, title as summary, created_at as at from tasks where is_owner_or_admin()" >/dev/null
out=$(g)
ok "a view that filters by the caller is reported YES" "$(echo "$out" | grep -c '^T1 view filters by caller|activity_timeline|YES:')" "1"
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
