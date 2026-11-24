#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-24). Never point this at Supabase.
# Tests drafts/54 (which batch went into which order: recorded by scanning the batch
# sticker when packing; the count adds up; a wrong scan is voided, never deleted;
# the list of orders that got a batch) and drafts/55 (rollback) on a throwaway copy,
# as the owner, an administrator, active staff, a deactivated account and a visitor.
# All rows are made up.
# Usage: order_batches_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_order_batches_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/54_DRAFT_order_batches.sql"; ROLLBACK="$DIR/drafts/55_DRAFT_rollback_order_batches.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-240)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-000000000aa1; A=00000000-0000-4000-8000-000000000aa2; E=00000000-0000-4000-8000-000000000aa3; X=00000000-0000-4000-8000-000000000aa4
O1=00000000-0000-4000-8000-000000000ab1; O2=00000000-0000-4000-8000-000000000ab2; O3=00000000-0000-4000-8000-000000000ab3
P1=00000000-0000-4000-8000-000000000ac1; P2=00000000-0000-4000-8000-000000000ac2
L1=00000000-0000-4000-8000-000000000ad1; L2=00000000-0000-4000-8000-000000000ad2; L3=00000000-0000-4000-8000-000000000ad3
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
SEED=$(q "delete from profiles where id in ('$O','$A','$E','$X');
   insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'700000001'),
     ('$A','admin@example.test','administrator',true,'700000002'), ('$E','staff@example.test','employee',true,'700000003'), ('$X','gone@example.test','employee',false,'700000004');
   insert into orders (id, channel, order_number, status, total) values ('$O1','manual','SYN-5001','paid',10), ('$O2','manual','SYN-5002','paid',20), ('$O3','manual','SYN-5003','paid',30);
   insert into products (id, name, sku) values ('$P1','SYNTHETIC Sea lotion','SYN-OB-1'), ('$P2','SYNTHETIC Honey balm','SYN-OB-2');
   insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) values
     ('$L1','$P1','LOT-A',40,40), ('$L2','$P2','SAME-NO',10,10), ('$L3','$P1','SAME-NO',10,10);")
echo "$SEED" | grep -qi error && { echo "seed failed: $SEED"; exit 2; }
echo "Batch on each order (throwaway database $DB)"

echo " 0. refuses what it did not create"
q "create table public.order_batches (id int)" >/dev/null
ok  "an order_batches table that is not this draft's: refused" "$(run "$INSTALL")" "3"
has "  and says why" "$(cat "$OUTF")" "was not created by this file. Nothing was changed"
q "drop table public.order_batches; create function public.void_order_batch(uuid, text) returns int language sql as 'select 1'" >/dev/null
ok  "a function with this draft's name that is not its own: refused" "$(run "$INSTALL")/$(q "select to_regclass('public.order_batches') is null")" "3/t"
q "drop function public.void_order_batch(uuid, text)" >/dev/null

echo " 1. install"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"
ok  "  the table is empty, marked and audited" "$(q "select count(*) from order_batches")/$(q "select obj_description('public.order_batches'::regclass, 'pg_class') like 'Health Endeavors drafts/54%'")/$(q "select count(*) from pg_trigger where tgname = 'order_batches_audit'")" "0/t/1"

