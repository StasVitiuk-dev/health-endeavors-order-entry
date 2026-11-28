#!/usr/bin/env bash
# LOCAL TEST ONLY (Nov 27, 2026). Never point this at Supabase.
# The three triggers on the accounts table (profiles) work together: a refused change leaves
# the row as it was AND writes no audit row; a normal change writes exactly one; a change that
# mixes a normal field with a protected one is refused as a whole; the owner's role change is
# audited; the account-number lock refuses on its own, even with the guard switched off.
#
# Why this file exists: EXT20B_AUTHORIZATION_MODEL.md section 4 and EXT20D_REVALIDATION_REPORT.md
# cite "trigger_order_test.sh, 10/10", but that file was never saved in the repository. This is
# a rebuild, not the original, and it says exactly what each trigger here is:
#   * the guard (profiles_guard_privileged_columns): the EXACT SQL the owner ran on Oct 18, read
#     at run time from docs/ops/PRODUCTION_CHANGE_LOG.md (section "FIX 2"), not a copy;
#   * the audit (profiles_audit): the local history recorder, whose body is production's
#     audit_trigger_function() word for word since Nov 27 (01_REAL_SHAPE_schema_for_local_tests.sql);
#   * the account-number lock (profiles_lock_account_number): a STAND-IN written from its
#     description ("refuses any change to an assigned account number"); production's text is not
#     in this repository, so this proves how the triggers combine, not that production's lock is
#     word for word this one. Its text is in the owner's Query G3 answer (read-only, trigger
#     sources); with that, the stand-in can be replaced by the exact text.
# The accounts, row rules and role list come from people_levels_stand_in.sql (made-up values).
# Usage: profiles_trigger_order_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_trigger_order_test
LT="$(cd "$(dirname "$0")" && pwd)"; OPS="$(cd "$LT/../.." && pwd)"
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has() { if echo "$2" | tr '\n' ' ' | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-240)]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
as()  { psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$1'; $2; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
O=00000000-0000-4000-8000-000000000c01   # the owner
E=00000000-0000-4000-8000-000000000c07   # an employee
row()    { q "select role::text || '/' || coalesce(display_name, '') || '/' || account_number from profiles where id = '$1'"; }
audits() { q "select count(*) from audit_log where table_name = 'profiles' and record_id = '$1'"; }
OUTF=$(mktemp); FIX2=$(mktemp); trap 'rm -f "$OUTF" "$FIX2"; psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1' EXIT

# the exact FIX 2 SQL from the change log: the first sql block after the FIX 2 heading
awk '/^## 2026-10-18 · FIX 2/{s=1} s&&/^```sql$/{g=1;next} g&&/^```$/{exit} g' "$OPS/PRODUCTION_CHANGE_LOG.md" > "$FIX2"
grep -q 'create trigger profiles_guard_privileged_columns' "$FIX2" || { echo "could not find the FIX 2 SQL in PRODUCTION_CHANGE_LOG.md"; exit 2; }

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$LT/people_levels_stand_in.sql" >"$OUTF" 2>&1 || { echo "set-up failed"; cat "$OUTF"; exit 2; }
# the stand-in guard from that file is replaced by production's own (FIX 2), under production's trigger name
q "drop trigger guard_profile_privileged_columns on profiles" >/dev/null
psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$FIX2" >"$OUTF" 2>&1 || { echo "FIX 2 did not install"; cat "$OUTF"; exit 2; }
psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 >"$OUTF" 2>&1 <<'SQL' || { echo "lock stand-in did not install"; cat "$OUTF"; exit 2; }
-- STAND-IN for production's account-number lock, from its description (not copied)
create function public.lock_account_number() returns trigger language plpgsql set search_path = public as $$
begin
  if old.account_number is not null and new.account_number is distinct from old.account_number then
    raise exception 'STAND-IN: an assigned account number cannot be changed.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_lock_account_number before update on public.profiles for each row execute function public.lock_account_number();
SQL

echo "The three triggers on the accounts table (throwaway database $DB)"
echo " 1. what is installed"
ok  "three triggers, as Query G3 lists them in production" "$(q "select string_agg(tgname || ':' || case when tgtype & 2 = 2 then 'before' else 'after' end, ' ' order by tgname) from pg_trigger where tgrelid = 'public.profiles'::regclass and not tgisinternal")" "profiles_audit:after profiles_guard_privileged_columns:before profiles_lock_account_number:before"
has "the guard is the change log's text (owner-only message)" "$(q "select pg_get_functiondef('public.guard_profile_privileged_columns()'::regprocedure)")" "Only the owner (or an administrator, for someone else)"

echo " 2. a refused change: the row stays, and no audit row"
BEFORE_ROW=$(row $E); BEFORE_AUD=$(audits $E)
has "an employee cannot make themselves the owner" "$(as $E "update profiles set role = 'owner' where id = '$E'")" "Only the owner can change a person's role"
ok  "  the row is as it was" "$(row $E)" "$BEFORE_ROW"
ok  "  and no audit row says the role changed" "$(audits $E)" "$BEFORE_AUD"

echo " 3. a normal change: one audit row"
ok  "the employee changes their own name" "$(as $E "update profiles set display_name = 'SYNTHETIC Renamed' where id = '$E' returning 1")" "1"
ok  "  exactly one new audit row, with the new name" "$(audits $E)/$(q "select new_data->>'display_name' from audit_log where record_id = '$E' order by id desc limit 1")" "$((BEFORE_AUD+1))/SYNTHETIC Renamed"

echo " 4. a normal field and a protected one together: refused as a whole"
BEFORE_ROW=$(row $E); BEFORE_AUD=$(audits $E)
has "name and role in one change is refused" "$(as $E "update profiles set display_name = 'SYNTHETIC Sneaky', role = 'administrator' where id = '$E'")" "Only the owner can change"
ok  "  the name was not kept either, and no audit row" "$(row $E)/$(audits $E)" "$BEFORE_ROW/$BEFORE_AUD"

echo " 5. the owner's role change goes through and is audited"
ok  "the owner makes the employee an administrator" "$(as $O "update profiles set role = 'administrator' where id = '$E' returning 1")" "1"
ok  "  one audit row: employee -> administrator, by the owner" "$(audits $E)/$(q "select (old_data->>'role') || '>' || (new_data->>'role') || '/' || changed_by from audit_log where record_id = '$E' order by id desc limit 1")" "$((BEFORE_AUD+1))/employee>administrator/$O"

echo " 6. the account-number lock, on its own"
BEFORE_ROW=$(row $E); BEFORE_AUD=$(audits $E)
has "not even the owner can change an assigned number" "$(as $O "update profiles set account_number = '999999999' where id = '$E'")" "cannot be changed"
has "nor the person themselves" "$(as $E "update profiles set account_number = '999999998' where id = '$E'")" "cannot be changed"
has "the owner's name change plus a number change is refused as a whole" "$(as $O "update profiles set display_name = 'SYNTHETIC Other', account_number = '999999997' where id = '$E'")" "cannot be changed"
has "with no one signed in (server-side work the guard lets through) the lock still refuses" "$(q "update profiles set account_number = '999999996' where id = '$E'")" "cannot be changed"
q "alter table profiles disable trigger profiles_guard_privileged_columns" >/dev/null
has "with the guard switched off, the lock still refuses" "$(as $O "update profiles set account_number = '999999995' where id = '$E'")" "cannot be changed"
q "alter table profiles enable trigger profiles_guard_privileged_columns" >/dev/null
ok  "  none of these changed the row or wrote an audit row" "$(row $E)/$(audits $E)" "$BEFORE_ROW/$BEFORE_AUD"

echo " 7. the test can fail: without the guard the hole is open again"
q "alter table profiles disable trigger profiles_guard_privileged_columns" >/dev/null
ok  "with the guard off, an employee can promote themselves (the Oct 18 hole)" "$(as $E "update profiles set role = 'owner' where id = '$E' returning 1")" "1"
ok  "  and it is audited like any change" "$(audits $E)" "$((BEFORE_AUD+1))"

echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
