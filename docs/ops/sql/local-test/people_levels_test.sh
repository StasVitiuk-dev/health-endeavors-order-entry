#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-25). Never point this at Supabase.
# Tests drafts/62 (the Manager role word), drafts/64 (four levels of account: who
# may see and change which account) and their rollbacks drafts/63 and drafts/65 on
# a throwaway copy, as two owners (one the emergency account), two administrators,
# two managers, employees, a switched-off employee, an agent account and a visitor.
# The copy is first made to look like production where the local schema differs:
# the role is a list type (enum), the accounts table has production's row rules
# (your own row; the owner), and a stand-in for the guard that exists today,
# written from its description in plain words (not copied from production).
# All values are made up.
# Usage: people_levels_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_people_levels_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROLE="$DIR/drafts/62_DRAFT_manager_role.sql"; ROLE_BACK="$DIR/drafts/63_DRAFT_rollback_manager_role.sql"
INSTALL="$DIR/drafts/64_DRAFT_people_levels.sql"; ROLLBACK="$DIR/drafts/65_DRAFT_rollback_people_levels.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | tr '\n' ' ' | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-240)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-000000000c01;  G=00000000-0000-4000-8000-000000000c02   # the owner; the emergency owner account
A=00000000-0000-4000-8000-000000000c03;  B=00000000-0000-4000-8000-000000000c04   # two administrators
M=00000000-0000-4000-8000-000000000c05;  N=00000000-0000-4000-8000-000000000c06   # two managers (after drafts/62)
E=00000000-0000-4000-8000-000000000c07;  F=00000000-0000-4000-8000-000000000c08   # two employees
X=00000000-0000-4000-8000-000000000c09                                            # an employee switched off long ago
R=00000000-0000-4000-8000-000000000c0a                                            # an agent account (not a person)
W=00000000-0000-4000-8000-000000000c0b                                            # a brand-new account, just created, still off
state() { q "select role::text || '/' || is_active || '/' || (deleted_at is not null) from profiles where id = '$1'"; }
guard_sum() { q "select md5(pg_get_functiondef('public.guard_profile_privileged_columns()'::regprocedure))"; }

