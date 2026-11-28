#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-24). Never point this at Supabase.
# Tests drafts/50 (settings shared by every device: owner-only writes, replaced
# never deleted, who reads what, audit, refuses a foreign table) and drafts/51
# (rollback) on a throwaway copy, as the owner, an administrator, active staff,
# a deactivated account and a visitor. All values are made up.
# Usage: shared_settings_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_shared_settings_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/50_DRAFT_shared_settings.sql"; A2="$DIR/drafts/74_DRAFT_shared_settings_audit_id.sql"; ROLLBACK="$DIR/drafts/51_DRAFT_rollback_shared_settings.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-240)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000008a1; A=00000000-0000-4000-8000-0000000008a2; E=00000000-0000-4000-8000-0000000008a3; X=00000000-0000-4000-8000-0000000008a4
M=00000000-0000-4000-8000-0000000008a5; G=00000000-0000-4000-8000-0000000008a6   # Nov 27: a manager (drafts/62) and an AI agent account
V1='{"postage": 4, "packaging": 1, "fees": {"etsy": {"percent": 9.5, "perOrder": 0.45}}}'
V2='{"postage": 5, "packaging": 1}'
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "delete from profiles where id in ('$O','$A','$E','$X','$M','$G');
   insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'800000001'),
     ('$A','admin@example.test','administrator',true,'800000002'), ('$E','staff@example.test','employee',true,'800000003'), ('$X','gone@example.test','employee',false,'800000004'),
     ('$M','manager@example.test','manager',true,'800000005'), ('$G','agent@example.test','ai_agent',true,'800000006');" >/dev/null
echo "Shared settings (throwaway database $DB)"

echo " 1. install"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"
# production's audit trigger records new.id: step A2 (drafts/74) gives the table one, right after step A
ok  "step A2 (drafts/74) on top" "$(run "$A2")" "0"
ok  "  the table is empty, marked and audited (with the id the audit records)" "$(q "select count(*) from shared_settings")/$(q "select obj_description('public.shared_settings'::regclass, 'pg_class') like 'Health Endeavors drafts/50%'")/$(q "select count(*) from pg_trigger where tgname = 'shared_settings_audit'")/$(q "select count(*) from pg_attribute where attrelid = 'public.shared_settings'::regclass and attname = 'id'")" "0/t/1/1"

echo " 2. the owner and administrators save (owner decision of Nov 24); nobody else"
ok  "the owner saves the estimates" "$(as $O "select (set_shared_setting('profit_estimates', '$V1'))->>'ok'")" "true"
ok  "  stored with who and when" "$(q "select (value->>'postage')||'|'||audience||'|'||(updated_by = '$O')||'|'||(updated_at > now() - interval '1 minute') from shared_settings where key = 'profit_estimates'")" "4|owner_admin|true|true"
ok  "saving again replaces the value (one row)" "$(as $O "select (set_shared_setting('profit_estimates', '$V2'))->>'ok'")|$(q "select count(*)||'|'||(value->>'postage') from shared_settings group by value")" "true|1|5"
ok  "an administrator saves too (the same value)" "$(as $A "select (set_shared_setting('profit_estimates', '$V2'))->>'ok'")" "true"
ok  "  recorded under the administrator, still one row" "$(q "select count(*)||'|'||bool_and(updated_by = '$A') from shared_settings")" "1|true"
has "staff cannot" "$(as $E "select set_shared_setting('profit_estimates', '$V1')")" "Only the owner or an administrator"
has "a switched-off account cannot" "$(as $X "select set_shared_setting('profit_estimates', '$V1')")" "Only the owner or an administrator"
has "a manager cannot (owner decision: the owner and administrators only)" "$(as $M "select set_shared_setting('profit_estimates', '$V1')")" "Only the owner or an administrator"
has "an AI agent account cannot" "$(as $G "select set_shared_setting('profit_estimates', '$V1')")" "Only the owner or an administrator"
has "staff cannot insert directly either" "$(as $E "insert into shared_settings (key, value) values ('sneaky', '{}')")" "Only the owner\|row-level security"
has "staff cannot update directly either" "$(as $E "update shared_settings set value = '{}' returning key")" "^$\|Only the owner\|row-level security"
has "a visitor cannot run it" "$(as anon "select set_shared_setting('profit_estimates', '$V1')")" "permission denied"
ok  "  (unchanged)" "$(q "select count(*)||'|'||(value->>'postage') from shared_settings group by value")" "1|5"

