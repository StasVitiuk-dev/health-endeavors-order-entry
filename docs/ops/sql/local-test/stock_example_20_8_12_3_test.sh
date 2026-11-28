#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-27, night). Never point this at Supabase.
# One worked example, every quantity checked (drafts/40, the owner's rules of Nov 22; administrators
# decide too, Nov 24): a purchase order line of 20 units, 8 received, then 12, then 3 sent back to the
# supplier with a replacement expected, the 3 replacements received; and a customer returning 3 of 5
# sold (2 sellable, 1 damaged). Nothing changes stock until the owner or an administrator approves.
# The wider cases (rejections, surplus, two approvals at once, over-receiving, corrections, the history)
# are in partial_receiving_test.sh. All rows synthetic.
# Usage: stock_example_20_8_12_3_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_stock_example_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/40_DRAFT_partial_receiving_returns.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
as()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$1'; $2; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
O=00000000-0000-4000-8000-0000000020a1; A=00000000-0000-4000-8000-0000000020a2; E=00000000-0000-4000-8000-0000000020a3
P=00000000-0000-4000-8000-0000000020b1; SUP=00000000-0000-4000-8000-0000000020c1
PO=00000000-0000-4000-8000-0000000020d1; IT=00000000-0000-4000-8000-0000000020d2
ORDR=00000000-0000-4000-8000-0000000020e1; OI=00000000-0000-4000-8000-0000000020e2
K() { printf '00000000-0000-4000-8000-2020%08d' "$1"; }
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$INSTALL" >/dev/null 2>&1 || { echo "drafts/40 did not install"; exit 2; }
q "insert into profiles (id, email, role, is_active, account_number) values ('$O','own20@example.test','owner',true,'920000001'),
     ('$A','adm20@example.test','administrator',true,'920000002'), ('$E','staff20@example.test','employee',true,'920000003');
   insert into products (id, name, sku) values ('$P','SYNTHETIC Lavender 8 oz','SYN-EX-20');
   insert into inventory (product_id, available, damaged) values ('$P', 0, 0);
   insert into suppliers (id, name, supplier_type, is_active) values ('$SUP','SYN Example Lab','lab',true);
   insert into purchase_orders (id, po_number, supplier_id, status, payment_status) values ('$PO','SYN-PO-2020','$SUP','ordered','unpaid');
   insert into purchase_order_items (id, purchase_order_id, product_id, sku, description, quantity, unit_cost, quantity_received) values ('$IT','$PO','$P','SYN-EX-20','Lavender 8 oz',20,4,0);
   insert into orders (id, channel, status, order_number) values ('$ORDR','synthetic','paid','SYN-2020');
   insert into order_items (id, order_id, sku, quantity) values ('$OI','$ORDR','SYN-EX-20',5);
   create policy test_only_staff_sees_po20 on purchase_orders for select to authenticated using (id = '$PO');
   create policy test_only_staff_sees_po20_items on purchase_order_items for select to authenticated using (purchase_order_id = '$PO');" >/dev/null
stock()  { q "select available||'/'||damaged from inventory where product_id = '$P'"; }        # Available/Damaged
line()   { q "select quantity::int||'/'||quantity_received::int||'/'||(quantity - quantity_received)::int from purchase_order_items where id = '$IT'"; }   # ordered/received/outstanding
status() { q "select status from purchase_orders where id = '$PO'"; }
receive() { as $E "select public.submit_receiving_record('$(K $1)', '$PO', '[{\"po_item_id\":\"$IT\",\"good\":$2}]')" >/dev/null
            as $O "select public.approve_receiving_record((select id from receiving_records where request_key = '$(K $1)'))"; }

echo "Worked example 20 -> 8 -> 12 -> 3 (throwaway database $DB)"
ok  "start: 0 Available, 0 Damaged; line 20 ordered / 0 received / 20 outstanding; order Ordered" "$(stock) $(line) $(status)" "0/0 20/0/20 ordered"
has "8 arrive (staff submit, the owner approves)" "$(receive 1 8)" '"already_decided": false'
ok  "  Available 8; line 20/8/12; still Ordered" "$(stock) $(line) $(status)" "8/0 20/8/12 ordered"
has "12 arrive" "$(receive 2 12)" '"already_decided": false'
ok  "  Available 20; line 20/20/0; the order is Received" "$(stock) $(line) $(status)" "20/0 20/20/0 received"
has "staff send 3 back to the supplier, a replacement expected" "$(as $E "select public.submit_supplier_return('$(K 3)', '$IT', 3, 'available', 'Leaking caps', true)")" '"status": "submitted"'
ok  "  nothing moves before approval" "$(stock) $(line)" "20/0 20/20/0"
has "an administrator approves (no owner approval needed, Nov 24)" "$(as $A "select public.decide_supplier_return((select id from supplier_returns where request_key = '$(K 3)'), 'approved')")" "approved"
ok  "  Available 17; line 20/17/3 (3 to come again); the order is back to Ordered" "$(stock) $(line) $(status)" "17/0 20/17/3 ordered"
has "the 3 replacements arrive" "$(receive 4 3)" '"already_decided": false'
ok  "  Available 20; line 20/20/0; Received again" "$(stock) $(line) $(status)" "20/0 20/20/0 received"
echo " a customer returns 3 of the 5 sold"
has "staff record the 3 coming back" "$(as $E "select public.record_customer_return('$(K 5)', '$OI', 3)")" '"status": "awaiting_inspection"'
ok  "  awaiting inspection: not in stock, not for sale" "$(stock)" "20/0"
has "the owner decides: 2 sellable, 1 damaged" "$(as $O "select public.decide_customer_return((select id from customer_return_inspections where request_key = '$(K 5)'), 2, 1, 0, false, false, 'One jar cracked')")" '"already_decided": false'
ok  "  Available 22, Damaged 1" "$(stock)" "22/1"
echo " the books add up"
ok  "start + every stock movement = today's stock (Available/Damaged)" "$(q "select (0 + coalesce(sum(change) filter (where bucket = 'available'), 0))||'/'||(0 + coalesce(sum(change) filter (where bucket = 'damaged'), 0)) from stock_movements where product_id = '$P'")" "22/1"
ok  "every movement names who approved it" "$(q "select count(*) from stock_movements where product_id = '$P' and approved_by is null")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
