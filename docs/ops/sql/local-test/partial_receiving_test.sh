#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-22). Never point this at Supabase.
# Tests drafts/40 (partial receiving and returns, the owner's rules of Nov 22 for
# D-ops-5) and drafts/41 (rollback) on a throwaway copy, as the owner, an
# administrator, staff and a visitor. All rows are synthetic.
# The owner's worked example: a purchase order for 20 units received in parts
# (8, then 5 with 2 rejected, then 4 good + 1 damaged, then 2 with 3 surplus),
# returns to the supplier with and without a replacement, customer returns
# through inspection, and a correction; plus duplicate submissions, retries,
# simultaneous approvals, over-receiving, over-returning and the history.
# Usage: partial_receiving_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_partial_receiving_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/40_DRAFT_partial_receiving_returns.sql"; ROLLBACK="$DIR/drafts/41_DRAFT_rollback_partial_receiving_returns.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000009a1; A=00000000-0000-4000-8000-0000000009a2; E=00000000-0000-4000-8000-0000000009a3
P=00000000-0000-4000-8000-0000000009b1; SUP=00000000-0000-4000-8000-0000000009c1
PO=00000000-0000-4000-8000-0000000009d1; IT=00000000-0000-4000-8000-0000000009d2
PO2=00000000-0000-4000-8000-0000000009d3; IT2=00000000-0000-4000-8000-0000000009d4
ORDR=00000000-0000-4000-8000-0000000009e1; OI=00000000-0000-4000-8000-0000000009e2
K() { printf '00000000-0000-4000-8000-%012d' "$1"; }
seed() {
  q "delete from profiles where id in ('$O','$A','$E');
     insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'900000001'),
       ('$A','admin@example.test','administrator',true,'900000002'), ('$E','staff@example.test','employee',true,'900000003');
     insert into products (id, name, sku) values ('$P','SYNTHETIC Honey Milk 8 oz','SYN-RCV-A');
     insert into inventory (product_id, available, damaged) values ('$P', 5, 0);
     insert into suppliers (id, name, supplier_type, is_active) values ('$SUP','SYN Lotion Lab','lab',true);
     insert into purchase_orders (id, po_number, supplier_id, status, payment_status) values ('$PO','SYN-PO-020','$SUP','ordered','unpaid'), ('$PO2','SYN-PO-021','$SUP','ordered','unpaid');
     insert into purchase_order_items (id, purchase_order_id, product_id, sku, description, quantity, unit_cost, quantity_received) values ('$IT','$PO','$P','SYN-RCV-A','Honey Milk 8 oz',20,4,0), ('$IT2','$PO2','$P','SYN-RCV-A','Honey Milk 8 oz',10,4,0);
     insert into orders (id, channel, status, order_number) values ('$ORDR','synthetic','paid','SYN-1005');
     insert into order_items (id, order_id, sku, quantity) values ('$OI','$ORDR','SYN-RCV-A',5);
     -- test-only: staff may see these two purchase orders (today staff see none)
     create policy test_only_staff_sees_po on purchase_orders for select to authenticated using (id in ('$PO','$PO2'));
     create policy test_only_staff_sees_po_items on purchase_order_items for select to authenticated using (purchase_order_id in ('$PO','$PO2'));" >/dev/null; }
fresh() { psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
          psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
          seed; }
stock() { q "select available||'/'||damaged from inventory where product_id = '$P'"; }
line()  { q "select quantity::int||'/'||quantity_received::int||'/'||(quantity - quantity_received)::int from purchase_order_items where id = '$1'"; }
submit() { as $E "select public.submit_receiving_record('$(K $1)', '$2', '$3')"; }
rid()   { q "select id from receiving_records where request_key = '$(K $1)'"; }

fresh
echo "Partial receiving and returns (throwaway database $DB)"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  a second install changes nothing" "$(run "$INSTALL")" "0"
has "a visitor sees nothing" "$(as anon "select count(*) from stock_movements")" "permission denied"
ok  "start: 5 available, 0 damaged; order line 20 ordered / 0 received / 20 outstanding" "$(stock) $(line $IT)" "5/0 20/0/20"

