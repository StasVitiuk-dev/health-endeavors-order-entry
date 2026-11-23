#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-18). Never point this at Supabase.
# Runs Query G2 (09_READONLY_G2_views_and_profile_role_guard.sql) read-only on a
# throwaway copy of the local database, then with planted examples:
#   a view that skips RLS and anon can read        → V1 FAIL
#   a view that skips RLS and signed-in users read → V1 WARN
#   a security_invoker view                        → V1 PASS
#   a BEFORE UPDATE trigger on profiles naming role → listed, "mentions role: yes"
# Usage: views_profile_guard_test.sh -h localhost -p 5433 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_g2_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"; Q="$DIR/09_READONLY_G2_views_and_profile_role_guard.sql"
pass=0; fail=0
ok() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q() { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
g() { psql "${CONN[@]}" -d "$DB" -qtAX -F '|' -c "begin read only;" -f "$Q" -c "commit;" 2>&1; }
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "do \$\$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end \$\$" >/dev/null
echo "Query G2 views and profile role guard (throwaway database $DB)"
out=$(g)
ok "runs inside a READ ONLY transaction" "$(echo "$out" | grep -c ERROR)" "0"
ok "profiles role column right is reported" "$(echo "$out" | grep -c '^P1 profiles role column|')" "1"
q "create view v_skip as select id, email from profiles; grant select on v_skip to anon, authenticated;
   create view v_auth as select id from products; grant select on v_auth to authenticated;
   create view v_safe with (security_invoker=true) as select id from orders; grant select on v_safe to anon;
   create function _g2_guard() returns trigger language plpgsql as \$f\$ begin if new.role <> old.role then raise exception 'no'; end if; return new; end \$f\$;
   create trigger g2_role_guard before update on profiles for each row execute function _g2_guard();" >/dev/null
out=$(g)
ok "anon-readable view that skips RLS is FAIL" "$(echo "$out" | grep -c '^V1 view rights|FAIL|v_skip|')" "1"
ok "signed-in-readable view that skips RLS is WARN" "$(echo "$out" | grep -c '^V1 view rights|WARN|v_auth|')" "1"
ok "security_invoker view is PASS" "$(echo "$out" | grep -c '^V1 view rights|PASS|v_safe|')" "1"
ok "role guard trigger is listed, BEFORE UPDATE, mentions role" "$(echo "$out" | grep '^P1 profiles trigger|INFO|g2_role_guard|' | grep -c 'BEFORE UPDATE; mentions role: yes')" "1"
ok "no source code is returned" "$(echo "$out" | grep -ci 'raise exception')" "0"
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
