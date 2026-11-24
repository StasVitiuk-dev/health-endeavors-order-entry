#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-24). Never point this at Supabase.
# Tests drafts/52 (the real fee and postage of each order: owner and
# administrators only, replaced never deleted, parts kept, unknown orders
# skipped, audit, refuses a foreign table) and drafts/53 (rollback) on a throwaway
# copy, as the owner, an administrator, active staff and a visitor. Made-up rows.
# Usage: order_costs_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_order_costs_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/52_DRAFT_order_costs.sql"; ROLLBACK="$DIR/drafts/53_DRAFT_rollback_order_costs.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-240)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000009a1; A=00000000-0000-4000-8000-0000000009a2; E=00000000-0000-4000-8000-0000000009a3
O1=00000000-0000-4000-8000-0000000009b1; O2=00000000-0000-4000-8000-0000000009b2; GONE=00000000-0000-4000-8000-0000000009bf
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "delete from profiles where id in ('$O','$A','$E');
   insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'900000001'),
     ('$A','admin@example.test','administrator',true,'900000002'), ('$E','staff@example.test','employee',true,'900000003');
   insert into orders (id, channel, order_number, status, total) values ('$O1','etsy','SYN-3001','paid',27), ('$O2','amazon','SYN-3002','paid',20);" >/dev/null
echo "Order costs (throwaway database $DB)"

echo " 1. install"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"
ok  "  the table is empty, marked and audited" "$(q "select count(*) from order_costs")/$(q "select obj_description('public.order_costs'::regclass, 'pg_class') like 'Health Endeavors drafts/52%'")/$(q "select count(*) from pg_trigger where tgname = 'order_costs_audit'")" "0/t/1"

echo " 2. saving"
ok  "the owner saves the fee of one order and the postage of another" "$(as $O "select set_order_costs('[{\"order_id\":\"$O1\",\"fee_cents\":269,\"fee_source\":\"etsy\"},{\"order_id\":\"$O2\",\"postage_cents\":415,\"postage_source\":\"shopify_shipping\"}]')")" '{"ok": true, "saved": 2, "unknown_orders": 0}'
ok  "  stored in cents with the source, who and when" "$(q "select fee_cents||'|'||fee_source||'|'||coalesce(postage_cents::text,'-')||'|'||(updated_by = '$O') from order_costs where order_id = '$O1'")" "269|etsy|-|true"
ok  "an administrator adds the postage of the first order; its fee is kept" "$(as $A "select (set_order_costs('[{\"order_id\":\"$O1\",\"postage_cents\":400,\"postage_source\":\"manual\"}]'))->>'saved'")|$(q "select fee_cents||'|'||fee_source||'|'||postage_cents||'|'||postage_source||'|'||(updated_by = '$A') from order_costs where order_id = '$O1'")" "1|269|etsy|400|manual|true"
ok  "a corrected fee replaces the old one (still one row per order)" "$(as $O "select (set_order_costs('[{\"order_id\":\"$O1\",\"fee_cents\":300,\"fee_source\":\"manual\"}]'))->>'saved'")|$(q "select count(*)||'|'||max(fee_cents)||'|'||max(fee_source) from order_costs where order_id = '$O1'")" "1|1|300|manual"
ok  "an order that does not exist is counted and skipped" "$(as $O "select set_order_costs('[{\"order_id\":\"$GONE\",\"fee_cents\":1,\"fee_source\":\"manual\"},{\"order_id\":\"$O2\",\"fee_cents\":300,\"fee_source\":\"amazon\"}]')")" '{"ok": true, "saved": 1, "unknown_orders": 1}'
ok  "  (two orders have costs)" "$(q "select count(*) from order_costs")" "2"

