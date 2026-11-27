#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-27). Never point this at Supabase.
# Tests drafts/72 (adds is_active_staff(), missing in production) and drafts/73 (its rollback)
# on a throwaway copy shaped like production as the owner's read-only look of Nov 27 showed it:
# current_role() and is_owner_or_admin() exist, is_active_staff() does not; profiles.role is an
# enum (owner, employee, ai_agent, administrator); a signed-in person reads their own account
# row. Then drafts/50 (step A) is installed on top to show it no longer stops. All rows synthetic.
# Usage: active_staff_helper_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_active_staff_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/72_DRAFT_active_staff_helper.sql"; ROLLBACK="$DIR/drafts/73_DRAFT_rollback_active_staff_helper.sql"
STEP_A="$DIR/drafts/50_DRAFT_shared_settings.sql"; STEP_A_UNDO="$DIR/drafts/51_DRAFT_rollback_shared_settings.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000072a1   # owner, active
A=00000000-0000-4000-8000-0000000072a2   # administrator, active
E=00000000-0000-4000-8000-0000000072a3   # employee, active
I=00000000-0000-4000-8000-0000000072a4   # employee, switched off
R=00000000-0000-4000-8000-0000000072a5   # employee, removed (deleted_at set)
G=00000000-0000-4000-8000-0000000072a6   # AI agent account, active
N=00000000-0000-4000-8000-0000000072a7   # signed in, but no account row

fresh() {
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
  # production's shape: no is_active_staff(), role is an enum, the two helpers as production has them
  q "drop function if exists public.is_active_staff() cascade;
     drop policy if exists local_self on profiles;
     do \$\$ begin create type app_role as enum ('owner', 'employee', 'ai_agent', 'administrator'); exception when duplicate_object then null; end \$\$;
     delete from profiles where id in ('$O','$A','$E','$I','$R','$G');
     alter table profiles alter column role drop default;
     alter table profiles alter column role type app_role using role::app_role;
     create or replace function public.current_role() returns app_role language sql stable security definer set search_path = public as
       \$f\$ select role from public.profiles where id = auth.uid() and deleted_at is null; \$f\$;
     create or replace function public.is_owner_or_admin() returns boolean language sql stable security definer set search_path = public as
       \$f\$ select exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('owner'::app_role, 'administrator'::app_role) and profiles.is_active = true); \$f\$;
     create policy profiles_read_own on profiles for select to authenticated using (id = auth.uid() or public.is_owner_or_admin());
     insert into profiles (id, email, role, is_active, deleted_at, account_number) values
       ('$O','o@example.test','owner',true,null,'720000001'), ('$A','a@example.test','administrator',true,null,'720000002'),
       ('$E','e@example.test','employee',true,null,'720000003'), ('$I','i@example.test','employee',false,null,'720000004'),
       ('$R','r@example.test','employee',true,now(),'720000005'), ('$G','g@example.test','ai_agent',true,null,'720000006');" >"$OUTF" 2>&1
}
answers() { local out=""; for who in "$O" "$A" "$E" "$I" "$R" "$G" "$N"; do out="$out$(as "$who" "select public.is_active_staff()")"; done; echo "$out"; }

fresh
echo "is_active_staff() (drafts/72, drafts/73; throwaway database $DB shaped like production)"
has "set-up: production's shape is in place" "$(q "select format_type(atttypid, null) from pg_attribute where attrelid = 'profiles'::regclass and attname = 'role'")" "app_role"
ok  "today: the function is missing, as in production" "$(q "select to_regprocedure('public.is_active_staff()') is null")" "t"
ok  "today: step A stops on it and changes nothing (as on Nov 27)" "$(run "$STEP_A")" "3"
has "  with the same message" "$(cat "$OUTF")" "missing function public.is_active_staff()"
ok  "  no shared settings table was left behind" "$(q "select to_regclass('public.shared_settings') is null")" "t"

