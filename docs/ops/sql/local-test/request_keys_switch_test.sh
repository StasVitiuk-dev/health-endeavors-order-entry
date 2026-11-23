#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-10, extension 9). Never point this at Supabase.
# Tests drafts/27 (request_keys switch) and drafts/28 (rollback): refuses
# before drafts/19, installs OFF after it, twice = no change, rollback refuses
# while on and removes exactly the one row.
# Usage: request_keys_switch_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_rkswitch_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run() { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >/dev/null 2>"$ERRF"; echo $?; }
ERRF=$(mktemp)
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "create table if not exists public.feature_flags (id uuid primary key default gen_random_uuid(), flag_key text not null, label text, description text, enabled boolean not null default false)" >/dev/null
echo "Request-keys switch (throwaway database $DB)"
N="select count(*)||':'||count(*) filter (where enabled) from feature_flags where flag_key = 'request_keys'"
ok "refused before drafts/19" "$(run "$DIR/drafts/27_DRAFT_request_keys_switch.sql")" "3"
ok "  says to install drafts/19 first" "$(grep -c 'install drafts/19' "$ERRF")" "1"
ok "  nothing inserted" "$(q "$N")" "0:0"
ok "drafts/19 installs" "$(run "$DIR/drafts/19_DRAFT_request_keys.sql")" "0"
ok "switch installs" "$(run "$DIR/drafts/27_DRAFT_request_keys_switch.sql")" "0"
ok "one switch, off" "$(q "$N")" "1:0"
ok "second install changes nothing" "$(run "$DIR/drafts/27_DRAFT_request_keys_switch.sql"; q "$N")" "$(printf '0\n1:0')"
q "update feature_flags set enabled = true where flag_key = 'request_keys'" >/dev/null
ok "rollback refused while on" "$(run "$DIR/drafts/28_DRAFT_rollback_request_keys_switch.sql")" "3"
q "update feature_flags set enabled = false where flag_key = 'request_keys'" >/dev/null
ok "rollback succeeds when off" "$(run "$DIR/drafts/28_DRAFT_rollback_request_keys_switch.sql")" "0"
ok "switch removed" "$(q "$N")" "0:0"
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
rm -f "$ERRF"
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