setup() {
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
  psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 >"$OUTF" 2>&1 <<SQL || { echo "set-up failed"; cat "$OUTF"; exit 2; }
-- like production: the role is a list type without "manager"
create type public.app_role as enum ('owner', 'employee', 'ai_agent', 'administrator');
delete from profiles where role not in ('owner', 'employee', 'ai_agent', 'administrator');
alter table profiles alter column role drop default;
alter table profiles alter column role type public.app_role using role::public.app_role;
alter table profiles alter column role set default 'employee';
create or replace function public.is_owner_or_admin() returns boolean language sql stable security definer set search_path = public as
\$\$ select coalesce((select role in ('owner','administrator') from profiles where id = auth.uid() and is_active and deleted_at is null), false) \$\$;
drop function public.current_role();
create function public.current_role() returns public.app_role language sql stable security definer set search_path = public as
\$\$ select role from profiles where id = auth.uid() and is_active and deleted_at is null \$\$;
-- like production: your own row, or the owner
drop policy if exists local_self on profiles;
create policy stand_in_read on profiles for select to authenticated using (id = auth.uid() or coalesce(public.current_role()::text, '') = 'owner');
create policy stand_in_change on profiles for update to authenticated using (id = auth.uid() or coalesce(public.current_role()::text, '') = 'owner') with check (id = auth.uid() or coalesce(public.current_role()::text, '') = 'owner');
create policy stand_in_add on profiles for insert to authenticated with check (coalesce(public.current_role()::text, '') = 'owner');
revoke delete on profiles from authenticated;
-- a stand-in for today's guard, from its description: nobody signed in passes; a level or
-- the emergency mark is the owner's only; switching an account on or off is the owner's, or an
-- administrator's for someone else
create function public.guard_profile_privileged_columns() returns trigger language plpgsql set search_path = public as \$\$
declare v_role text := coalesce(public.current_role()::text, '');
begin
  if auth.uid() is null then return new; end if;
  if (new.role is distinct from old.role or new.is_break_glass is distinct from old.is_break_glass) and v_role <> 'owner' then
    raise exception 'Only the owner can change a person''s role or break-glass access. Nothing was changed.' using errcode = '42501';
  end if;
  if (new.is_active is distinct from old.is_active or new.deleted_at is distinct from old.deleted_at)
     and not (v_role = 'owner' or (v_role = 'administrator' and old.id <> auth.uid())) then
    raise exception 'STAND-IN: only the owner or an administrator can switch an account on or off.' using errcode = '42501';
  end if;
  return new;
end \$\$;
comment on function public.guard_profile_privileged_columns() is 'STAND-IN note that was there before';
create trigger guard_profile_privileged_columns before update on profiles for each row execute function public.guard_profile_privileged_columns();
delete from profiles where id in ('$O','$G','$A','$B','$M','$N','$E','$F','$X','$R','$W');
insert into profiles (id, email, display_name, role, is_active, is_break_glass, account_number, created_at) values
  ('$O','owner@example.test','SYNTHETIC Owner','owner',true,false,'920000001', now() - interval '90 days'),
  ('$G','emergency@example.test','SYNTHETIC Emergency','owner',true,true,'920000002', now() - interval '90 days'),
  ('$A','admin1@example.test','SYNTHETIC Admin One','administrator',true,false,'920000003', now() - interval '60 days'),
  ('$B','admin2@example.test','SYNTHETIC Admin Two','administrator',true,false,'920000004', now() - interval '60 days'),
  ('$M','lead1@example.test','SYNTHETIC Lead One','employee',true,false,'920000005', now() - interval '30 days'),
  ('$N','lead2@example.test','SYNTHETIC Lead Two','employee',true,false,'920000006', now() - interval '30 days'),
  ('$E','staff1@example.test','SYNTHETIC Staff One','employee',true,false,'920000007', now() - interval '20 days'),
  ('$F','staff2@example.test','SYNTHETIC Staff Two','employee',true,false,'920000008', now() - interval '20 days'),
  ('$X','gone@example.test','SYNTHETIC Gone','employee',false,false,'920000009', now() - interval '200 days'),
  ('$R','agent@example.test','SYNTHETIC Agent','ai_agent',true,false,'920000010', now() - interval '90 days'),
  ('$W','new@example.test',null,'employee',false,false,'920000011', now() - interval '1 minute');
SQL
}

setup
echo "Four levels of account (throwaway database $DB)"
BEFORE=$(guard_sum)

echo " 1. the Manager role word (drafts/62), and the order of the two files"
has "drafts/64 refuses to install before drafts/62" "$(run "$INSTALL"; cat "$OUTF")" 'run drafts/62 first'
ok  "  and changed nothing (the guard is as it was, no new table)" "$(guard_sum)/$(q "select to_regclass('public.people_levels_backup') is null")" "$BEFORE/t"
ok  "drafts/62 installs" "$(run "$ROLE")" "0"
ok  "  safe to run twice" "$(run "$ROLE")" "0"
ok  "  the list of roles now holds manager, and nobody has it" "$(q "select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum where enumtypid = 'public.app_role'::regtype")/$(q "select count(*) from profiles where role::text = 'manager'")" "owner,employee,ai_agent,administrator,manager/0"
ok  "  an administrator still cannot change a level (today's guard is untouched)" "$(as $A "update profiles set role = 'manager' where id = '$M' returning 1" | wc -l | tr -d ' ')" "0"
q "update profiles set role = 'manager' where id in ('$M','$N')" >/dev/null     # the owner's own hand, outside the dashboard

