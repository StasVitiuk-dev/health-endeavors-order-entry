#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-24). Never point this at Supabase.
# Tests drafts/58 (one person's settings on every device: each person reads and
# saves only their own, replaced never deleted, the limits, refuses a foreign
# table) and drafts/59 (rollback) on a throwaway copy, as the owner, an
# administrator, two staff members, a deactivated account and a visitor.
# All values are made up.
# Usage: my_settings_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_my_settings_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/58_DRAFT_my_settings.sql"; ROLLBACK="$DIR/drafts/59_DRAFT_rollback_my_settings.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-240)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-000000000ba1; A=00000000-0000-4000-8000-000000000ba2; E=00000000-0000-4000-8000-000000000ba3; F=00000000-0000-4000-8000-000000000ba4; X=00000000-0000-4000-8000-000000000ba5
V1='{"items": {"task:1": {"until": 1795600000000, "sig": "a"}}, "clearedAt": 0}'
V2='{"items": {}, "clearedAt": 1795500000000}'
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "delete from profiles where id in ('$O','$A','$E','$F','$X');
   insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'910000001'),
     ('$A','admin@example.test','administrator',true,'910000002'), ('$E','staff1@example.test','employee',true,'910000003'),
     ('$F','staff2@example.test','employee',true,'910000004'), ('$X','gone@example.test','employee',false,'910000005');" >/dev/null
echo "One person's settings (throwaway database $DB)"

echo " 1. install"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"
ok  "  the table is empty and marked" "$(q "select count(*) from my_settings")/$(q "select obj_description('public.my_settings'::regclass, 'pg_class') like 'Health Endeavors drafts/58:%'")" "0/t"

echo " 2. each person saves their own"
ok  "a staff member saves a setting" "$(as $E "select (set_my_setting('feed_snooze', '$V1'))->>'ok'")" "true"
ok  "  stored under that person, with the time" "$(q "select (user_id = '$E') || '|' || (value->'items' ? 'task:1') || '|' || (updated_at > now() - interval '1 minute') from my_settings")" "true|true|true"
ok  "saving again replaces the value (one row)" "$(as $E "select (set_my_setting('feed_snooze', '$V2'))->>'ok'")|$(q "select count(*) || '|' || (value->>'clearedAt') from my_settings group by value")" "true|1|1795500000000"
ok  "another staff member, the administrator and the owner each save the same key for themselves" "$(as $F "select (set_my_setting('feed_snooze', '$V1'))->>'ok'")$(as $A "select (set_my_setting('feed_snooze', '$V1'))->>'ok'")$(as $O "select (set_my_setting('feed_snooze', '$V1'))->>'ok'")/$(q "select count(*) from my_settings")" "truetruetrue/4"

echo " 3. nobody reads or changes another person's settings, the owner included"
ok  "each person sees one row: their own" "$(as $E "select count(*) || ':' || bool_and(user_id = '$E') from my_settings")/$(as $F "select count(*) || ':' || bool_and(user_id = '$F') from my_settings")/$(as $A "select count(*) from my_settings")/$(as $O "select count(*) || ':' || bool_and(user_id = '$O') from my_settings")" "1:true/1:true/1/1:true"
ok  "a person cannot change someone else's row (nothing matches)" "$(as $F "update my_settings set value = '{}' where user_id = '$E' returning 1" | wc -l | tr -d ' ')/$(q "select value->>'clearedAt' from my_settings where user_id = '$E'")" "0/1795500000000"
as $F "insert into my_settings (user_id, key, value) values ('$E', 'typed_for_someone_else', '{}')" >/dev/null
ok  "a row typed for someone else is stored under the person who is signed in, never under the other" "$(q "select (select count(*) from my_settings where user_id = '$E' and key = 'typed_for_someone_else') || '|' || (select count(*) from my_settings where user_id = '$F' and key = 'typed_for_someone_else')")" "0|1"
has "a deactivated account reads nothing" "$(as $X "select count(*) from my_settings")" "^0$"
has "  and saves nothing" "$(as $X "select set_my_setting('feed_snooze', '$V1')")" "Only a signed-in, active team member"
has "a visitor reads nothing" "$(as anon "select count(*) from my_settings")" "permission denied"
has "  and cannot run it" "$(as anon "select set_my_setting('feed_snooze', '$V1')")" "permission denied"
has "the database owner without a signed-in person cannot save one either" "$(q "select set_my_setting('feed_snooze', '$V1')")" "Only a signed-in, active team member"