echo " 3. who can read and save"
ok  "the owner and an administrator read; staff do not" "$(as $O "select count(*) from order_costs")/$(as $A "select count(*) from order_costs")/$(as $E "select count(*) from order_costs")" "2/2/0"
has "a visitor reads nothing" "$(as anon "select count(*) from order_costs")" "permission denied"
has "staff cannot save" "$(as $E "select set_order_costs('[{\"order_id\":\"$O1\",\"fee_cents\":1,\"fee_source\":\"manual\"}]')")" "Only the owner and administrators"
has "staff cannot insert or update directly either" "$(as $E "update order_costs set fee_cents = 1 returning order_id")$(as $E "insert into order_costs (order_id, fee_cents, fee_source) values ('$O2', 1, 'manual')")" "Only the owner and administrators\|row-level security"
has "a visitor cannot run it" "$(as anon "select set_order_costs('[]')")" "permission denied"

echo " 4. what is refused"
has "a negative fee" "$(as $O "select set_order_costs('[{\"order_id\":\"$O1\",\"fee_cents\":-5,\"fee_source\":\"manual\"}]')")" "check constraint"
has "an unknown source" "$(as $O "select set_order_costs('[{\"order_id\":\"$O1\",\"fee_cents\":5,\"fee_source\":\"guess\"}]')")" "check constraint"
has "a fee without its source (first time for an order)" "$(q "delete from order_costs where false"; as $O "insert into order_costs (order_id, fee_cents) values ('$O2', 5) on conflict (order_id) do update set fee_source = null")" "check constraint"
has "a row with neither part" "$(as $O "update order_costs set fee_cents = null, fee_source = null, postage_cents = null, postage_source = null where order_id = '$O2'")" "check constraint"
has "something that is not a list" "$(as $O "select set_order_costs('{\"order_id\":\"$O1\"}')")" "as a list"
has "an order without a valid id" "$(as $O "select set_order_costs('[{\"order_id\":\"abc\",\"fee_cents\":5,\"fee_source\":\"manual\"}]')")" "no valid id"
has "more than 500 at a time" "$(as $O "select set_order_costs((select jsonb_agg(jsonb_build_object('order_id', '$O1', 'fee_cents', 1, 'fee_source', 'manual')) from generate_series(1, 501)))")" "At most 500"
has "moving costs to another order" "$(q "insert into orders (id, channel, order_number, status, total) values ('00000000-0000-4000-8000-0000000009b3','manual','SYN-3003','paid',5)"; as $O "update order_costs set order_id = '00000000-0000-4000-8000-0000000009b3' where order_id = '$O1'")" "cannot be moved"
has "deleting (the owner included): no delete permission at all" "$(as $O "delete from order_costs")" "permission denied"
has "  and the guard refuses it even for the table owner" "$(q "delete from order_costs")" "stay on the record"
ok  "  (unchanged: two orders)" "$(q "select count(*) from order_costs")" "2"

echo " 5. audit"
ok  "every change is in audit_log" "$(q "select count(*) >= 4 from audit_log where table_name = 'order_costs'")" "t"

echo " 6. rollback"
ok  "the rollback stops while costs are saved" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "order(s) are saved"
ok  "with written authorization in the session it removes everything" "$(psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_order_costs = 'yes, delete the order costs';" -f "$ROLLBACK" >"$OUTF" 2>&1; echo $?)" "0"
ok  "  gone, and the orders are untouched" "$(q "select (to_regclass('public.order_costs') is null and to_regprocedure('public.set_order_costs(jsonb)') is null)||'|'||(select count(*) from orders where order_number like 'SYN-300%')")" "true|3"
ok  "  running it again is harmless" "$(run "$ROLLBACK")" "0"

echo " 7. a table of the same name that is not ours"
q "create table public.order_costs (id int)" >/dev/null
ok  "the install refuses and changes nothing" "$(run "$INSTALL")" "3"
has "  and says why" "$(cat "$OUTF")" "was not created by this file"
ok  "the rollback refuses to touch it too" "$(run "$ROLLBACK")" "3"
q "drop table public.order_costs" >/dev/null
ok  "  and the install works again afterwards" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "order costs: $pass passed, $fail failed"
[ "$fail" = 0 ]
