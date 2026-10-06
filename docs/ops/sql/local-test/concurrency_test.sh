#!/bin/bash
# SUPERSEDED 2026-10-05: kept for history only. Use stress_test.sh on the REAL table
# shapes (local-test/01_REAL_SHAPE_…); this script targets the old guessed schema.
# LOCAL TEST ONLY. Fires many simultaneous calls at the DRAFT functions on a
# throwaway local PostgreSQL and checks nothing is lost or doubled.
# Usage: concurrency_test.sh <psql connection args...>
PSQL="psql $* -qtA -v ON_ERROR_STOP=1"
call() { $PSQL -c "set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000000$((RANDOM%9+1))',false); $1" >/dev/null 2>>/tmp/he_conc_err.log; }
fail=0; check() { if [ "$2" = "$3" ]; then echo "PASS  $1 ($2)"; else echo "FAIL  $1: expected $3, got $2"; fail=1; fi; }
: > /tmp/he_conc_err.log
$PSQL <<'SQL'
delete from inventory_adjustments; delete from expenses; delete from recalls; delete from returns; delete from order_items; delete from orders;
delete from purchase_order_items; delete from inventory_lots; delete from purchase_orders; delete from inventory; delete from products; delete from suppliers;
insert into products (id, name, sku) values ('11111111-1111-4111-8111-111111111111','CONC A','C-A'), ('22222222-2222-4222-8222-222222222222','CONC B','C-B');
insert into inventory (product_id, available) values ('11111111-1111-4111-8111-111111111111', 100), ('22222222-2222-4222-8222-222222222222', 5);
insert into purchase_orders (id, po_number, status) values ('33333333-3333-4333-8333-333333333333','CONC-PO','shipped');
insert into purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) values ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111', 40, 2);
insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) values ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','L1',5,5);
insert into recalls (id, lot_id, status) values ('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444','initiated');
insert into orders (id, order_number) values ('66666666-6666-4666-8666-666666666666','CONC-1');
insert into order_items (id, order_id, sku, quantity) values ('77777777-7777-4777-8777-777777777777','66666666-6666-4666-8666-666666666666','C-A',2);
insert into returns (id, order_id, order_item_id, status) values ('88888888-8888-4888-8888-888888888888','66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777','approved');
SQL
# 1. lost updates: 50 simultaneous +1 on A.damaged
for i in $(seq 50); do call "select adjust_inventory('11111111-1111-4111-8111-111111111111','damaged',1,'conc');" & done; wait
check "50 simultaneous +1 adjustments, none lost" "$($PSQL -c "select damaged from inventory where product_id='11111111-1111-4111-8111-111111111111'")" 50
check "50 matching history rows" "$($PSQL -c "select count(*) from inventory_adjustments where reason='conc'")" 50
# 2. below-zero race: B.available = 5, 12 simultaneous -1
for i in $(seq 12); do call "select adjust_inventory('22222222-2222-4222-8222-222222222222','available',-1,'drain');" & done; wait
check "below-zero race: stock ends at exactly 0" "$($PSQL -c "select available from inventory where product_id='22222222-2222-4222-8222-222222222222'")" 0
check "below-zero race: exactly 5 succeeded" "$($PSQL -c "select count(*) from inventory_adjustments where reason='drain'")" 5
# 3. 12 simultaneous receives of the same PO
for i in $(seq 12); do call "select receive_purchase_order('33333333-3333-4333-8333-333333333333');" & done; wait
check "simultaneous receive: stock added once (100+40)" "$($PSQL -c "select available from inventory where product_id='11111111-1111-4111-8111-111111111111'")" 140
check "simultaneous receive: one expense" "$($PSQL -c "select count(*) from expenses where note='Purchase order CONC-PO'")" 1
# 4. recall quarantined by 10 people at once (B now 0 available → refill 5 first)
call "select adjust_inventory('22222222-2222-4222-8222-222222222222','available',5,'refill');"
for i in $(seq 10); do call "select quarantine_recall('55555555-5555-4555-8555-555555555555');" & done; wait
check "simultaneous recall: recalled once (5)" "$($PSQL -c "select recalled from inventory where product_id='22222222-2222-4222-8222-222222222222'")" 5
# 5. return received in 10 tabs at once
for i in $(seq 10); do call "select receive_return('88888888-8888-4888-8888-888888888888','restock_available');" & done; wait
check "simultaneous return: restocked once (140+2)" "$($PSQL -c "select available from inventory where product_id='11111111-1111-4111-8111-111111111111'")" 142
# 6. nothing negative anywhere; history adds up for A.available
check "no negative bucket" "$($PSQL -c "select count(*) from inventory where least(available,reserved,damaged,sample,wholesale,promotional,returned,recalled) < 0")" 0
check "A.available = 100 + its history" "$($PSQL -c "select 100 + coalesce(sum(change_amount),0) from inventory_adjustments where product_id='11111111-1111-4111-8111-111111111111' and bucket='available'")" 142
echo "expected refusals logged: $(grep -c "below_zero\|That would leave" /tmp/he_conc_err.log) (below-zero), other errors: $(grep -v "That would leave\|^$\|HINT\|CONTEXT\|PL/pgSQL\|SQL statement" /tmp/he_conc_err.log | grep -c ERROR)"
# 7. deadlock check: 20 purchase orders each with lines for A and B (in mixed
#    order), all received at once. Lock order must be consistent.
$PSQL <<'SQL'
insert into purchase_orders (id, po_number, status)
  select ('99999999-9999-4999-8999-' || lpad(g::text, 12, '0'))::uuid, 'DL-' || g, 'shipped' from generate_series(1,20) g;
insert into purchase_order_items (id, purchase_order_id, product_id, quantity, unit_cost)
  select gen_random_uuid(), ('99999999-9999-4999-8999-' || lpad(g::text, 12, '0'))::uuid,
         case when (g + k) % 2 = 0 then '11111111-1111-4111-8111-111111111111'::uuid else '22222222-2222-4222-8222-222222222222'::uuid end, 1, 1
  from generate_series(1,20) g, generate_series(0,1) k;
SQL
: > /tmp/he_conc_err.log
for g in $(seq 20); do call "select receive_purchase_order(('99999999-9999-4999-8999-' || lpad('$g', 12, '0'))::uuid);" & done; wait
check "deadlock check: all 20 overlapping receives succeeded" "$($PSQL -c "select count(*) from purchase_orders where po_number like 'DL-%' and status='received'")" 20
check "deadlock check: no deadlock errors" "$(grep -c deadlock /tmp/he_conc_err.log)" 0
exit $fail
