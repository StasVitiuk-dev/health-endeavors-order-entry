#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-07, extension 6). Never point this at Supabase.
# Tests drafts/19 (request keys) and drafts/20 (rollback) on the throwaway
# local database: install, re-install, duplicate refusal, concurrent retries,
# retry lookup under row-level security, all-or-nothing install, rollback.
# Usage: request_keys_test.sh <psql args>   e.g. -h /var/tmp/hepg -p 5499 -U postgres -d he_real
P="psql $* -qtAX -v ON_ERROR_STOP=0 --set=client_min_messages=warning"
DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL="$DIR/../drafts/19_DRAFT_request_keys.sql"
ROLLBACK="$DIR/../drafts/20_DRAFT_rollback_request_keys.sql"
OWNER="set role authenticated; set request.jwt.claim.sub to '00000000-0000-4000-8000-000000000001';"
STAFF="set role authenticated; set request.jwt.claim.sub to '00000000-0000-4000-8000-0000000000e2';"  # its own staff user: never change a role other tests rely on
K=a5000000-0000-4000-8000-000000000001
pass=0; failn=0
check() { if [ "$2" = "$3" ]; then echo "  ok   $1"; pass=$((pass+1)); else echo "  FAIL $1 (got '$2', want '$3')"; failn=$((failn+1)); fi; }
q() { $P -c "$1" 2>&1; }

q "insert into profiles (id,email,role) values ('00000000-0000-4000-8000-000000000001','keys-owner@example.test','owner'),
     ('00000000-0000-4000-8000-0000000000e2','keys-staff@example.test','employee') on conflict (id) do update set role=excluded.role" >/dev/null
$P -f "$ROLLBACK" >/dev/null 2>&1
q "delete from expenses where note like 'KEYS%'; delete from returns where reason like 'KEYS%'" >/dev/null
TABLES=$(q "select count(*) from unnest(array['expenses','inventory_adjustments','inventory_lots','returns','recalls','products','suppliers','documents','evidence_locker','adverse_event_reports','legal_holds','quality_checks','incidents','sop_documents','feature_requests','manual_attention_items','personal_calendar_events','tasks','orders','order_items','purchase_orders','purchase_order_items']) t where to_regclass('public.'||t) is not null")

echo "1 install"
out=$($P -f "$INSTALL" 2>&1)
check "install succeeds" "$(grep -c ERROR <<<"$out")" 0
check "install reports what it did, and skipped tables not in this schema" "$(grep -c "Request keys installed on $TABLES tables. Not found (skipped):" <<<"$out")" 1
check "every present table has the column" "$(q "select count(*) from information_schema.columns where table_schema='public' and column_name='client_request_id'")" "$TABLES"
check "every present table has the unique partial index" "$(q "select count(*) from pg_indexes where schemaname='public' and indexname like '%_client_request_id_key' and indexdef like '%UNIQUE%' and indexdef like '%WHERE (client_request_id IS NOT NULL)%'")" "$TABLES"
check "existing rows keep an empty key" "$(q "select count(*) from expenses where client_request_id is not null")" 0

echo "2 install again"
out=$($P -f "$INSTALL" 2>&1)
check "a second install changes nothing and does not fail" "$(grep -c ERROR <<<"$out")" 0
check "still one index per table" "$(q "select count(*) from pg_indexes where schemaname='public' and indexname like '%_client_request_id_key'")" "$TABLES"

echo "3 duplicates"
q "$OWNER insert into expenses (category, amount, expense_date, note) values ('other', 1, current_date, 'KEYS no key'), ('other', 1, current_date, 'KEYS no key')" >/dev/null
check "creates without a key are unaffected (two identical rows allowed, as today)" "$(q "select count(*) from expenses where note='KEYS no key'")" 2
check "first attempt with a key is saved" "$(q "$OWNER insert into expenses (category, amount, expense_date, note, client_request_id) values ('other', 12.5, current_date, 'KEYS keyed', '$K') returning 1" | grep -c '^1$')" 1
r=$(q "$OWNER insert into expenses (category, amount, expense_date, note, client_request_id) values ('other', 12.5, current_date, 'KEYS keyed', '$K')")
check "retry of the same attempt is refused as a duplicate" "$(grep -c 'duplicate key value violates unique constraint "expenses_client_request_id_key"' <<<"$r")" 1
check "only one expense exists for that attempt" "$(q "select count(*) from expenses where client_request_id='$K'")" 1
check "the retry can find the saved record (owner, row-level security on)" "$(q "$OWNER select (amount = 12.5)::text from expenses where client_request_id='$K'")" true
check "a different attempt (new key) is a new record" "$(q "$OWNER insert into expenses (category, amount, expense_date, note, client_request_id) values ('other', 12.5, current_date, 'KEYS keyed', gen_random_uuid()) returning 1" | grep -c '^1$')" 1

