#!/usr/bin/env bash
# LOCAL TEST ONLY (EXT14, 2026-10-11). Never point this at Supabase.
# Measures drafts/23 (four CHECK constraints) at volume on a throwaway copy of
# the real-shape schema: how long ADD CONSTRAINT takes at 10k / 50k / 100k rows,
# whether it blocks writers while it validates, NOT VALID + VALIDATE as the
# staged alternative, and the per-row cost of the checks on inserts/updates.
# Prints one line per measurement; exits non-zero only if a step errors.
# Usage: check_volume_test.sh <psql connection args> [sizes...]   e.g. -h /var/tmp/hepg -p 5499 -U postgres
CONN=""; SIZES=""
for a in "$@"; do if [[ "$a" =~ ^[0-9]+$ ]] && [ -n "$CONN" ] && [[ ! "$prev" =~ ^-[hpU]$ ]]; then SIZES="$SIZES $a"; else CONN="$CONN $a"; fi; prev="$a"; done
SIZES=${SIZES:-"10000 50000 100000"}
DIR="$(cd "$(dirname "$0")" && pwd)"
DB=he_check_vol_$$
P() { psql $CONN -d $DB -qtAX -v ON_ERROR_STOP=1 "$@"; }
ms() { local s=$(date +%s%N); "$@" >/dev/null || return 1; echo $(( ($(date +%s%N) - s) / 1000000 )); }
cleanup() { dropdb $CONN --if-exists $DB >/dev/null 2>&1; }
trap cleanup EXIT INT TERM
createdb $CONN $DB && P -f "$DIR/01_REAL_SHAPE_schema_for_local_tests.sql" >/dev/null || exit 1

CHECKS_ADD="alter table public.inventory add constraint inventory_recalled_check check (recalled >= 0);
alter table public.inventory_lots add constraint inventory_lots_remaining_range_check check (quantity_remaining >= 0 and quantity_remaining <= quantity_received);
alter table public.purchase_order_items add constraint purchase_order_items_received_range_check check (quantity_received >= 0 and quantity_received <= quantity);
alter table public.returns add constraint returns_refund_amount_check check (refund_amount is null or refund_amount >= 0);"
CHECKS_DROP="alter table public.inventory drop constraint if exists inventory_recalled_check;
alter table public.inventory_lots drop constraint if exists inventory_lots_remaining_range_check;
alter table public.purchase_order_items drop constraint if exists purchase_order_items_received_range_check;
alter table public.returns drop constraint if exists returns_refund_amount_check;"

fill() { # $1 = rows per table (products/inventory/lots/PO lines/returns)
  P -c "set session_replication_role = replica;
    truncate inventory_adjustments, returns, order_items, orders, recalls, inventory_lots, purchase_order_items, purchase_orders, inventory, products, suppliers cascade;
    insert into suppliers (id, name) values ('a0000000-0000-4000-8000-000000000001', 'VOL supplier');
    insert into products (id, name, sku) select md5('p'||g)::uuid, 'P'||g, 'VOL-'||g from generate_series(1,$1) g;
    insert into inventory (product_id, available, recalled) select md5('p'||g)::uuid, 10, 0 from generate_series(1,$1) g;
    insert into purchase_orders (id, po_number, supplier_id, status) select md5('po'||g)::uuid, 'VPO-'||g, 'a0000000-0000-4000-8000-000000000001', 'received' from generate_series(1, greatest($1/10,1)) g;
    insert into purchase_order_items (purchase_order_id, product_id, description, quantity, quantity_received, unit_cost)
      select md5('po'||(1 + g % greatest($1/10,1)))::uuid, md5('p'||g)::uuid, 'line '||g, 5, 5, 1 from generate_series(1,$1) g;
    insert into inventory_lots (product_id, lot_number, quantity_received, quantity_remaining)
      select md5('p'||g)::uuid, 'L'||g, 5, 3 from generate_series(1,$1) g;
    insert into orders (id, channel, order_number, total) select md5('o'||g)::uuid, 'manual', 'VO-'||g, 10 from generate_series(1, greatest($1/10,1)) g;
    insert into order_items (id, order_id, sku, quantity) select md5('oi'||g)::uuid, md5('o'||(1 + g % greatest($1/10,1)))::uuid, 'VOL-'||g, 1 from generate_series(1,$1) g;
    insert into returns (order_id, order_item_id, reason, status, refund_amount)
      select md5('o'||(1 + g % greatest($1/10,1)))::uuid, md5('oi'||g)::uuid, 'other', 'requested', 1 from generate_series(1,$1) g;
    analyze;" >/dev/null
}

for n in $SIZES; do
  fill $n || { echo "fill $n failed"; exit 1; }
  P -c "$CHECKS_DROP" >/dev/null
  add=$(ms P -c "begin; $CHECKS_ADD commit;")
  P -c "$CHECKS_DROP" >/dev/null
  nv=$(ms P -c "begin; $(echo "$CHECKS_ADD" | sed 's/;$/ not valid;/') commit;")
  val=$(ms P -c "alter table public.inventory validate constraint inventory_recalled_check; alter table public.inventory_lots validate constraint inventory_lots_remaining_range_check; alter table public.purchase_order_items validate constraint purchase_order_items_received_range_check; alter table public.returns validate constraint returns_refund_amount_check;")
  # write cost: 2,000 single-row updates with and without the checks
  upd() { P -c "do \$\$ begin for i in 1..2000 loop update inventory_lots set quantity_remaining = quantity_remaining where product_id = md5('p'||(1 + i % $n))::uuid; end loop; end \$\$;"; }
  with=$(ms upd)
  P -c "$CHECKS_DROP" >/dev/null
  without=$(ms upd)
  echo "rows=$n add_constraints_ms=$add not_valid_add_ms=$nv validate_ms=$val updates2000_with_checks_ms=$with updates2000_without_ms=$without"
done

# Does ADD CONSTRAINT block a writer while it validates? (100k-row lots table)
P -c "$CHECKS_DROP" >/dev/null
( P -c "begin; alter table public.inventory_lots add constraint inventory_lots_remaining_range_check check (quantity_remaining >= 0 and quantity_remaining <= quantity_received); select pg_sleep(1.5); commit;" >/dev/null ) &
sleep 0.3
blk=$(ms P -c "set lock_timeout = '5s'; update inventory_lots set quantity_remaining = quantity_remaining where lot_number = 'L1';")
wait
P -c "alter table public.inventory_lots drop constraint if exists inventory_lots_remaining_range_check;" >/dev/null
( P -c "begin; alter table public.inventory_lots add constraint inventory_lots_remaining_range_check check (quantity_remaining >= 0 and quantity_remaining <= quantity_received) not valid; commit; begin; alter table public.inventory_lots validate constraint inventory_lots_remaining_range_check; select pg_sleep(1.5); commit;" >/dev/null ) &
sleep 0.3
nblk=$(ms P -c "set lock_timeout = '5s'; update inventory_lots set quantity_remaining = quantity_remaining where lot_number = 'L1';")
wait
echo "writer_wait_during_add_constraint_ms=$blk writer_wait_during_validate_ms=$nblk (ADD holds ACCESS EXCLUSIVE until commit; VALIDATE takes SHARE UPDATE EXCLUSIVE, which lets writers through)"
