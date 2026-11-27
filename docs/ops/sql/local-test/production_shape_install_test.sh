#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-27). Never point this at Supabase.
# Installs every waiting database draft, in order, on a throwaway copy shaped like production as
# the owner's read-only looks of Nov 27 showed it:
#   * profiles.role is the fixed list app_role (owner, employee, ai_agent, administrator);
#   * current_role() returns app_role and checks only "not removed"; is_owner_or_admin() checks
#     role and "active" (both run with raised rights, as in production);
#   * is_active_staff() does NOT exist until drafts/72;
#   * profiles rules: a signed-in person reads their own row; the owner reads all.
# Why: on Nov 27 step A stopped in production on a helper the local stand-ins had and production
# did not. Every draft must now install on this shape. All rows synthetic.
# Usage: production_shape_install_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_production_shape_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
OUTF=$(mktemp)
run() { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "drop function if exists public.is_active_staff() cascade;
   drop policy if exists local_self on profiles;
   do \$\$ begin create type app_role as enum ('owner', 'employee', 'ai_agent', 'administrator'); exception when duplicate_object then null; end \$\$;
   alter table profiles alter column role drop default;
   alter table profiles alter column role type app_role using role::app_role;
   drop function if exists public.current_role() cascade;
   create function public.current_role() returns app_role language sql stable security definer set search_path = public as
     \$f\$ select role from public.profiles where id = auth.uid() and deleted_at is null; \$f\$;
   create or replace function public.is_owner_or_admin() returns boolean language sql stable security definer set search_path = public as
     \$f\$ select exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('owner'::app_role, 'administrator'::app_role) and profiles.is_active = true); \$f\$;
   create policy profiles_select_own on profiles for select using (id = auth.uid());
   create policy profiles_select on profiles for select using ((id = auth.uid()) or (public.current_role() = 'owner'::app_role));" >"$OUTF" 2>&1
echo "Every waiting draft installs on a copy shaped like production (throwaway database $DB)"
ok "set-up: the role is app_role and current_role() answers app_role" "$(q "select pg_get_function_result(to_regprocedure('public.current_role()'))")" "app_role"
ok "set-up: is_active_staff() is missing, as in production" "$(q "select to_regprocedure('public.is_active_staff()') is null")" "t"

# drafts/72 first (it adds the missing helper), then the rest in their install order
ORDER="72 32 34 36 38 40 44 46 48 50 52 54 56 58 60 62 64 66 68 70"
for id in $ORDER; do
  f=$(ls "$DIR"/drafts/${id}_DRAFT_*.sql 2>/dev/null | grep -v rollback | head -1)
  [ -n "$f" ] || { ok "drafts/$id exists" "missing" "present"; continue; }
  r=$(run "$f")
  if [ "$r" != 0 ]; then echo "      $(grep -m1 -i 'error' "$OUTF" | cut -c1-200)"; fi
  ok "drafts/$id installs ($(basename "$f"))" "$r" "0"
done

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