echo "4 twenty simultaneous retries of one attempt"
K2=a5000000-0000-4000-8000-000000000002
for i in $(seq 20); do q "$OWNER insert into expenses (category, amount, expense_date, note, client_request_id) values ('other', 7, current_date, 'KEYS burst', '$K2')" >/dev/null & done; wait
check "exactly one record" "$(q "select count(*) from expenses where client_request_id='$K2'")" 1

echo "5 staff (employee) creates a return"
K3=a5000000-0000-4000-8000-000000000003
ret_cols=$(q "select string_agg(column_name, ',') from information_schema.columns where table_schema='public' and table_name='returns' and is_nullable='NO' and column_default is null")
if [ -z "$ret_cols" ] || [ "$ret_cols" = "" ]; then
  q "$STAFF insert into returns (reason, client_request_id) values ('KEYS staff', '$K3')" >/dev/null
  r=$(q "$STAFF insert into returns (reason, client_request_id) values ('KEYS staff', '$K3')")
  check "staff retry refused as duplicate" "$(grep -c 'returns_client_request_id_key' <<<"$r")" 1
  check "staff can find their saved return by key" "$(q "$STAFF select count(*) from returns where client_request_id='$K3'")" 1
else
  echo "  (returns has required columns $ret_cols in this schema; staff case checked on tasks instead)"
  q "$STAFF insert into tasks (title, client_request_id) values ('KEYS staff', '$K3')" >/dev/null
  r=$(q "$STAFF insert into tasks (title, client_request_id) values ('KEYS staff', '$K3')")
  check "staff retry refused as duplicate" "$(grep -c 'tasks_client_request_id_key' <<<"$r")" 1
  check "staff can find their saved task by key" "$(q "$STAFF select count(*) from tasks where client_request_id='$K3'")" 1
  q "delete from tasks where title='KEYS staff'" >/dev/null
fi

echo "6 rollback"
$P -f "$ROLLBACK" >/dev/null 2>&1
check "no column left" "$(q "select count(*) from information_schema.columns where table_schema='public' and column_name='client_request_id'")" 0
check "no index left" "$(q "select count(*) from pg_indexes where schemaname='public' and indexname like '%_client_request_id_key'")" 0
check "records saved with keys are kept" "$(q "select count(*) from expenses where note in ('KEYS keyed','KEYS burst')")" 3
out=$($P -f "$ROLLBACK" 2>&1)
check "a second rollback does not fail" "$(grep -c ERROR <<<"$out")" 0

echo "7 all-or-nothing: a table the dashboard could not write stops the whole install"
q "revoke insert on public.suppliers from authenticated; grant insert (name) on public.suppliers to authenticated" >/dev/null
out=$($P -f "$INSTALL" 2>&1)
check "install refuses with a clear message" "$(grep -c 'Install stopped, nothing was changed: the dashboard role cannot write client_request_id on suppliers' <<<"$out")" 1
check "and nothing was changed on any table" "$(q "select count(*) from information_schema.columns where table_schema='public' and column_name='client_request_id'")" 0
q "revoke insert (name) on public.suppliers from authenticated; grant insert on public.suppliers to authenticated" >/dev/null
check "table privilege restored for the rest of the tests" "$(q "select has_table_privilege('authenticated','public.suppliers','INSERT')::text")" true

q "delete from expenses where note like 'KEYS%'" >/dev/null
echo "TOTAL: $pass passed, $failn failed"
[ "$failn" -eq 0 ]
