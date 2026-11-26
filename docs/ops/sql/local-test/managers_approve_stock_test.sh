#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-25). Never point this at Supabase.
# Tests drafts/66 (OPTION A: a manager decides deliveries and returns someone else
# recorded, and changes stock only that way) and drafts/67 (its rollback) on a
# throwaway copy, on top of drafts/40. Acting as the owner, an administrator, two
# employees, a manager, a switched-off manager and a visitor. All rows are synthetic.
# Usage: managers_approve_stock_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_managers_approve_stock_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
D40="$DIR/drafts/40_DRAFT_partial_receiving_returns.sql"
INSTALL="$DIR/drafts/66_DRAFT_managers_approve_stock.sql"; ROLLBACK="$DIR/drafts/67_DRAFT_rollback_managers_approve_stock.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-000000000aa1; A=00000000-0000-4000-8000-000000000aa2; E=00000000-0000-4000-8000-000000000aa3
E2=00000000-0000-4000-8000-000000000aa4; M=00000000-0000-4000-8000-000000000aa5; MX=00000000-0000-4000-8000-000000000aa6
P=00000000-0000-4000-8000-000000000ab1; SUP=00000000-0000-4000-8000-000000000ac1
PO=00000000-0000-4000-8000-000000000ad1; IT=00000000-0000-4000-8000-000000000ad2
ORDR=00000000-0000-4000-8000-000000000ae1; OI=00000000-0000-4000-8000-000000000ae2
K() { printf '00000000-0000-4000-8000-%012d' "$1"; }
FOUR="'approve_receiving_record','reject_receiving_record','decide_supplier_return','decide_customer_return'"
ALL40="'stock_is_owner','stock_may_decide','stock_can_decide','po_item_outstanding','stock_movements_guard','receiving_records_guard','receiving_record_lines_guard','receiving_records_apply','receiving_surplus_apply','supplier_returns_guard','supplier_returns_apply','customer_return_inspections_guard','customer_return_inspections_apply','stock_corrections_guard','stock_corrections_apply','submit_receiving_record','approve_receiving_record','reject_receiving_record','cancel_receiving_record','decide_receiving_surplus','submit_supplier_return','decide_supplier_return','record_customer_return','decide_customer_return','correct_stock_movement'"
raised() { q "select coalesce(string_agg(proname, ',' order by proname), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and prosecdef and proname in ($ALL40)"; }
seed() {
  q "delete from profiles where id in ('$O','$A','$E','$E2','$M','$MX');
     insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'910000001'),
       ('$A','admin@example.test','administrator',true,'910000002'), ('$E','staff@example.test','employee',true,'910000003'),
       ('$E2','staff2@example.test','employee',true,'910000004'), ('$M','manager@example.test','manager',true,'910000005'),
       ('$MX','gone-manager@example.test','manager',false,'910000006');
     insert into products (id, name, sku) values ('$P','SYNTHETIC Honey Milk 8 oz','SYN-MGR-A');
     insert into inventory (product_id, available, damaged) values ('$P', 5, 0);
     insert into suppliers (id, name, supplier_type, is_active) values ('$SUP','SYN Lotion Lab','lab',true);
     insert into purchase_orders (id, po_number, supplier_id, status, payment_status) values ('$PO','SYN-PO-120','$SUP','ordered','unpaid');
     insert into purchase_order_items (id, purchase_order_id, product_id, sku, description, quantity, unit_cost, quantity_received) values ('$IT','$PO','$P','SYN-MGR-A','Honey Milk 8 oz',20,4,0);
     insert into orders (id, channel, status, order_number) values ('$ORDR','synthetic','paid','SYN-1105');
     insert into order_items (id, order_id, sku, quantity) values ('$OI','$ORDR','SYN-MGR-A',5);
     -- test-only: staff may see this purchase order (as in partial_receiving_test.sh)
     create policy test_only_staff_sees_po on purchase_orders for select to authenticated using (id = '$PO');
     create policy test_only_staff_sees_po_items on purchase_order_items for select to authenticated using (purchase_order_id = '$PO');" >/dev/null; }
fresh() { psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
          psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
          seed; }
stock() { q "select available||'/'||damaged from inventory where product_id = '$P'"; }
line()  { q "select quantity::int||'/'||quantity_received::int from purchase_order_items where id = '$IT'"; }
submit() { as "$1" "select public.submit_receiving_record('$(K $2)', '$PO', '[{\"po_item_id\":\"$IT\",\"good\":$3}]')"; }
rid()   { q "select id from receiving_records where request_key = '$(K $1)'"; }