ok  "drafts/72 installs" "$(run "$INSTALL")" "0"
ok  "  answers: owner, administrator, employee yes; switched off, removed, AI agent, no account row no" "$(answers)" "tttffff"
ok  "  a visitor cannot run it" "$(as anon "select public.is_active_staff()" | grep -c 'permission denied')" "1"
ok  "  it runs with the caller's rights and names pg_temp last" "$(q "select prosecdef::text || '|' || array_to_string(proconfig, ';') from pg_proc where oid = to_regprocedure('public.is_active_staff()')")" "false|search_path=public, pg_temp"
ok  "  a second install changes nothing" "$(run "$INSTALL")" "0"
ok  "  same answers" "$(answers)" "tttffff"
q "insert into profiles (id, email, role, is_active, account_number) values ('$N','n@example.test','employee',true,'720000007')" >/dev/null
ok  "  an account switched on later counts at once" "$(as "$N" "select public.is_active_staff()")" "t"
q "update profiles set is_active = false where id = '$E'" >/dev/null
ok  "  an account switched off counts no more" "$(as "$E" "select public.is_active_staff()")" "f"
q "update profiles set is_active = true where id = '$E'" >/dev/null

echo " step A on top"
ok  "step A (drafts/50) now installs" "$(run "$STEP_A")" "0"
ok  "  an employee reads a setting marked for staff, not one for the owner" "$(q "insert into shared_settings (key, value, audience, updated_by) values ('staff_note', '{\"a\":1}', 'staff', '$O'), ('owner_note', '{\"b\":2}', 'owner_admin', '$O')" >/dev/null; as "$E" "select string_agg(key, ',' order by key) from shared_settings")" "staff_note"
ok  "  a switched-off employee reads nothing" "$(as "$I" "select count(*) from shared_settings")" "0"
ok  "  the owner reads both" "$(as "$O" "select count(*) from shared_settings")" "2"

echo " rollback (drafts/73)"
ok  "while step A's rule uses it, the rollback stops and changes nothing" "$(run "$ROLLBACK")" "3"
has "  and names the rule" "$(cat "$OUTF")" "shared_settings"
ok  "  the function is still there" "$(q "select to_regprocedure('public.is_active_staff()') is not null")" "t"
q "delete from shared_settings" >/dev/null 2>&1; q "alter table shared_settings disable trigger shared_settings_guard; delete from shared_settings; alter table shared_settings enable trigger shared_settings_guard;" >/dev/null 2>&1
ok  "step A's own undo runs" "$(run "$STEP_A_UNDO")" "0"
ok  "then the rollback succeeds" "$(run "$ROLLBACK")" "0"
ok  "  the function is gone" "$(q "select to_regprocedure('public.is_active_staff()') is null")" "t"
ok  "  a second rollback is harmless" "$(run "$ROLLBACK")" "0"
ok  "  install works again afterwards" "$(run "$INSTALL")" "0"

echo " refusals"
fresh
q "create function public.is_active_staff() returns boolean language sql as 'select true'" >/dev/null
ok  "an is_active_staff() it did not create: drafts/72 stops" "$(run "$INSTALL")" "3"
has "  and says so" "$(cat "$OUTF")" "was not created by this file"
ok  "  the other function is untouched" "$(q "select prosrc from pg_proc where oid = to_regprocedure('public.is_active_staff()')")" "select true"
ok  "  the rollback also leaves it alone" "$(run "$ROLLBACK")" "3"
ok  "  still untouched" "$(q "select prosrc from pg_proc where oid = to_regprocedure('public.is_active_staff()')")" "select true"
fresh
q "drop policy profiles_read_own on profiles; create policy profiles_owner_only on profiles for select to authenticated using (public.is_owner_or_admin())" >/dev/null
ok  "no rule lets a person read their own account row: drafts/72 stops" "$(run "$INSTALL")" "3"
has "  and says so" "$(cat "$OUTF")" "read their own account row"
ok  "  nothing was added" "$(q "select to_regprocedure('public.is_active_staff()') is null")" "t"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