echo " 2. install drafts/64"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  the guard's earlier text is saved, word for word, with its note" "$(q "select md5(definition) || '|' || note from people_levels_backup")" "$BEFORE|STAND-IN note that was there before"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"
ok  "  running it again did not replace the saved text with the new guard" "$(q "select md5(definition) || '|' || count(*) over () from people_levels_backup")" "$BEFORE|1"
ok  "  the guard is the new one, on the same trigger" "$(q "select obj_description('public.guard_profile_privileged_columns()'::regprocedure::oid, 'pg_proc')")/$(q "select count(*) from pg_trigger where tgrelid = 'public.profiles'::regclass and tgfoid = 'public.guard_profile_privileged_columns()'::regprocedure::oid and not tgisinternal")" "Health Endeavors drafts/64: the guard knows four levels/1"
has "  no signed-in person can read the saved text" "$(as $O "select count(*) from people_levels_backup")" "permission denied"
ok  "  every function runs with the caller's rights" "$(q "select count(*) from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'people\\_%' or proname = 'guard_profile_privileged_columns') and prosecdef")" "0"

echo " 3. who sees which account"
ok  "the owner sees everyone" "$(as $O "select count(*) from profiles where id in ('$O','$G','$A','$B','$M','$N','$E','$F','$X','$R','$W')")" "11"
ok  "an administrator sees themselves, the managers and the employees: no owner, no other administrator, no agent" "$(as $A "select string_agg(right(id::text, 3), ',' order by id) from profiles where id in ('$O','$G','$A','$B','$M','$N','$E','$F','$X','$R','$W')")" "c03,c05,c06,c07,c08,c09,c0b"
ok  "a manager sees themselves and the employees: no other manager" "$(as $M "select string_agg(right(id::text, 3), ',' order by id) from profiles where id in ('$O','$G','$A','$B','$M','$N','$E','$F','$X','$R','$W')")" "c05,c07,c08,c09,c0b"
ok  "an employee sees only themselves" "$(as $E "select string_agg(right(id::text, 3), ',' order by id) from profiles")" "c07"
ok  "a switched-off account sees only its own row and counts as nobody" "$(as $X "select count(*) || '/' || public.people_actor_role() from profiles")" "1/"
has "a visitor reads nothing" "$(as anon "select count(*) from profiles")" "permission denied"

echo " 4. suspend, remove, bring back"
ok  "an administrator suspends an employee" "$(as $A "select (people_set_status('$E', 'suspended'))->>'status'")|$(state $E)" "suspended|employee/false/false"
ok  "  and brings them back" "$(as $A "select (people_set_status('$E', 'active'))->>'ok'")|$(state $E)" "true|employee/true/false"
ok  "an administrator removes a manager: switched off and marked removed, the row stays" "$(as $A "select (people_set_status('$N', 'removed'))->>'ok'")|$(state $N)|$(q "select count(*) from profiles where id = '$N'")" "true|manager/false/true|1"
ok  "  and brings them back with their level" "$(as $A "select (people_set_status('$N', 'active'))->>'ok'")|$(state $N)" "true|manager/true/false"
ok  "a manager suspends an employee and brings them back" "$(as $M "select (people_set_status('$F', 'suspended'))->>'ok'")$(as $M "select (people_set_status('$F', 'active'))->>'ok'")|$(state $F)" "truetrue|employee/true/false"
ok  "the owner suspends an administrator and brings them back" "$(as $O "select (people_set_status('$B', 'suspended'))->>'ok'")$(as $O "select (people_set_status('$B', 'active'))->>'ok'")|$(state $B)" "truetrue|administrator/true/false"
has "an administrator cannot touch the other administrator" "$(as $A "select people_set_status('$B', 'suspended')")" "not yours to change"
has "an administrator cannot touch the owner" "$(as $A "select people_set_status('$O', 'suspended')")" "not yours to change"
has "a manager cannot touch the other manager" "$(as $M "select people_set_status('$N', 'suspended')")" "not yours to change"
has "a manager cannot touch an administrator" "$(as $M "select people_set_status('$A', 'removed')")" "not yours to change"
has "an employee cannot touch another employee" "$(as $E "select people_set_status('$F', 'suspended')")" "not yours to change"
has "nobody suspends themselves, the owner included" "$(as $A "select people_set_status('$A', 'suspended')")$(as $O "select people_set_status('$O', 'suspended')")" "not yours to change.*not yours to change"
has "the emergency account and the other owner are not changed from here, even by the owner" "$(as $O "select people_set_status('$G', 'suspended')")" "not yours to change"
has "an agent account is not a person's: nobody changes it here" "$(as $O "select people_set_status('$R', 'suspended')")" "not yours to change"
has "an unknown status is refused" "$(as $A "select people_set_status('$E', 'deleted')")" "Choose active, suspended or removed"
has "a switched-off account can do nothing" "$(as $X "select people_set_status('$E', 'suspended')")" "Only a signed-in, active team member"
has "a visitor cannot run it" "$(as anon "select people_set_status('$E', 'suspended')")" "permission denied"
ok  "after all the refusals every account is as it was" "$(state $O)|$(state $G)|$(state $A)|$(state $B)|$(state $N)|$(state $F)|$(state $R)" "owner/true/false|owner/true/false|administrator/true/false|administrator/true/false|manager/true/false|employee/true/false|ai_agent/true/false"