echo " 2. recording the batch of a bottle"
R=$(as $E "select record_order_batch('$O1', '  lot-a ')")
ok  "staff record one bottle; here staff may not read the batches in stock, so it is saved unchecked" "$(echo "$R" | python3 -c 'import sys,json; r=json.load(sys.stdin); print(r["matched"], r["quantity"], r["lot_number"])')" "unchecked 1 lot-a"
ok  "  stored as scanned, with who and when, not linked yet" "$(q "select (lot_id is null)||'|'||(recorded_by = '$E')||'|'||source||'|'||quantity from order_batches")" "true|true|scan|1"
ok  "the same batch on the same order again adds to the count (still one row)" "$(as $E "select (record_order_batch('$O1', 'LOT-A', 2))->>'quantity'")|$(q "select count(*) from order_batches")" "3|1"
RA=$(as $A "select record_order_batch('$O1', 'Lot-A')")
ok  "an administrator, who can see the batch in stock whatever the capitals, adds a bottle and the row gets its link" "$(echo "$RA" | python3 -c 'import sys,json; r=json.load(sys.stdin); print(r["matched"], r["quantity"])')|$(q "select (lot_id = '$L1')||'|'||(product_id = '$P1')||'|'||(recorded_by = '$E') from order_batches where order_id = '$O1'")" "one 4|true|true|true"
ok  "the same batch on another order is its own row" "$(as $A "select (record_order_batch('$O2', 'LOT-A', 1, 'typed'))->>'quantity'")|$(q "select source from order_batches where order_id = '$O2'")" "1|typed"
R2=$(as $O "select record_order_batch('$O2', 'NOT-IN-STOCK')")
ok  "a batch number not in stock is still kept, and the answer says so" "$(echo "$R2" | python3 -c 'import sys,json; r=json.load(sys.stdin); print(r["matched"], r["product_id"])')|$(q "select lot_id is null from order_batches where lot_number = 'NOT-IN-STOCK'")" "none None|t"
R3=$(as $O "select record_order_batch('$O3', 'SAME-NO')")
ok  "a number that two products share is kept but linked to neither" "$(echo "$R3" | python3 -c 'import sys,json; r=json.load(sys.stdin); print(r["matched"], r["product_id"])')" "several None"
has "a deactivated account cannot" "$(as $X "select record_order_batch('$O1', 'LOT-A')")" "Only an active team member"
has "a visitor cannot run it" "$(as anon "select record_order_batch('$O1', 'LOT-A')")" "permission denied"
has "an unknown order is refused" "$(as $E "select record_order_batch('00000000-0000-4000-8000-000000000000', 'LOT-A')")" "does not exist"
has "an empty batch number is refused" "$(as $E "select record_order_batch('$O1', '   ')")" "not a batch number"
has "a batch number longer than a sticker holds is refused" "$(as $E "select record_order_batch('$O1', repeat('X', 25))")" "not a batch number"
has "zero bottles is refused" "$(as $E "select record_order_batch('$O1', 'LOT-A', 0)")" "between 1 and 10000"
has "a count that would pass 10000 is refused" "$(as $E "select record_order_batch('$O1', 'LOT-A', 9999)")" "more than 10000"
ok  "  (nothing changed by the refusals)" "$(q "select count(*)||'/'||sum(quantity) from order_batches")" "4/7"

echo " 3. who can read; the list of orders that got a batch"
ok  "the owner, an administrator and staff read" "$(as $O "select count(*) from order_batches")/$(as $A "select count(*) from order_batches")/$(as $E "select count(*) from order_batches")" "4/4/4"
ok  "a deactivated account reads nothing" "$(as $X "select count(*) from order_batches")" "0"
has "a visitor reads nothing" "$(as anon "select count(*) from order_batches")" "permission denied"
ok  "every order that got batch LOT-A, with how many bottles" "$(as $E "select string_agg(o.order_number||':'||b.quantity, ',' order by o.order_number) from order_batches b join orders o on o.id = b.order_id where lower(b.lot_number) = lower('lot-a') and b.voided_at is null")" "SYN-5001:4,SYN-5002:1"