echo " 3. who can read"
ok  "the owner and an administrator read it; staff do not (owner_admin)" "$(as $O "select count(*) from shared_settings")/$(as $A "select count(*) from shared_settings")/$(as $E "select count(*) from shared_settings")" "1/1/0"
ok  "a setting marked for staff" "$(as $O "select (set_shared_setting('team_notice', '{\"text\": \"SYNTHETIC\"}', 'staff'))->>'ok'")" "true"
ok  "  staff read only that one" "$(as $E "select string_agg(key, ',') from shared_settings")" "team_notice"
ok  "a deactivated account reads nothing" "$(as $X "select count(*) from shared_settings")" "0"
ok  "a manager reads only the staff setting (never the owner-and-administrator ones)" "$(as $M "select string_agg(key, ',') from shared_settings")" "team_notice"
ok  "an AI agent account reads nothing (not staff, drafts/72)" "$(as $G "select count(*) from shared_settings")" "0"
has "a visitor reads nothing" "$(as anon "select count(*) from shared_settings")" "permission denied"

echo " 4. what is refused"
has "a key with capitals or spaces" "$(as $O "select set_shared_setting('Bad Key', '{}')")" "check constraint"
has "a one-letter key" "$(as $O "select set_shared_setting('x', '{}')")" "check constraint"
has "a value that is not an object" "$(as $O "select set_shared_setting('list_value', '[1,2]')")" "check constraint"
has "no value" "$(as $O "select set_shared_setting('no_value', null)")" "needs a value"
has "a very large value" "$(as $O "select set_shared_setting('big_value', jsonb_build_object('t', repeat('a', 9000)))")" "check constraint"
has "an unknown audience" "$(as $O "select set_shared_setting('odd_audience', '{}', 'everyone')")" "check constraint"
has "renaming a setting" "$(as $O "update shared_settings set key = 'renamed' where key = 'team_notice'")" "cannot change"
has "deleting it (the owner included): no delete permission at all" "$(as $O "delete from shared_settings")" "permission denied"
has "  and the guard refuses it even for the table owner" "$(q "delete from shared_settings")" "stays on the record"
ok  "a typed 'saved by' is replaced by the real person" "$(as $O "update shared_settings set updated_by = '$A' where key = 'team_notice' returning updated_by = '$O'")" "t"
ok  "  (two settings, as before)" "$(q "select count(*) from shared_settings")" "2"