fresh
echo "Managers decide deliveries and returns (option A, drafts/66) on top of drafts/40 (throwaway database $DB)"
ok  "drafts/40 installs" "$(run "$D40")" "0"
ok  "  before drafts/66 nothing runs with raised rights" "$(raised)" ""
R0=$(submit $E 1 3; rid 1)
has "  before drafts/66 a manager cannot approve" "$(as $M "select public.approve_receiving_record('$(rid 1)')")" "Only the owner or an administrator"
ok  "  and stock is unchanged" "$(stock) $(line)" "5/0 20/0"
ok  "drafts/66 installs" "$(run "$INSTALL")" "0"
ok  "  a second install changes nothing" "$(run "$INSTALL")" "0"
ok  "  exactly the four decision actions run with raised rights" "$(raised)" "approve_receiving_record,decide_customer_return,decide_supplier_return,reject_receiving_record"
ok  "  no new table, no stock change" "$(q "select count(*) from receiving_records") $(stock)" "1 5/0"

echo " 1. a manager decides a delivery someone else recorded"
has "a manager approves the employee's delivery of 3" "$(as $M "select public.approve_receiving_record('$(rid 1)')")" '"already_decided": false'
ok  "  stock 5 -> 8; the order line shows 3 received" "$(stock) $(line)" "8/0 20/3"
ok  "  the stock movement names the employee who asked and the manager who approved" "$(q "select (requested_by = '$E')::text||'/'||(approved_by = '$M')::text from stock_movements order by id desc limit 1")" "true/true"
ok  "  the record names the manager as the one who decided" "$(q "select status||'/'||(decided_by = '$M')::text from receiving_records where id = '$(rid 1)'")" "approved/true"
ok  "  and it is also in the existing stock history (inventory_adjustments)" "$(q "select count(*) from inventory_adjustments where product_id = '$P' and change_amount = 3")" "1"
has "approving again is safe: already decided" "$(as $M "select public.approve_receiving_record('$(rid 1)')")" '"already_decided": true'
submit $E 2 4 >/dev/null
has "a manager rejects a delivery record, with a reason" "$(as $M "select public.reject_receiving_record('$(rid 2)', 'Counted the wrong box')")" '"status": "rejected"\|"ok": true'
ok  "  stock unchanged by a rejection" "$(stock) $(line)" "8/0 20/3"

echo " 2. never their own record; a second person decides it"
has "a manager records a delivery like staff" "$(submit $M 3 2)" '"status": "submitted"'
has "a manager cannot approve their own delivery" "$(as $M "select public.approve_receiving_record('$(rid 3)')")" "Only the owner or an administrator"
has "  nor reject it" "$(as $M "select public.reject_receiving_record('$(rid 3)', 'Changed my mind here')")" "Only the owner or an administrator"
has "  nor by changing the record directly" "$(as $M "update receiving_records set status = 'approved' where id = '$(rid 3)'")" "Only the owner or an administrator\|^$"
ok  "  still submitted, stock unchanged" "$(q "select status from receiving_records where id = '$(rid 3)'") $(stock)" "submitted 8/0"
has "an administrator approves the manager's delivery" "$(as $A "select public.approve_receiving_record('$(rid 3)')")" '"already_decided": false'
ok  "  stock 8 -> 10" "$(stock) $(line)" "10/0 20/5"

echo " 3. who is still refused"
submit $E 4 1 >/dev/null
has "a switched-off manager cannot approve" "$(as $MX "select public.approve_receiving_record('$(rid 4)')")" "Only the owner or an administrator"
has "an employee cannot approve" "$(as $E2 "select public.approve_receiving_record('$(rid 4)')")" "Only the owner or an administrator"
has "a visitor cannot run the action at all" "$(as anon "select public.approve_receiving_record('$(rid 4)')")" "permission denied"
ok  "  still submitted, stock unchanged" "$(q "select status from receiving_records where id = '$(rid 4)'") $(stock)" "submitted 10/0"

echo " 4. a manager changes stock ONLY by deciding: everything else stays closed"
as $M "update inventory set available = 999 where product_id = '$P'" >/dev/null
ok  "a manager cannot change a stock figure directly" "$(stock)" "10/0"
as $M "update purchase_order_items set quantity_received = 20 where id = '$IT'" >/dev/null
ok  "  nor the order line" "$(line)" "20/5"
has "  nor write the stock history directly" "$(as $M "insert into inventory_adjustments (product_id, change_amount, reason) values ('$P', 50, 'test')")" "row-level security\|permission denied\|violates"
ok  "  nor read the stock history" "$(as $M "select count(*) from stock_movements")" "0"
as $M "update receiving_records set status = 'approved' where id = '$(rid 4)'" >/dev/null
ok  "  nor approve someone else's record by changing it directly (only through the action)" "$(q "select status from receiving_records where id = '$(rid 4)'") $(stock)" "submitted 10/0"
M1=$(q "select max(id) from stock_movements")
has "  nor correct a stock movement" "$(as $M "select public.correct_stock_movement('$(K 50)', $M1, 'Counted twice here')")" "Only the owner or an administrator"
as $E "select public.submit_receiving_record('$(K 5)', '$PO', '[{\"po_item_id\":\"$IT\",\"good\":15,\"surplus\":2}]')" >/dev/null
as $O "select public.approve_receiving_record('$(rid 5)')" >/dev/null
L5=$(q "select l.id from receiving_record_lines l join receiving_records r on r.id = l.record_id where r.request_key = '$(K 5)'")
has "  nor decide about a surplus" "$(as $M "select public.decide_receiving_surplus('$L5', 'kept')")" "Only the owner or an administrator"
ok  "  stock is what the owner approved: 10 + 15" "$(stock) $(line)" "25/0 20/20"

