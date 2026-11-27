#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-27). Never point this at Supabase.
# Tests drafts/74 (shared_settings.id, so production's audit trigger can record each save) and
# drafts/75 (its rollback) on a throwaway copy whose audit function is word for word production's
# audit_trigger_function() (owner's read-only look of Nov 27; see 01_REAL_SHAPE). First it shows
# the failure the owner hit on Nov 27 after step A: every save refused with
# 'record "new" has no field "id"'. All rows synthetic.
# Usage: shared_settings_audit_id_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_shared_settings_audit_id_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
STEP_A="$DIR/drafts/50_DRAFT_shared_settings.sql"
INSTALL="$DIR/drafts/74_DRAFT_shared_settings_audit_id.sql"; ROLLBACK="$DIR/drafts/75_DRAFT_rollback_shared_settings_audit_id.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2"
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$who'; $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000074a1   # owner, active
E=00000000-0000-4000-8000-0000000074a2   # employee, active

fresh() {
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
  q "delete from profiles where id in ('$O','$E');
     insert into profiles (id, email, role, is_active, deleted_at, account_number) values
       ('$O','o74@example.test','owner',true,null,'740000001'), ('$E','e74@example.test','employee',true,null,'740000002');" >"$OUTF" 2>&1
  if grep -q ERROR "$OUTF"; then echo "set-up failed:"; cat "$OUTF"; fi
}
save() { as "$1" "select public.set_shared_setting('$2', '$3'::jsonb, 'staff')"; }
audit_rows() { q "select count(*) from audit_log where table_name = 'shared_settings'"; }

fresh
echo "shared_settings.id for production's audit trigger (drafts/74, drafts/75; throwaway database $DB)"
has "set-up: the audit function reads new.id directly, as production's does" "$(q "select prosrc from pg_proc where proname = 'local_audit'")" "new.id::text"
# he_real already has stand-ins for is_active_staff() and active_role() (step 0), so step A goes straight on
ok  "step A installs" "$(run "$STEP_A")" "0"
echo " today (step A alone, as in production on Nov 27)"
has "an owner's save is refused exactly as on Nov 27" "$(save "$O" profit_estimates '{"fees":1}')" 'record "new" has no field "id"'
ok  "  nothing was saved" "$(q "select count(*) from shared_settings")" "0"
ok  "  nothing was written to the history log" "$(audit_rows)" "0"
# a row that got in before the fix (by hand, past the triggers) must get an id too
q "alter table shared_settings disable trigger user; insert into shared_settings (key, value, audience, updated_by) values ('old_note', '{\"a\":1}', 'staff', '$O'); alter table shared_settings enable trigger user;" >/dev/null

echo " drafts/74"
ok  "drafts/74 installs" "$(run "$INSTALL")" "0"
ok  "  the column is a uuid, filled for the existing row" "$(q "select format_type(atttypid, atttypmod) from pg_attribute where attrelid = 'shared_settings'::regclass and attname = 'id'")|$(q "select count(*) from shared_settings where id is null")" "uuid|0"
ok  "  it is unique" "$(q "select count(*) from pg_indexes where indexname = 'shared_settings_id_key' and indexdef like '%UNIQUE%'")" "1"
ok  "  an owner's save is accepted" "$(save "$O" profit_estimates '{"fees":1}' | grep -c '"ok": true')" "1"
ok  "  and recorded in the history log under the row's id" "$(q "select count(*) from audit_log a join shared_settings s on a.record_id = s.id::text where a.table_name = 'shared_settings' and a.action = 'INSERT' and s.key = 'profit_estimates'")" "1"
ok  "  with who saved it" "$(q "select changed_by from audit_log where table_name = 'shared_settings' and action = 'INSERT'")" "$O"
ID1=$(q "select id from shared_settings where key = 'profit_estimates'")
ok  "  saving it again replaces the value" "$(save "$O" profit_estimates '{"fees":2}' | grep -c '"ok": true')|$(q "select value->>'fees' from shared_settings where key = 'profit_estimates'")" "1|2"
ok  "  keeps the same id" "$(q "select id from shared_settings where key = 'profit_estimates'")" "$ID1"
ok  "  and the history log shows the change, old and new" "$(q "select old_data->'value'->>'fees' || '>' || (new_data->'value'->>'fees') from audit_log where table_name = 'shared_settings' and action = 'UPDATE' and record_id = '$ID1'")" "1>2"
U=$(q "select updated_at from shared_settings where key = 'profit_estimates'")
ok  "  a save with the version read still works" "$(as "$O" "select public.set_shared_setting('profit_estimates', '{\"fees\":3}'::jsonb, 'staff', '$U'::timestamptz)" | grep -c '"ok": true')" "1"
ok  "  and a save with an old version is still refused as a conflict" "$(as "$O" "select public.set_shared_setting('profit_estimates', '{\"fees\":4}'::jsonb, 'staff', '$U'::timestamptz)" | grep -c '"conflict": true')" "1"
has "  an employee still cannot save" "$(save "$E" x_note '{}')" "Only the owner or an administrator"
ok  "  the employee reads the staff setting" "$(as "$E" "select string_agg(key, ',' order by key) from shared_settings")" "old_note,profit_estimates"
has "  a setting still cannot be deleted (signed-in people have no right to delete)" "$(as "$O" "delete from shared_settings where key = 'old_note'")" "permission denied"
ok  "  (still there)" "$(q "select count(*) from shared_settings where key = 'old_note'")" "1"
ok  "  a second install changes nothing" "$(run "$INSTALL")|$(q "select id from shared_settings where key = 'profit_estimates'")" "0|$ID1"

echo " rollback (drafts/75)"
ok  "rollback succeeds" "$(run "$ROLLBACK")" "0"
ok  "  the column is gone" "$(q "select count(*) from pg_attribute where attrelid = 'shared_settings'::regclass and attname = 'id' and not attisdropped")" "0"
ok  "  the saved settings stay" "$(q "select count(*) from shared_settings")" "2"
has "  saves are refused again, as before drafts/74" "$(save "$O" profit_estimates '{"fees":5}')" 'has no field "id"'
ok  "  a second rollback is harmless" "$(run "$ROLLBACK")" "0"
ok  "  install works again afterwards" "$(run "$INSTALL")|$(save "$O" profit_estimates '{"fees":6}' | grep -c '"ok": true')" "0|1"

echo " refusals"
fresh
ok  "without step A, drafts/74 stops and changes nothing" "$(run "$INSTALL")" "3"
has "  and says to install step A first" "$(cat "$OUTF")" "Install step A first"
fresh; run "$STEP_A" >/dev/null
q "alter table shared_settings add column id text" >/dev/null
ok  "an id column it did not add: drafts/74 stops" "$(run "$INSTALL")" "3"
has "  and says so" "$(cat "$OUTF")" "did not add"
ok  "  the other column is untouched" "$(q "select format_type(atttypid, atttypmod) from pg_attribute where attrelid = 'shared_settings'::regclass and attname = 'id'")" "text"
ok  "  the rollback also leaves it alone" "$(run "$ROLLBACK")|$(q "select count(*) from pg_attribute where attrelid = 'shared_settings'::regclass and attname = 'id' and not attisdropped")" "3|1"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