echo " 1. first delivery: 8 arrive (staff submit, the owner approves)"
has "staff submit 8 good" "$(submit 1 $PO "[{\"po_item_id\":\"$IT\",\"good\":8}]")" '"status": "submitted"'
ok  "  nothing changes in stock before the owner approves" "$(stock) $(line $IT)" "5/0 20/0/20"
has "  submitted again (double click, lost reply): nothing more is recorded" "$(submit 1 $PO "[{\"po_item_id\":\"$IT\",\"good\":8}]")" '"duplicate": true'
ok  "  one record, one line" "$(q "select count(*) from receiving_records")/$(q "select count(*) from receiving_record_lines")" "1/1"
R1=$(rid 1)
has "staff cannot approve" "$(as $E "select public.approve_receiving_record('$R1')")" "Only the owner"
has "an administrator cannot approve either" "$(as $A "select public.approve_receiving_record('$R1')")" "Only the owner"
has "  nor by changing the record directly" "$(as $A "update receiving_records set status = 'approved' where id = '$R1'")" "Only the owner\|row-level security\|^$"
ok  "  still submitted, stock unchanged" "$(q "select status from receiving_records where id = '$R1'") $(stock)" "submitted 5/0"
has "the owner approves" "$(as $O "select public.approve_receiving_record('$R1')")" '"already_decided": false'
ok  "  8 received, 12 outstanding; Available 5 -> 13" "$(stock) $(line $IT)" "13/0 20/8/12"
ok  "  the movement names who asked, who approved and why" "$(q "select bucket||'/'||change||'/'||reason||'/'||(requested_by = '$E')::text||'/'||(approved_by = '$O')::text from stock_movements order by id desc limit 1")" "available/8/Delivery received (good)/true/true"
ok  "  and is also in the existing stock history (inventory_adjustments)" "$(q "select count(*) from inventory_adjustments where product_id = '$P' and change_amount = 8")" "1"
has "approving again is safe: already decided" "$(as $O "select public.approve_receiving_record('$R1')")" '"already_decided": true'
ok  "  stock still 13" "$(stock)" "13/0"
has "what was submitted cannot be changed afterwards" "$(as $O "update receiving_record_lines set good = 9 where record_id = '$R1'")" "cannot be changed"
has "a receiving record cannot be deleted" "$(as $O "delete from receiving_records where id = '$R1'")" "stays on the record\|permission denied"

echo " 2. over-receiving is refused"
has "13 good when 12 are outstanding: refused at submission" "$(submit 2 $PO "[{\"po_item_id\":\"$IT\",\"good\":13}]")" "Only 12 unit(s) are still to come"
ok  "  nothing was recorded" "$(q "select count(*) from receiving_records")" "1"

echo " 3. a delivery with rejected units: they stay outstanding"
has "a rejection without a reason is refused" "$(submit 3 $PO "[{\"po_item_id\":\"$IT\",\"good\":5,\"rejected\":2}]")" "receiving_record_lines_reject_reason"
submit 4 $PO "[{\"po_item_id\":\"$IT\",\"good\":5,\"rejected\":2,\"rejected_reason\":\"Crushed boxes, refused at the door\"}]" >/dev/null
as $O "select public.approve_receiving_record('$(rid 4)')" >/dev/null
ok  "  5 received; the 2 rejected are logged separately and still outstanding" "$(stock) $(line $IT) $(q "select rejected||'/'||rejected_reason from receiving_record_lines where record_id = '$(rid 4)'")" "18/0 20/13/7 2/Crushed boxes, refused at the door"

echo " 4. damaged goods we keep go to Damaged"
submit 5 $PO "[{\"po_item_id\":\"$IT\",\"good\":4,\"damaged\":1}]" >/dev/null
as $O "select public.approve_receiving_record('$(rid 5)')" >/dev/null
ok  "  4 Available, 1 Damaged; 5 more received" "$(stock) $(line $IT)" "22/1 20/18/2"

echo " 5. surplus: logged for the owner, not in stock until the owner keeps it"
has "surplus is only what arrives beyond the outstanding quantity" "$(submit 6 $PO "[{\"po_item_id\":\"$IT\",\"good\":1,\"surplus\":3}]")" "Surplus is what arrived beyond"
submit 7 $PO "[{\"po_item_id\":\"$IT\",\"good\":2,\"surplus\":3}]" >/dev/null
as $O "select public.approve_receiving_record('$(rid 7)')" >/dev/null
ok  "  the last 2 complete the order; it is now Received; the 3 surplus wait" "$(stock) $(line $IT) $(q "select status from purchase_orders where id = '$PO'") $(q "select surplus||'/'||surplus_status from receiving_record_lines where record_id = '$(rid 7)'")" "24/1 20/20/0 received 3/waiting"
L7=$(q "select id from receiving_record_lines where record_id = '$(rid 7)'")
has "staff cannot decide about a surplus" "$(as $E "select public.decide_receiving_surplus('$L7', 'kept')")" "Only the owner"
has "the owner keeps it" "$(as $O "select public.decide_receiving_surplus('$L7', 'kept', 'Lab sent 3 extra at no charge')")" '"surplus_status": "kept"'
ok  "  3 more Available; the order line still shows 20 of 20" "$(stock) $(line $IT)" "27/1 20/20/0"
has "  deciding again changes nothing" "$(as $O "select public.decide_receiving_surplus('$L7', 'returned')")" '"already_decided": true'

echo " 6. simultaneous approvals cannot receive the same units twice"
submit 8 $PO2 "[{\"po_item_id\":\"$IT2\",\"good\":7}]" >/dev/null; submit 9 $PO2 "[{\"po_item_id\":\"$IT2\",\"good\":7}]" >/dev/null
OUT=$(mktemp)
( as $O "select public.approve_receiving_record('$(rid 8)')" >>"$OUT" 2>&1 ) & ( as $O "select public.approve_receiving_record('$(rid 9)')" >>"$OUT" 2>&1 ) &
wait
ok  "two deliveries of 7 on a line of 10, approved at the same moment: one goes through, the other is refused" "$(grep -c '"already_decided": false' "$OUT")/$(grep -c 'another delivery was approved meanwhile' "$OUT")" "1/1"
ok  "  the line shows 7 received, never 14" "$(line $IT2)" "10/7/3"
submit 10 $PO2 "[{\"po_item_id\":\"$IT2\",\"good\":3}]" >/dev/null
: >"$OUT"; for n in $(seq 1 10); do ( as $O "select public.approve_receiving_record('$(rid 10)')" >>"$OUT" 2>&1 ) & done; wait
ok  "the same delivery approved 10 times at once: one approval, one movement" "$(grep -c '"already_decided": false' "$OUT")/$(q "select count(*) from stock_movements where source_id = '$(rid 10)'")" "1/1"
ok  "  10 of 10 received" "$(line $IT2)" "10/10/0"
rm -f "$OUT"
BEFORE6=$(stock)

echo " 7. returns to the supplier"
has "staff submit 3 back (wrong scent), no replacement" "$(as $E "select public.submit_supplier_return('$(K 20)', '$IT', 3, 'available', 'Wrong scent on the labels', false)")" '"status": "submitted"'
ok  "  stock unchanged until the owner approves" "$(stock)" "$BEFORE6"
has "an administrator cannot approve it" "$(as $A "select public.decide_supplier_return((select id from supplier_returns where request_key = '$(K 20)'), 'approved')")" "Only the owner"
as $O "select public.decide_supplier_return((select id from supplier_returns where request_key = '$(K 20)'), 'approved')" >/dev/null
ok  "  approved: Available -3; the order line still 20 received (no replacement expected)" "$(stock) $(line $IT)" "34/1 20/20/0"
as $E "select public.submit_supplier_return('$(K 21)', '$IT', 18, 'available', 'Testing the limit', false)" >/dev/null
has "sending back more than was received and kept is refused" "$(as $O "select public.decide_supplier_return((select id from supplier_returns where request_key = '$(K 21)'), 'approved')")" "Only 17 unit(s) received on that line can still go back"
as $E "select public.submit_supplier_return('$(K 22)', '$IT', 2, 'damaged', 'Two cracked jars', false)" >/dev/null
has "taking more from Damaged than it holds is refused" "$(as $O "select public.decide_supplier_return((select id from supplier_returns where request_key = '$(K 22)'), 'approved')")" "below zero"
as $E "select public.submit_supplier_return('$(K 23)', '$IT', 2, 'available', 'Leaking pumps, replacement promised', true)" >/dev/null
as $O "select public.decide_supplier_return((select id from supplier_returns where request_key = '$(K 23)'), 'approved')" >/dev/null
ok  "with a replacement expected: Available -2, and 2 are outstanding again; the order goes back to Ordered" "$(stock) $(line $IT) $(q "select status from purchase_orders where id = '$PO'")" "32/1 20/18/2 ordered"

echo " 8. customer returns: inspection first, the owner decides"
has "staff record 3 of the 5 sold coming back" "$(as $E "select public.record_customer_return('$(K 30)', '$OI', 3)")" '"status": "awaiting_inspection"'
ok  "  awaiting inspection: not in stock, not sellable" "$(stock)" "32/1"
has "  recorded again with the same key: nothing more" "$(as $E "select public.record_customer_return('$(K 30)', '$OI', 3)")" '"duplicate": true'
has "more back than sold and not yet returned is refused" "$(as $E "select public.record_customer_return('$(K 31)', '$OI', 3)")" "Only 2 unit(s) of that order line"
C1=$(q "select id from customer_return_inspections where request_key = '$(K 30)'")
has "staff cannot decide" "$(as $E "select public.decide_customer_return('$C1', 3, 0, 0, false, false)")" "Only the owner"
has "an opened product cannot be restocked" "$(as $O "select public.decide_customer_return('$C1', 1, 0, 2, true, false)")" "cannot be restocked"
has "every returned unit needs an outcome" "$(as $O "select public.decide_customer_return('$C1', 1, 1, 0, false, false)")" "3 unit(s) came back"
has "the owner decides: 2 sellable, 1 damaged" "$(as $O "select public.decide_customer_return('$C1', 2, 1, 0, false, false, 'Unopened; one jar cracked')")" '"already_decided": false'
ok  "  Available +2, Damaged +1" "$(stock)" "34/2"
as $E "select public.record_customer_return('$(K 32)', '$OI', 2)" >/dev/null
as $O "select public.decide_customer_return((select id from customer_return_inspections where request_key = '$(K 32)'), 0, 0, 2, true, false, 'Opened by the customer')" >/dev/null
ok  "two opened units: unsuitable, kept out of sale (Damaged +2)" "$(stock) $(q "select unsuitable||'/'||opened::text from customer_return_inspections where request_key = '$(K 32)'")" "34/4 2/true"
has "a decided return cannot be decided again" "$(as $O "update customer_return_inspections set restock = 2, unsuitable = 0 where request_key = '$(K 32)'")" "already decided"

echo " 9. corrections: linked movements with a reason and the approver"
M1=$(q "select id from stock_movements where source_id = '$R1'")
has "staff cannot correct" "$(as $E "select public.correct_stock_movement('$(K 40)', $M1, 'Counted twice')")" "Only the owner"
has "a correction needs a reason" "$(as $O "select public.correct_stock_movement('$(K 40)', $M1, 'no')")" "Say why"
has "the owner corrects the first delivery (it was 8 counted twice)" "$(as $O "select public.correct_stock_movement('$(K 40)', $M1, 'Delivery entered twice by mistake')")" '"duplicate": false'
ok  "  a reversing movement, linked to the original, with reason and approver; the original stays" "$(q "select change||'/'||(corrects = $M1)::text||'/'||(approved_by = '$O')::text||'/'||(reason like '%entered twice%')::text from stock_movements where corrects = $M1")/$(q "select count(*) from stock_movements where id = $M1")" "-8/true/true/true/1"
ok  "  Available -8; 8 outstanding again on the order line" "$(stock) $(line $IT)" "26/4 20/10/10"
has "  sent again: nothing more" "$(as $O "select public.correct_stock_movement('$(K 40)', $M1, 'Delivery entered twice by mistake')")" '"duplicate": true'
has "  a movement is corrected only once" "$(as $O "select public.correct_stock_movement('$(K 41)', $M1, 'again')")" "already been corrected"
has "  a correction is not itself corrected" "$(as $O "select public.correct_stock_movement('$(K 42)', (select id from stock_movements where corrects = $M1), 'undo the undo')")" "not corrected again"

echo " 10. the history cannot be written or changed by hand"
has "nobody inserts a movement by hand, owner included" "$(as $O "insert into stock_movements (product_id, bucket, change, reason, source_kind) values ('$P', 'available', 100, 'free stock please', 'receipt')")" "written by the database only"
has "  nor changes one" "$(as $O "update stock_movements set change = 1 where id = $M1")" "permission denied\|cannot be changed"
has "  nor deletes one" "$(as $O "delete from stock_movements where id = $M1")" "permission denied\|cannot be changed"
ok  "starting stock + every movement = today's stock (Available and Damaged)" "$(q "select (5 + coalesce(sum(change) filter (where bucket = 'available'), 0))||'/'||(0 + coalesce(sum(change) filter (where bucket = 'damaged'), 0)) from stock_movements where product_id = '$P'")" "$(stock)"
ok  "staff do not read the movement ledger; the owner does" "$(as $E "select count(*) from stock_movements")/$(as $O "select count(*) > 0 from stock_movements")" "0/t"

echo " rollback"
ok  "rollback refuses while stock movements exist" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "stock movement(s) were made through this feature"
fresh
ok  "fresh copy: install" "$(run "$INSTALL")" "0"
submit 1 $PO "[{\"po_item_id\":\"$IT\",\"good\":8}]" >/dev/null
ok  "  with one request waiting and no authorization, the rollback refuses" "$(run "$ROLLBACK")" "3"
has "  and says how to allow it" "$(cat "$OUTF")" "1 request(s) exist and would be deleted"
psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_stock_requests = 'yes, delete the requests'" -f "$ROLLBACK" >"$OUTF" 2>&1
ok  "  authorized: removed, stock untouched" "$(q "select (to_regclass('public.stock_movements') is null)::text") $(stock)" "true 5/0"
ok  "  a second rollback is harmless" "$(run "$ROLLBACK")" "0"
ok  "  install works again afterwards" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" = "0" ]