echo " 4. what is refused"
has "a key with capitals or spaces" "$(as $E "select set_my_setting('Bad Key', '{}')")" "check constraint"
has "a value that is not an object" "$(as $E "select set_my_setting('list_value', '[1,2]')")" "check constraint"
has "no value" "$(as $E "select set_my_setting('no_value', null)")" "needs a value"
has "a very large value" "$(as $E "select set_my_setting('big_value', jsonb_build_object('t', repeat('a', 9000)))")" "check constraint"
has "renaming a setting" "$(as $E "update my_settings set key = 'renamed' where key = 'feed_snooze'")" "keeps its name"
has "deleting it: no delete permission at all" "$(as $E "delete from my_settings")" "permission denied"
has "  and the guard refuses it even for the table owner" "$(q "delete from my_settings")" "stays on the record"
as $E "select set_my_setting('k' || lpad(i::text, 2, '0'), '{}') from generate_series(1, 39) i" >/dev/null
has "at most 40 settings per person" "$(as $E "select set_my_setting('one_too_many', '{}')")" "At most 40"
ok  "  (40 rows for that person; the others untouched)" "$(q "select (select count(*) from my_settings where user_id = '$E') || '|' || (select count(*) from my_settings where user_id <> '$E')")" "40|4"
ok  "  replacing one of the 40 still works" "$(as $E "select (set_my_setting('feed_snooze', '$V1'))->>'ok'")" "true"
ok  "    and really replaced it" "$(q "select value->'items' ? 'task:1' from my_settings where user_id = '$E' and key = 'feed_snooze'")" "t"
has "  a direct insert past the limit is refused too" "$(as $E "insert into my_settings (key, value) values ('direct_extra', '{}')")" "At most 40"

echo " 4b. two of one person's devices saving the same list at the same moment (owner queue of Nov 25, task 7)"
ok  "the owner's phone starts a list" "$(as $O "select (set_my_setting('feed_race', '{\"items\": [\"a\"]}', null, true))->>'ok'")" "true"
has "  starting it again as new is a conflict, nothing changes" "$(as $O "select set_my_setting('feed_race', '{\"items\": []}', null, true)")" '"conflict": true'
T0=$(q "select updated_at from my_settings where user_id = '$O' and key = 'feed_race'")
# the phone and the Mac both read version T0; each adds its own item; both save at the same instant
RACE=$(mktemp)
( as $O "select set_my_setting('feed_race', '{\"items\": [\"a\", \"b\"]}', '$T0', false)" >>"$RACE" ) &
( as $O "select set_my_setting('feed_race', '{\"items\": [\"a\", \"c\"]}', '$T0', false)" >>"$RACE" ) &
wait
ok  "  two saves of the same version at once: exactly one goes through, the other is told 'conflict'" "$(grep -c '"ok": true' "$RACE")/$(grep -c '"conflict": true' "$RACE")" "1/1"
rm -f "$RACE"
T1=$(q "select updated_at from my_settings where user_id = '$O' and key = 'feed_race'")
JOINED=$(q "select jsonb_build_object('items', (value->'items') || to_jsonb(case when value::text like '%\"b\"%' then 'c' else 'b' end))::text from my_settings where user_id = '$O' and key = 'feed_race'")
ok  "  the other device reads again and saves the joined list" "$(as $O "select (set_my_setting('feed_race', '$JOINED', '$T1', false))->>'ok'")" "true"
ok  "  nothing was erased: a, b and c are all there" "$(q "select string_agg(e, ',' order by e) from my_settings, jsonb_array_elements_text(value->'items') e where user_id = '$O' and key = 'feed_race'")" "a,b,c"
has "a save with an old version is refused, nothing changes" "$(as $O "select set_my_setting('feed_race', '{\"items\": []}', '$T0', false)")" '"conflict": true'
ok  "  (still a, b and c)" "$(q "select jsonb_array_length(value->'items') from my_settings where user_id = '$O' and key = 'feed_race'")" "3"
has "another person's version check never reaches the owner's row (their own row is new to them)" "$(as $F "select set_my_setting('feed_race', '{\"items\": [\"x\"]}', '$T1', false)")" '"conflict": true'
ok  "  (the owner's list is untouched, and the other person has no such row)" "$(q "select (select jsonb_array_length(value->'items') from my_settings where user_id = '$O' and key = 'feed_race') || '|' || (select count(*) from my_settings where user_id = '$F' and key = 'feed_race')")" "3|0"
has "the version check does not let a visitor in" "$(as anon "select set_my_setting('feed_race', '{}', '$T1', false)")" "permission denied\|Only a signed-in"
ok  "a save without a version still replaces" "$(as $O "select (set_my_setting('feed_race', '{\"items\": []}'))->>'ok'")|$(q "select jsonb_array_length(value->'items') from my_settings where user_id = '$O' and key = 'feed_race'")" "true|0"

echo " 5. not audited on purpose (view preferences, not business records)"
ok  "nothing about my_settings is in audit_log" "$(q "select count(*) from audit_log where table_name = 'my_settings'")" "0"

echo " 6. rollback"
ok  "it stops while settings are saved" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "personal setting(s) are saved"
ok  "with the authorization, it removes everything" "$(psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_my_settings = 'yes, delete the personal settings'" -f "$ROLLBACK" >"$OUTF" 2>&1; echo $?)" "0"
ok  "  the table and functions are gone" "$(q "select (select count(*) from pg_class where relname = 'my_settings') + (select count(*) from pg_proc where proname in ('set_my_setting', 'my_settings_guard'))")" "0"
ok  "  safe to run twice" "$(run "$ROLLBACK")" "0"
ok  "install again works" "$(run "$INSTALL")" "0"
q "drop table public.my_settings; create table public.my_settings (id int)" >/dev/null
ok  "it refuses to install over a table it did not create" "$(run "$INSTALL")" "3"
has "  and says so" "$(cat "$OUTF")" "was not created by this file"
ok  "  and the rollback refuses to touch it" "$(run "$ROLLBACK")" "3"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
