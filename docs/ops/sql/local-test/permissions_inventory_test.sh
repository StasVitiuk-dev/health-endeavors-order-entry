#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-10, extension 9). Never point this at Supabase.
# Runs Query G (06_READONLY_G_permissions_inventory.sql) on a throwaway copy of
# the local database: first as it is, then with one planted example of each
# problem, and checks each is reported. Also proves it runs read-only.
# Usage: permissions_inventory_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_perm_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"; G="$DIR/06_READONLY_G_permissions_inventory.sql"
pass=0; fail=0
ok() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()  { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
g()  { psql "${CONN[@]}" -d "$DB" -qtAX -F '|' -c "begin read only; $(cat "$G") commit;" 2>&1; }
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "do \$\$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end \$\$" >/dev/null
echo "Query G permissions inventory (throwaway database $DB)"

out=$(g)
ok "runs inside a READ ONLY transaction" "$(echo "$out" | grep -c 'ERROR')" "0"
ok "lists every policy (G02)" "$( [ "$(echo "$out" | grep -c '^G02 policy|INFO|')" -gt 5 ] && echo yes)" "yes"
ok "tasks update not open as shipped locally (G03 PASS)" "$(echo "$out" | grep '^G03' | cut -d'|' -f2)" "PASS"
ok "no anon table rights locally (no G04 row)" "$(echo "$out" | grep -c '^G04')" "0"
before=$(q "select count(*) from pg_policies")

q "create policy planted_open_update on tasks for update to authenticated using (true)" >/dev/null
q "grant select, insert on public.orders to anon" >/dev/null
q "grant select on public.products to anon" >/dev/null
q "create policy planted_read_2 on products for select to authenticated using (true)" >/dev/null
q "alter table public.expenses disable row level security" >/dev/null
out=$(g)
ok "open task update is FAIL (G03)" "$(echo "$out" | grep '^G03' | cut -d'|' -f2)" "FAIL"
ok "  and names the policy" "$(echo "$out" | grep '^G03' | grep -c planted_open_update)" "1"
ok "anon INSERT right is FAIL (G04)" "$(echo "$out" | grep '^G04 anon table rights|FAIL|orders|' | wc -l | tr -d ' ')" "1"
ok "anon SELECT-only right is WARN (G04)" "$(echo "$out" | grep -c '^G04 anon table rights|WARN|products|')" "1"
ok "duplicate read policies are WARN (G05)" "$(echo "$out" | grep -c '^G05 duplicate read policies|WARN|products|')" "1"
ok "table without RLS is FAIL (G01)" "$(echo "$out" | grep -c '^G01 no row-level security|FAIL|expenses|')" "1"
ok "running it changed nothing" "$(q "select count(*) from pg_policies")" "$((before+2))"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