echo " 5. changing a level"
ok  "an administrator makes an employee a manager" "$(as $A "select (people_set_role('$F', 'manager'))->>'ok'")|$(state $F)" "true|manager/true/false"
ok  "  and back to an employee" "$(as $A "select (people_set_role('$F', 'employee'))->>'ok'")|$(state $F)" "true|employee/true/false"
ok  "the same level again changes nothing and says so" "$(as $A "select (people_set_role('$F', 'employee'))->>'unchanged'")" "true"
ok  "the owner makes an employee an administrator, and back" "$(as $O "select (people_set_role('$F', 'administrator'))->>'ok'")$(as $O "select (people_set_role('$F', 'employee'))->>'ok'")|$(state $F)" "truetrue|employee/true/false"
has "an administrator cannot make anyone an administrator" "$(as $A "select people_set_role('$F', 'administrator')")" "a level below your own"
has "a manager cannot make anyone a manager" "$(as $M "select people_set_role('$F', 'manager')")" "a level below your own"
has "nobody is made an owner, the owner included" "$(as $O "select people_set_role('$F', 'owner')")$(as $A "select people_set_role('$F', 'owner')")" "a level below your own.*a level below your own"
has "no person is turned into an agent, and an unknown level is refused" "$(as $O "select people_set_role('$F', 'ai_agent')")$(as $O "select people_set_role('$F', 'boss')")" "a level below your own.*a level below your own"
has "an administrator cannot change their own level" "$(as $A "select people_set_role('$A', 'manager')")" "not yours to change"
has "an administrator cannot lower the other administrator" "$(as $A "select people_set_role('$B', 'employee')")" "not yours to change"
has "an employee cannot change a level" "$(as $E "select people_set_role('$F', 'manager')")" "a level below your own"