echo " 4. nothing is deleted; a wrong scan is voided once, by the owner or an administrator"
WRONG=$(q "select id from order_batches where lot_number = 'NOT-IN-STOCK'")
has "staff cannot void" "$(as $E "select void_order_batch('$WRONG', 'SYNTHETIC wrong bottle')")" "Only the owner and administrators"
has "staff cannot void by changing the row either" "$(as $E "update order_batches set voided_at = now(), voided_by = '$E', void_reason = 'SYNTHETIC' where id = '$WRONG'")" "Only the owner and administrators"
has "a reason is needed" "$(as $A "select void_order_batch('$WRONG', ' ')")" "Say why"
ok  "an administrator voids it, with who, when and why" "$(as $A "select (void_order_batch('$WRONG', 'SYNTHETIC scanned the wrong bottle'))->>'already'")|$(q "select (voided_by = '$A')||'|'||(voided_at is not null)||'|'||void_reason from order_batches where id = '$WRONG'")" "false|true|true|SYNTHETIC scanned the wrong bottle"
ok  "voiding twice changes nothing" "$(as $O "select (void_order_batch('$WRONG', 'SYNTHETIC again'))->>'already'")|$(q "select void_reason from order_batches where id = '$WRONG'")" "true|SYNTHETIC scanned the wrong bottle"
has "a voided row is final" "$(as $O "update order_batches set quantity = 5 where id = '$WRONG'")" "final"
ok  "the same batch can be recorded again on that order after the void (a new row)" "$(as $E "select (record_order_batch('$O2', 'NOT-IN-STOCK'))->>'quantity'")|$(q "select count(*) from order_batches where lot_number = 'NOT-IN-STOCK'")" "1|2"
has "deleting a row, even the owner" "$(as $O "delete from order_batches where order_id = '$O1'")" "stays on the record\|permission denied"
has "moving a row to another order" "$(as $O "update order_batches set order_id = '$O3' where order_id = '$O1'")" "cannot be changed"
has "changing the batch number" "$(as $O "update order_batches set lot_number = 'OTHER' where order_id = '$O1'")" "cannot be changed"
has "pointing a row at another batch" "$(as $O "update order_batches set lot_id = '$L2' where order_id = '$O1'")" "cannot be changed"
has "lowering the count" "$(as $O "update order_batches set quantity = 1 where order_id = '$O1'")" "only goes up"
ok  "every change is in the audit log" "$(q "select count(*) > 0 from audit_log where table_name = 'order_batches'")" "t"

echo " 5. the links never hold stock records back"
ok  "a batch in stock can still be removed; the row keeps the number it was scanned with" "$(q "delete from inventory_lots where id = '$L1' returning 1")|$(q "select string_agg(lot_number||':'||(lot_id is null), ',' order by order_id) from order_batches where lower(lot_number) = 'lot-a'")" "1|lot-a:true,LOT-A:true"

echo " 6. two people scanning the same bottle type for the same order at the same moment"
( as $E "select record_order_batch('$O3', 'RACE-1')" >/dev/null ) &
( as $O "select record_order_batch('$O3', 'RACE-1')" >/dev/null ) &
wait
ok  "  one row, two bottles" "$(q "select count(*)||'/'||sum(quantity) from order_batches where lot_number = 'RACE-1'")" "1/2"

echo " 7. rollback"
ok  "refuses while batches are recorded" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "recorded batch row(s) exist"
ok  "  nothing was removed" "$(q "select to_regclass('public.order_batches') is not null")" "t"
ok  "with written authorization in the session it removes everything" "$(psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_order_batches = 'yes, delete the recorded batches';" -f "$ROLLBACK" >"$OUTF" 2>&1; echo $?)" "0"
ok  "  gone: table and functions" "$(q "select (to_regclass('public.order_batches') is null) and to_regprocedure('public.record_order_batch(uuid,text,integer,text)') is null and to_regprocedure('public.void_order_batch(uuid,text)') is null")" "t"
ok  "  orders, batches in stock and products untouched" "$(q "select (select count(*) from orders where order_number like 'SYN-50%')||'/'||(select count(*) from inventory_lots where id in ('$L2','$L3'))||'/'||(select count(*) from products where id in ('$P1','$P2'))")" "3/2/2"
ok  "rollback is safe to run twice" "$(run "$ROLLBACK")" "0"
ok  "install again after rollback" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
