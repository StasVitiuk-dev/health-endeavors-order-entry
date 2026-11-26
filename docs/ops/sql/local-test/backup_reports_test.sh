#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-26). Never point this at Supabase.
# Tests drafts/70 (backup reports for Home) and drafts/71 (its rollback) on a throwaway
# copy. Acting as the owner, an administrator, an employee, a manager, a switched-off
# administrator, a visitor, and the backup job (a stand-in for the database's own
# service key, service_role). All rows are synthetic.
# Usage: backup_reports_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_backup_reports_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/70_DRAFT_backup_reports.sql"; ROLLBACK="$DIR/drafts/71_DRAFT_rollback_backup_reports.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"
         elif [ "$who" = job ]; then pre="set local role service_role;"
         else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-000000000ba1; A=00000000-0000-4000-8000-000000000ba2; E=00000000-0000-4000-8000-000000000ba3
M=00000000-0000-4000-8000-000000000ba4; AX=00000000-0000-4000-8000-000000000ba5
seed() {
  # the database's own service key: in Supabase it exists and skips the reading rules; here a stand-in
  q "do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if; end \$\$;
     grant usage on schema public to service_role;
     delete from profiles where id in ('$O','$A','$E','$M','$AX');
     insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'920000001'),
       ('$A','admin@example.test','administrator',true,'920000002'), ('$E','staff@example.test','employee',true,'920000003'),
       ('$M','manager@example.test','manager',true,'920000004'), ('$AX','gone-admin@example.test','administrator',false,'920000005');" >/dev/null; }
fresh() { psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
          psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
          seed; }
count() { as "$1" "select count(*) from public.backup_reports"; }
ADD="insert into public.backup_reports (kind, finished_at, ok, size_bytes) values"

fresh
echo "Backup reports for Home (drafts/70) and its rollback (drafts/71) (throwaway database $DB)"
ok  "before drafts/70 there is no table" "$(q "select to_regclass('public.backup_reports') is null")" "t"
has "  the rollback stops when there is nothing to undo" "$(run "$ROLLBACK"; cat "$OUTF")" "Nothing to undo"
ok  "drafts/70 installs" "$(run "$INSTALL")" "0"
ok  "  a second install changes nothing" "$(run "$INSTALL")" "0"
ok  "  one reading rule, no writing rule" "$(q "select string_agg(policyname || ':' || cmd, ',' order by policyname) from pg_policies where tablename = 'backup_reports'")" "backup_reports_owner_admin_read:SELECT"
ok  "  reading rules are on" "$(q "select relrowsecurity from pg_class where oid = 'public.backup_reports'::regclass")" "t"
ok  "  signed-in people may only read" "$(q "select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_name = 'backup_reports' and grantee = 'authenticated'")" "SELECT"
ok  "  a visitor has no right at all" "$(q "select count(*) from information_schema.role_table_grants where table_name = 'backup_reports' and grantee in ('anon', 'PUBLIC')")" "0"
ok  "  the backup job may add and read, nothing more" "$(q "select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_name = 'backup_reports' and grantee = 'service_role'")" "INSERT,SELECT"

echo "The backup job writes; people read"
ok  "the job adds a nightly line" "$(as job "$ADD ('nightly_backup', now() - interval '3 hours', true, 123456789) returning kind")" "nightly_backup"
ok  "  and a restore-test line" "$(as job "$ADD ('restore_test', now() - interval '10 days', true, null) returning kind")" "restore_test"
ok  "the owner reads both" "$(count $O)" "2"
ok  "an administrator reads both" "$(count $A)" "2"
ok  "an employee reads nothing" "$(count $E)" "0"
ok  "a manager reads nothing" "$(count $M)" "0"
ok  "a switched-off administrator reads nothing" "$(count $AX)" "0"
has "a visitor is refused" "$(as anon "select count(*) from public.backup_reports")" "permission denied"

echo "Nobody signed in can add, change or delete a line"
for who in "$O" "$A" "$E"; do
  has "  $who cannot add" "$(as $who "$ADD ('nightly_backup', now(), true, 1)")" "permission denied"
  has "  $who cannot change" "$(as $who "update public.backup_reports set ok = false")" "permission denied"
  has "  $who cannot delete" "$(as $who "delete from public.backup_reports")" "permission denied"
done
has "  the job cannot change a line" "$(as job "update public.backup_reports set ok = false")" "permission denied"
has "  the job cannot delete a line" "$(as job "delete from public.backup_reports")" "permission denied"
ok  "  both lines are still there, unchanged" "$(q "select count(*) || '/' || bool_and(ok) from public.backup_reports")" "2/true"

echo "Only sensible lines are accepted"
has "  an unknown kind is refused" "$(as job "$ADD ('weekly_magic', now(), true, 1)")" "violates check constraint"
has "  a negative size is refused" "$(as job "$ADD ('nightly_backup', now(), true, -5)")" "violates check constraint"
has "  a line without a time is refused" "$(as job "$ADD ('nightly_backup', null, true, 1)")" "null value"
has "  a line without ok/failed is refused" "$(as job "$ADD ('nightly_backup', now(), null, 1)")" "null value"
ok  "  the table has no other columns (nothing else can be stored)" "$(q "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_name = 'backup_reports'")" "id,kind,finished_at,ok,size_bytes,reported_at"

echo "Rollback (drafts/71)"
ok  "drafts/71 runs" "$(run "$ROLLBACK")" "0"
ok  "  the table is gone" "$(q "select to_regclass('public.backup_reports') is null")" "t"
has "  a second rollback stops and changes nothing" "$(run "$ROLLBACK"; cat "$OUTF")" "Nothing to undo"
ok  "  install works again afterwards" "$(run "$INSTALL")" "0"

echo "Install stops when its precondition is missing"
q "drop table public.backup_reports" >/dev/null
q "alter function public.is_owner_or_admin() rename to is_owner_or_admin_hidden" >/dev/null
has "  without is_owner_or_admin() it stops" "$(run "$INSTALL"; cat "$OUTF")" "is_owner_or_admin() is missing"
ok  "  and nothing was created" "$(q "select to_regclass('public.backup_reports') is null")" "t"
q "alter function public.is_owner_or_admin_hidden() rename to is_owner_or_admin" >/dev/null

rm -f "$OUTF"
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