echo " 5. returns to the supplier"
has "an employee submits 2 back, no replacement" "$(as $E "select public.submit_supplier_return('$(K 20)', '$IT', 2, 'available', 'Wrong scent on the labels', false)")" '"status": "submitted"'
has "a manager approves it" "$(as $M "select public.decide_supplier_return((select id from supplier_returns where request_key = '$(K 20)'), 'approved')")" '"status": "approved"\|"ok": true'
ok  "  Available 25 -> 23" "$(stock)" "23/0"
as $M "select public.submit_supplier_return('$(K 21)', '$IT', 1, 'available', 'Leaking pump', false)" >/dev/null
has "a manager cannot decide their own return to the supplier" "$(as $M "select public.decide_supplier_return((select id from supplier_returns where request_key = '$(K 21)'), 'approved')")" "Only the owner or an administrator"
ok  "  stock unchanged" "$(stock)" "23/0"

echo " 6. customer returns"
has "an employee records 3 of the 5 sold coming back" "$(as $E "select public.record_customer_return('$(K 30)', '$OI', 3)")" '"status": "awaiting_inspection"'
C1=$(q "select id from customer_return_inspections where request_key = '$(K 30)'")
has "a manager decides: 3 unopened back to Available" "$(as $M "select public.decide_customer_return('$C1', 3, 0, 0, false, false)")" '"status": "decided"\|"ok": true'
ok  "  Available 23 -> 26" "$(stock)" "26/0"
as $M "select public.record_customer_return('$(K 31)', '$OI', 1)" >/dev/null
C2=$(q "select id from customer_return_inspections where request_key = '$(K 31)'")
has "a manager cannot decide a customer return they recorded" "$(as $M "select public.decide_customer_return('$C2', 1, 0, 0, false, false)")" "Only the owner or an administrator"
has "opened skincare still cannot be restocked, by a manager either" "$(as $A "select public.decide_customer_return('$C2', 1, 0, 0, true, false)")" "cannot be restocked"

echo " 7. reading"
ok  "a manager sees every delivery record (to decide them)" "$(as $M "select count(*) from receiving_records")" "$(q "select count(*) from receiving_records")"
ok  "  and every return to the supplier" "$(as $M "select count(*) from supplier_returns")" "$(q "select count(*) from supplier_returns")"
ok  "another employee still sees only their own (none)" "$(as $E2 "select count(*) from receiving_records")/$(as $E2 "select count(*) from supplier_returns")" "0/0"

echo " rollback (drafts/67)"
ok  "rollback succeeds" "$(run "$ROLLBACK")" "0"
ok  "  nothing runs with raised rights again" "$(raised)" ""
as $E "select public.record_customer_return('$(K 32)', '$OI', 1)" >/dev/null
C3=$(q "select id from customer_return_inspections where request_key = '$(K 32)'")
has "  a manager is refused again (a customer return an employee recorded)" "$(as $M "select public.decide_customer_return('$C3', 1, 0, 0, false, false)")" "Only the owner or an administrator"
ok  "  and sees only their own records again" "$(as $M "select count(*) from receiving_records")" "1"
ok  "  decisions a manager made stay on the record, with their name" "$(q "select count(*) from receiving_records where decided_by = '$M'")" "2"
ok  "  no stock figure changed" "$(stock)" "26/0"
has "  the owner still decides it" "$(as $O "select public.decide_customer_return('$C3', 1, 0, 0, false, false)")" '"status": "decided"\|"ok": true'
ok  "  a second rollback is harmless" "$(run "$ROLLBACK")" "0"
ok  "  install works again afterwards" "$(run "$INSTALL")" "0"
ok  "  and the four actions are raised again, nothing else" "$(raised)" "approve_receiving_record,decide_customer_return,decide_supplier_return,reject_receiving_record"

fresh
ok  "on a database without drafts/40, drafts/66 stops and changes nothing" "$(run "$INSTALL")" "3"
has "  and says what is missing" "$(cat "$OUTF")" "drafts/40"
ok  "  the rollback also stops there, changing nothing" "$(run "$ROLLBACK")" "3"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