echo " 4b. two devices saving the same list at the same moment (owner queue of Nov 25, task 7)"
L0='{"items": [{"id": "a"}]}'
ok  "the owner starts a list" "$(as $O "select (set_shared_setting('handoffs_handled', '$L0', 'owner_admin', null, true))->>'ok'")" "true"
has "  starting it again as new is a conflict, nothing changes" "$(as $A "select set_shared_setting('handoffs_handled', '{\"items\": []}', 'owner_admin', null, true)")" '"conflict": true'
T0=$(q "select updated_at from shared_settings where key = 'handoffs_handled'")
# both devices read version T0; each adds its own item; both save at the same instant
RACE=$(mktemp)
( as $O "select set_shared_setting('handoffs_handled', '{\"items\": [{\"id\": \"a\"}, {\"id\": \"b\"}]}', 'owner_admin', '$T0', false)" >>"$RACE" ) &
( as $A "select set_shared_setting('handoffs_handled', '{\"items\": [{\"id\": \"a\"}, {\"id\": \"c\"}]}', 'owner_admin', '$T0', false)" >>"$RACE" ) &
wait
ok  "  two saves of the same version at once: exactly one goes through, the other is told 'conflict'" "$(grep -c '"ok": true' "$RACE")/$(grep -c '"conflict": true' "$RACE")" "1/1"
rm -f "$RACE"
T1=$(q "select updated_at from shared_settings where key = 'handoffs_handled'")
NOW=$(q "select value::text from shared_settings where key = 'handoffs_handled'")
# the device that lost reads again, joins its item to the newer list, saves with the new version
JOINED=$(q "select jsonb_build_object('items', (value->'items') || jsonb_build_array(jsonb_build_object('id', case when value::text like '%\"b\"%' then 'c' else 'b' end)))::text from shared_settings where key = 'handoffs_handled'")
ok  "  the other device reads again and saves the joined list" "$(as $A "select (set_shared_setting('handoffs_handled', '$JOINED', 'owner_admin', '$T1', false))->>'ok'")" "true"
ok  "  nothing was erased: a, b and c are all there" "$(q "select string_agg(e->>'id', ',' order by e->>'id') from shared_settings, jsonb_array_elements(value->'items') e where key = 'handoffs_handled'")" "a,b,c"
has "a save with an old version is refused, nothing changes" "$(as $O "select set_shared_setting('handoffs_handled', '{\"items\": []}', 'owner_admin', '$T0', false)")" '"conflict": true'
ok  "  (still a, b and c)" "$(q "select jsonb_array_length(value->'items') from shared_settings where key = 'handoffs_handled'")" "3"
has "the version check does not let staff in" "$(as $E "select set_shared_setting('handoffs_handled', '{\"items\": []}', 'owner_admin', '$T1', false)")" "Only the owner or an administrator"
ok  "a save without a version still replaces (a single switch: the last choice wins)" "$(as $O "select (set_shared_setting('one_switch', '{\"on\": true}'))->>'ok'")$(as $A "select (set_shared_setting('one_switch', '{\"on\": false}'))->>'ok'")|$(q "select value->>'on' from shared_settings where key = 'one_switch'")" "truetrue|false"

echo " 5. audit"
ok  "every change is in audit_log" "$(q "select count(*) >= 3 from audit_log where table_name = 'shared_settings'")" "t"
ok  "  each under its row's id" "$(q "select count(*) from audit_log a where a.table_name = 'shared_settings' and not exists (select 1 from shared_settings s where s.id::text = a.record_id)")" "0"

echo " 6. rollback"
ok  "the rollback stops while settings are saved" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "shared setting(s) are saved"
ok  "  (the table is still there)" "$(q "select count(*) from shared_settings")" "4"
ok  "with written authorization in the session it removes everything" "$(psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_shared_settings = 'yes, delete the shared settings';" -f "$ROLLBACK" >"$OUTF" 2>&1; echo $?)" "0"
ok  "  gone" "$(q "select to_regclass('public.shared_settings') is null and to_regprocedure('public.set_shared_setting(text,jsonb,text)') is null")" "t"
ok  "  running it again is harmless" "$(run "$ROLLBACK")" "0"

echo " 7. a table of the same name that is not ours"
q "create table public.shared_settings (id int)" >/dev/null
ok  "the install refuses and changes nothing" "$(run "$INSTALL")" "3"
has "  and says why" "$(cat "$OUTF")" "was not created by this file"
ok  "the rollback refuses to touch it too" "$(run "$ROLLBACK")" "3"
ok  "  (the foreign table is untouched)" "$(q "select count(*) from information_schema.columns where table_name = 'shared_settings'")" "1"
q "drop table public.shared_settings" >/dev/null
ok "  and the install works again afterwards" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "shared settings: $pass passed, $fail failed"
[ "$fail" = 0 ]