echo " 6. going around the functions: the row rules and the guard still decide"
ok  "an administrator's own UPDATE of an owner's row matches nothing" "$(as $A "update profiles set display_name = 'x' where id = '$O' returning 1" | wc -l | tr -d ' ')|$(q "select display_name from profiles where id = '$O'")" "0|SYNTHETIC Owner"
has "an administrator's own UPDATE cannot make an employee an administrator" "$(as $A "update profiles set role = 'administrator' where id = '$F'")" "only to a level below their own\|row-level security"
has "an administrator's own UPDATE cannot make themselves an owner" "$(as $A "update profiles set role = 'owner' where id = '$A'")" "only to a level below their own\|row-level security"
has "an administrator cannot set the emergency mark" "$(as $A "update profiles set is_break_glass = true where id = '$F'")" "Only the owner can change a person's role or break-glass access"
has "an administrator cannot change another person's email or account number" "$(as $A "update profiles set email = 'other@example.test' where id = '$F'")" "Only the name, the department, the level and the status"
ok  "an administrator's own UPDATE of an employee's name works" "$(as $A "update profiles set display_name = 'SYNTHETIC Staff Two b' where id = '$F' returning 1")|$(q "select display_name from profiles where id = '$F'")" "1|SYNTHETIC Staff Two b"
ok  "an employee still changes their own name, as before" "$(as $E "update profiles set display_name = 'SYNTHETIC Staff One b' where id = '$E' returning 1")" "1"
has "an employee cannot raise their own level" "$(as $E "update profiles set role = 'manager' where id = '$E'")" "only to a level below their own"
has "an employee cannot switch themselves off or mark themselves removed" "$(as $E "update profiles set deleted_at = now() where id = '$E'")" "Only someone above that level can suspend"
ok  "an employee's UPDATE of another employee matches nothing" "$(as $E "update profiles set display_name = 'x' where id = '$F' returning 1" | wc -l | tr -d ' ')" "0"
ok  "the database's own work, with nobody signed in, passes as before" "$(q "update profiles set department = 'SYNTHETIC desk' where id = '$O' returning 1")" "1"
ok  "  the owner changes any row directly, as before" "$(as $O "update profiles set department = 'SYNTHETIC desk 2' where id = '$B' returning 1")" "1"
has "nobody deletes an account" "$(as $O "delete from profiles where id = '$X'")" "permission denied"

echo " 7. name and department"
ok  "a manager sets an employee's name and department (spaces tidied)" "$(as $M "select (people_set_details('$E', '  SYNTHETIC   Staff One c ', ' Packing '))->>'ok'")|$(q "select display_name || '|' || department from profiles where id = '$E'")" "true|SYNTHETIC Staff One c|Packing"
has "a name of one letter is refused" "$(as $M "select people_set_details('$E', 'x', null)")" "2 to 80 characters"
has "an administrator cannot rename the owner" "$(as $A "select people_set_details('$O', 'SYNTHETIC other', null)")" "not yours to change"

echo " 8. switching on a brand-new account"
ok  "an administrator switches on the new account as a manager, with its name" "$(as $A "select (people_register('$W', 'manager', 'SYNTHETIC New Person', 'Shipping'))->>'ok'")|$(state $W)|$(q "select display_name || '|' || department from profiles where id = '$W'")" "true|manager/true/false|SYNTHETIC New Person|Shipping"
has "  a second time it is no longer brand-new" "$(as $A "select people_register('$W', 'employee', 'SYNTHETIC New Person', null)")" "not yours to change\|not a brand-new account"
has "an account switched off long ago cannot be switched on this way (its level could be raised)" "$(as $A "select people_register('$X', 'manager', 'SYNTHETIC Gone', null)")" "not a brand-new account"
ok  "  it is brought back with its own level instead" "$(as $A "select (people_set_status('$X', 'active'))->>'ok'")|$(state $X)" "true|employee/true/false"
q "update profiles set is_active = false, role = 'employee', created_at = now() - interval '1 minute' where id = '$W'" >/dev/null
has "a manager cannot create a manager" "$(as $M "select people_register('$W', 'manager', 'SYNTHETIC New Person', null)")" "a level below your own"
ok  "a manager switches the new account on as an employee" "$(as $M "select (people_register('$W', 'employee', 'SYNTHETIC New Person', null))->>'ok'")|$(state $W)" "true|employee/true/false"
has "an employee cannot switch on anyone" "$(as $E "select people_register('$W', 'employee', 'SYNTHETIC New Person', null)")" "a level below your own"

