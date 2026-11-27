#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-27, night). Never point this at Supabase.
# The three production-shape problems found on Nov 27, each reproduced on a throwaway copy shaped like
# production (production_shape_install_test.sh's set-up, built from the owner's read-only looks), and
# each fix deliberately REMOVED from a copy of the draft to prove a check would catch it again:
#   M1  role compared through current_role(), which answers the fixed list app_role: a role name that
#       is not on the list ('manager') is an error, so the draft does not install
#   M2  current_role() answers for switched-off accounts too: through it the save function's own check lets a
#       switched-off administrator through (only the read rule then still refuses); active_role() stops it there
#   M3  production has no is_active_staff(): without step 0 (drafts/72) step A stops, changing nothing
#   M4  production's history recorder writes new.id: a table the recorder is attached to without an id
#       is caught by the "every audited table has id" check
# The drafts themselves are never changed: each mutation is a copy in a temporary folder. All rows synthetic.
# Usage: production_shape_mutation_test.sh -h /var/tmp/hepg -p 5499 -U postgres
set -u
CONN=("$@")
HERE="$(cd "$(dirname "$0")" && pwd)"; DIR="$(cd "$HERE/.." && pwd)"
TPL=he_ps_mutation_template; DB=he_ps_mutation_test
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has() { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
OUTF=$(mktemp); TMP=$(mktemp -d)
run() { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()  { psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$1'; $2; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
draft() { ls "$DIR"/drafts/${1}_DRAFT_*.sql | grep -v rollback | head -1; }
fresh() {
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $TPL" >/dev/null || { echo "cannot copy $TPL"; exit 2; }
}

# the starting copy: production's shape, nothing waiting installed
HE_PS_DB=$TPL HE_PS_ORDER="" HE_PS_KEEP=1 bash "$HERE/production_shape_install_test.sh" "${CONN[@]}" >"$OUTF" 2>&1 || { echo "set-up failed:"; cat "$OUTF"; exit 2; }
echo "Production-shape problems of Nov 27, each with its fix removed (throwaway database $DB)"

echo " M1 the role list is app_role: 'manager' is not on it (before drafts/62)"
fresh
ok  "step 0 (drafts/72)" "$(run "$(draft 72)")" "0"
ok  "drafts/36 as written (asks active_role(), text) installs" "$(run "$(draft 36)")" "0"
fresh; run "$(draft 72)" >/dev/null
sed "s/public\.active_role() = 'manager'/public.current_role() = 'manager'/g" "$(draft 36)" > "$TMP/36_mutated.sql"
ok  "  (the copy really differs)" "$(grep -c "current_role() = 'manager'" "$TMP/36_mutated.sql" | awk '{print ($1>0)?"yes":"no"}')" "yes"
ok  "the same draft asking current_role() does not install" "$(run "$TMP/36_mutated.sql")" "3"
has "  with the error production would give" "$(cat "$OUTF")" 'invalid input value for enum app_role: "manager"'

echo " M2 current_role() answers for switched-off accounts"
O=00000000-0000-4000-8000-00000000c0a1; X=00000000-0000-4000-8000-00000000c0a2
people() { q "insert into profiles (id, email, role, is_active) values ('$O','own-m@example.test','owner',true), ('$X','off-admin-m@example.test','administrator',false)" >/dev/null; }
fresh; people
run "$(draft 72)" >/dev/null; ok "drafts/50 as written installs" "$(run "$(draft 50)")" "0"; run "$(draft 74)" >/dev/null
has "a switched-off administrator's save is refused" "$(as "$X" "select public.set_shared_setting('m2_note', '{\"a\":1}'::jsonb, 'staff')")" "Only the owner or an administrator"
ok  "  nothing saved" "$(q "select count(*) from shared_settings")" "0"
fresh; people; run "$(draft 72)" >/dev/null
sed "s/coalesce(public\.active_role(), '')/coalesce(public.current_role()::text, '')/g" "$(draft 50)" > "$TMP/50_mutated.sql"   # the role checks only (the install check still asks for active_role)
ok  "drafts/50 asking current_role() instead installs" "$(run "$TMP/50_mutated.sql")" "0"; run "$(draft 74)" >/dev/null
R=$(as "$X" "select public.set_shared_setting('m2_note', '{\"a\":1}'::jsonb, 'staff')")
ok  "  the save function's own check no longer stops the switched-off administrator (the fix is what stops it there)" "$(echo "$R" | grep -c 'Only the owner or an administrator')" "0"
has "  the second layer still refuses: the read rule (production's is_owner_or_admin() checks 'active')" "$R" "row-level security"
ok  "  (nothing saved)" "$(q "select count(*) from shared_settings")" "0"

echo " M3 production has no is_active_staff() until step 0"
fresh
ok  "set-up: is_active_staff() is missing" "$(q "select to_regprocedure('public.is_active_staff()') is null")" "t"
ok  "step A without step 0 stops" "$(run "$(draft 50)")" "3"
has "  and names what is missing" "$(cat "$OUTF")" "is_active_staff"
ok  "  nothing was created" "$(q "select to_regclass('public.shared_settings') is null and to_regprocedure('public.set_shared_setting(text,jsonb,text,timestamptz,boolean)') is null")" "t"
ok  "with step 0 first it installs" "$(run "$(draft 72)")|$(run "$(draft 50)")" "0|0"

echo " M4 the history recorder needs an id on every table it is attached to"
CHECK="select coalesce(string_agg(distinct c.relname::text, ','), '') from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid where not t.tgisinternal and p.oid = (select tgfoid from pg_trigger where tgrelid = 'public.tasks'::regclass and not tgisinternal and lower(tgname) like '%audit%' limit 1) and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'id' and not a.attisdropped)"
fresh; people; run "$(draft 72)" >/dev/null
ok  "drafts/52 as written installs" "$(run "$(draft 52)")" "0"
ok  "  and the check finds no audited table without an id" "$(q "$CHECK")" ""
ORD=$(q "insert into orders (channel) values ('manual') returning id")
ok  "  the owner's write is saved and recorded in the history log" "$(as "$O" "insert into order_costs (order_id, postage_cents, postage_source) values ('$ORD', 450, 'manual')" | grep -c ERROR)|$(q "select count(*) from audit_log where table_name = 'order_costs'")" "0|1"
fresh; people; run "$(draft 72)" >/dev/null
grep -v -E '^[[:space:]]*id[[:space:]]+uuid not null default gen_random_uuid\(\) unique,' "$(draft 52)" > "$TMP/52_mutated.sql"
ok  "  (the copy really lacks the id column)" "$(diff "$(draft 52)" "$TMP/52_mutated.sql" >/dev/null && echo same || echo differs)" "differs"
run "$TMP/52_mutated.sql" >/dev/null
ok  "drafts/52 without its id: the check names the table" "$(q "$CHECK")" "order_costs"
ORD=$(q "insert into orders (channel) values ('manual') returning id")
W=$(as "$O" "insert into order_costs (order_id, postage_cents, postage_source) values ('$ORD', 450, 'manual')")   # as the owner, as the dashboard would
has "  and a direct write fails as production's would" "$W" 'has no field "id"'

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" -c "drop database if exists $TPL with (force)" >/dev/null 2>&1
rm -rf "$OUTF" "$TMP"
echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
