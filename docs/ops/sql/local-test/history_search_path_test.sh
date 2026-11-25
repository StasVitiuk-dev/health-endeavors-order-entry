#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-26). Never point this at Supabase.
# Tests drafts/68 (pg_temp named last in the search path of three existing functions that
# run with raised rights) and drafts/69 (its rollback) on a throwaway copy. The three
# production functions are not in this repository; stand-ins with the SAME names,
# inputs, raised rights and search paths are created here (synthetic bodies). All rows
# are synthetic.
# Usage: history_search_path_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_history_search_path_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/68_DRAFT_history_functions_search_path.sql"; ROLLBACK="$DIR/drafts/69_DRAFT_rollback_history_functions_search_path.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
OUTF=$(mktemp)
E=00000000-0000-4000-8000-000000000ba1
FN="'employee_activity','employee_activity_people','list_my_sessions'"
paths() { q "select string_agg(proname || '=' || array_to_string(proconfig, ';'), ' ' order by proname) from pg_proc where pronamespace = 'public'::regnamespace and proname in ($FN)"; }
bodies() { q "select md5(string_agg(proname || prosrc || prosecdef::text || provolatile, '|' order by proname)) from pg_proc where pronamespace = 'public'::regnamespace and proname in ($FN)"; }
# The shadow check: in ONE session, a temporary table called "profiles" says the asker is an
# owner; the real accounts table says employee. Which one does the function read?
shadow() { q "set request.jwt.claim.sub = '$E';
              create temp table profiles (id uuid, role text, is_active boolean);
              insert into profiles values ('$E', 'owner', true);
              select string_agg(r, ',') from (select role as r from public.employee_activity_people()
                union all select person_role from public.employee_activity(null, null, null, null, null, 10, 0)) x;"; }
fresh() {
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
  q "delete from profiles where id = '$E';
     insert into profiles (id, email, role, is_active, account_number) values ('$E','staff@example.test','employee',true,'920000001');" >/dev/null
}
standins() {
  q "create or replace function public.employee_activity_people() returns table(role text)
       language plpgsql stable security definer set search_path to 'public' as \$f\$
     begin return query select p.role::text from profiles p where p.id = auth.uid(); end \$f\$;
     create or replace function public.employee_activity(p_search text default null, p_person uuid default null, p_area text default null,
       p_from timestamptz default null, p_to timestamptz default null, p_limit integer default 100, p_offset integer default 0)
       returns table(id bigint, person_role text)
       language plpgsql stable security definer set search_path to 'public' as \$f\$
     begin return query select 1::bigint, p.role::text from profiles p where p.id = auth.uid(); end \$f\$;
     create or replace function public.list_my_sessions() returns table(n integer)
       language sql security definer set search_path to 'auth', 'public' as \$f\$ select 1 \$f\$;" >/dev/null
}

fresh; standins
echo "Search path of three existing raised-rights functions (drafts/68, drafts/69; throwaway database $DB)"
ok  "today's settings, as the owner's read-only look showed them" "$(paths)" "employee_activity=search_path=public employee_activity_people=search_path=public list_my_sessions=search_path=auth, public"
ok  "today: a temporary table called profiles stands in for the real one (the gap)" "$(shadow)" "owner,owner"
B0=$(bodies)
grants() { q "select string_agg(p.proname || '=' || has_function_privilege('anon', p.oid, 'execute')::text || '/' || has_function_privilege('authenticated', p.oid, 'execute')::text, ' ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('employee_activity', 'employee_activity_people', 'list_my_sessions')"; }
G0="$(grants)"
ok  "drafts/68 installs" "$(run "$INSTALL")" "0"
ok  "  pg_temp is named last in all three" "$(paths)" "employee_activity=search_path=public, pg_temp employee_activity_people=search_path=public, pg_temp list_my_sessions=search_path=auth, public, pg_temp"
ok  "  their text, raised rights and kind are unchanged" "$(bodies)" "$B0"
ok  "  the temporary table no longer stands in: the real accounts table answers" "$(shadow)" "employee,employee"
ok  "  a second install changes nothing" "$(run "$INSTALL")" "0"
ok  "  still the same" "$(paths)|$(bodies)" "employee_activity=search_path=public, pg_temp employee_activity_people=search_path=public, pg_temp list_my_sessions=search_path=auth, public, pg_temp|$B0"
ok  "  a visitor's rights to all three are unchanged" "$(grants)" "$G0"

echo " rollback (drafts/69)"
ok  "rollback succeeds" "$(run "$ROLLBACK")" "0"
ok  "  the settings are exactly as before" "$(paths)" "employee_activity=search_path=public employee_activity_people=search_path=public list_my_sessions=search_path=auth, public"
ok  "  the text is still unchanged" "$(bodies)" "$B0"
ok  "  a second rollback is harmless" "$(run "$ROLLBACK")" "0"
ok  "  install works again afterwards" "$(run "$INSTALL")" "0"

fresh
ok  "on a database without the three functions, drafts/68 stops and changes nothing" "$(run "$INSTALL")" "3"
has "  and says what is missing" "$(cat "$OUTF")" "employee_activity"
ok  "  the rollback also stops there" "$(run "$ROLLBACK")" "3"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