echo " 9. the yes/no question for the helper program (it changes nothing)"
ok  "an administrator may create a manager or an employee" "$(as $A "select (people_allow('create', null, 'manager'))->>'ok'")$(as $A "select (people_allow('create', null, 'employee'))->>'ok'")" "truetrue"
has "  not an administrator, not an owner" "$(as $A "select people_allow('create', null, 'administrator')")$(as $A "select people_allow('create', null, 'owner')")" "a level below your own.*a level below your own"
ok  "a manager may create an employee; the owner an administrator" "$(as $M "select (people_allow('create', null, 'employee'))->>'ok'")$(as $O "select (people_allow('create', null, 'administrator'))->>'ok'")" "truetrue"
has "an employee may create nobody" "$(as $E "select people_allow('create', null, 'employee')")" "a level below your own"
ok  "a password or sign-out for an account below your level: yes" "$(as $A "select (people_allow('password', '$E', null))->>'ok'")$(as $M "select (people_allow('sign_out', '$F', null))->>'ok'")" "truetrue"
has "  for the owner, the other administrator or yourself: no" "$(as $A "select people_allow('password', '$O', null)")$(as $A "select people_allow('password', '$B', null)")$(as $A "select people_allow('sign_out', '$A', null)")" "not yours to change.*not yours to change.*not yours to change"
has "  the emergency account: no, even for the owner" "$(as $O "select people_allow('password', '$G', null)")" "not yours to change"
has "an unknown request is refused" "$(as $A "select people_allow('delete', '$E', null)")" "Unknown request"
has "a visitor cannot ask" "$(as anon "select people_allow('create', null, 'employee')")" "permission denied"

echo " 10. the record of who changed which account is the audit log that already exists"
ok  "the suspension by the administrator is in it, under the administrator" "$(q "select count(*) > 0 from audit_log where table_name = 'profiles' and record_id = '$E' and changed_by = '$A' and (new_data->>'is_active') = 'false'")" "t"

echo " 11. rollback (drafts/65), then the role word (drafts/63)"
ok  "rollback" "$(run "$ROLLBACK")" "0"
ok  "  the guard is word for word the one that was there, with its note" "$(guard_sum)|$(q "select obj_description('public.guard_profile_privileged_columns()'::regprocedure::oid, 'pg_proc')")" "$BEFORE|STAND-IN note that was there before"
ok  "  the functions, the two row rules and the saved text are gone" "$(q "select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'people\\_%'")/$(q "select count(*) from pg_policy where polrelid = 'public.profiles'::regclass and polname like 'profiles_levels%'")/$(q "select to_regclass('public.people_levels_backup') is null")" "0/0/t"
ok  "  an administrator sees only themselves again, and cannot switch anyone's level" "$(as $A "select count(*) from profiles")|$(as $A "update profiles set role = 'employee' where id = '$M' returning 1" | wc -l | tr -d ' ')" "1|0"
ok  "  no account was changed by the rollback" "$(state $M)|$(state $E)|$(state $W)" "manager/true/false|employee/true/false|employee/true/false"
ok  "  safe to run twice" "$(run "$ROLLBACK")" "0"
has "drafts/63 stops while an account is still a manager" "$(run "$ROLE_BACK"; cat "$OUTF")" "still have the role manager"
q "update profiles set role = 'employee' where role::text = 'manager'" >/dev/null
ok  "  and passes once nobody is" "$(run "$ROLE_BACK")" "0"
ok  "installing again after a rollback works, and saves the earlier text again" "$(run "$INSTALL")|$(q "select md5(definition) from people_levels_backup")" "0|$BEFORE"

echo " 12. it refuses a database that is not what it expects"
q "drop table people_levels_backup" >/dev/null
has "the new guard in place but its earlier text gone: it stops instead of saving its own guard as 'the earlier one'" "$(run "$INSTALL"; cat "$OUTF")" "the table that keeps its earlier text is missing"
has "  and the rollback stops too, instead of leaving the accounts table without a guard" "$(run "$ROLLBACK"; cat "$OUTF")" "its earlier text is not saved"
ok  "  the new guard is still in place" "$(q "select obj_description('public.guard_profile_privileged_columns()'::regprocedure::oid, 'pg_proc')")" "Health Endeavors drafts/64: the guard knows four levels"

rm -f "$OUTF"
echo
echo "passed: $pass   failed: $fail"
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
[ "$fail" = 0 ]
