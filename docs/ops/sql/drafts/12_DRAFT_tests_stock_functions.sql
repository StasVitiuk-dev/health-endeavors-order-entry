-- DRAFT tests for the stock functions. Everything runs inside BEGIN … ROLLBACK
-- with synthetic rows, as the `authenticated` role, so NOTHING is kept.
-- Each check raises an exception (and stops) if a result is wrong; the last
-- line prints ALL STOCK FUNCTION TESTS PASSED.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

do $$
declare
  a uuid; b uuid; c uuid; s uuid; po uuid; l1 uuid; l2 uuid; lot uuid; rc uuid; o uuid; oi uuid; r uuid; res jsonb; n int; v int;
  procedure_ok boolean;
begin
  insert into products (name, sku) values ('TEST A', 'T-A') returning id into a;
  insert into products (name, sku) values ('TEST B', 'T-B') returning id into b;
  insert into products (name, sku) values ('TEST C unused', 'T-C') returning id into c;
  insert into inventory (product_id, available) values (a, 10), (b, 0);
  insert into suppliers (name) values ('TEST supplier') returning id into s;

  -- R1 receive ---------------------------------------------------------------
  insert into purchase_orders (po_number, supplier_id, status, shipping_cost, tax) values ('TEST-PO-1', s, 'shipped', 15, 5) returning id into po;
  insert into purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) values (po, a, 50, 2) returning id into l1;
  insert into purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) values (po, b, 20, 5) returning id into l2;
  insert into inventory_lots (product_id, lot_number, quantity_received, quantity_remaining) values (a, 'AB1', 5, 5);

  res := receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', 'A_1')), '2026-10-03');
  if (res->>'stocked')::int <> 2 then raise exception 'R1: expected 2 lines stocked, got %', res; end if;
  select available into v from inventory where product_id = a; if v <> 60 then raise exception 'R1: A should be 60, is %', v; end if;
  select available into v from inventory where product_id = b; if v <> 20 then raise exception 'R1: B should be 20, is %', v; end if;
  select count(*) into n from expenses where note = 'Purchase order TEST-PO-1'; if n <> 1 then raise exception 'R1: expected 1 expense, got %', n; end if;
  select amount into v from expenses where note = 'Purchase order TEST-PO-1'; if v <> 220 then raise exception 'R1: expense should be 220, is %', v; end if;
  select count(*) into n from expenses where note = 'Purchase order TEST-PO-1' and expense_date = date '2026-10-03';
  if n <> 1 then raise exception 'R1: expense date should be the business date passed in'; end if;
  -- wildcard bug: 'A_1' must create a NEW lot, not match existing 'AB1'
  select quantity_remaining into v from inventory_lots where lot_number = 'AB1'; if v <> 5 then raise exception 'R1: lot AB1 wrongly changed to %', v; end if;
  select count(*) into n from inventory_lots where lot_number = 'A_1' and quantity_remaining = 50; if n <> 1 then raise exception 'R1: lot A_1 not created'; end if;
  select count(*) into n from inventory_adjustments where reason = 'Delivery received (TEST-PO-1)'; if n <> 2 then raise exception 'R1: expected 2 history rows, got %', n; end if;
  select count(*) into n from purchase_order_items where id = l1 and landed_unit_cost = 2.2;
  if n <> 1 then raise exception 'R1: landed cost for line A should be 2.2 (same formula as the dashboard)'; end if;
  -- retry = idempotent
  res := receive_purchase_order(po, '[]', null);
  if not (res->>'already_received')::boolean then raise exception 'R1: retry should say already received'; end if;
  select available into v from inventory where product_id = a; if v <> 60 then raise exception 'R1 retry: A changed to %', v; end if;
  select count(*) into n from expenses where note = 'Purchase order TEST-PO-1'; if n <> 1 then raise exception 'R1 retry: expense duplicated'; end if;
  -- draft / cancelled orders refuse
  insert into purchase_orders (po_number, status) values ('TEST-PO-2', 'cancelled') returning id into po;
  begin perform receive_purchase_order(po); raise exception 'R1: cancelled PO was received';
  exception when sqlstate '55000' then null; end;
  -- all-or-nothing: a failing line (product deleted mid-way is simulated by a bad bucket? use negative qty) rolls back
  insert into purchase_orders (po_number, status) values ('TEST-PO-3', 'ordered') returning id into po;
  insert into purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) values (po, a, 5, 1);
  insert into purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) values (po, b, 3, 1);
  begin
    perform receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', (select id from purchase_order_items where purchase_order_id = po order by id desc limit 1), 'lot_number', repeat('x', 101))));
    raise exception 'R1: overlong lot accepted';
  exception when sqlstate '22001' then null; end;
  select available into v from inventory where product_id = a; if v <> 60 then raise exception 'R1 atomic: A changed to % after a failed receive', v; end if;
  select available into v from inventory where product_id = b; if v <> 20 then raise exception 'R1 atomic: B changed to % after a failed receive', v; end if;
  select count(*) into n from inventory_adjustments where reason = 'Delivery received (TEST-PO-3)'; if n <> 0 then raise exception 'R1 atomic: % history rows survived a failed receive', n; end if;
  select count(*) into n from purchase_orders where id = po and status = 'ordered';
  if n <> 1 then raise exception 'R1 atomic: PO status changed after a failed receive'; end if;
  select count(*) into n from expenses where note = 'Purchase order TEST-PO-3'; if n <> 0 then raise exception 'R1 atomic: expense written'; end if;

  -- R4 manual adjustment --------------------------------------------------------
  res := adjust_inventory(a, 'damaged', 4, 'TEST damaged');
  if (res->>'new_value')::int <> 4 then raise exception 'R4: damaged should be 4, %', res; end if;
  begin perform adjust_inventory(a, 'damaged', -5, 'too many'); raise exception 'R4: below zero allowed';
  exception when sqlstate '23514' then null; end;
  select damaged into v from inventory where product_id = a; if v <> 4 then raise exception 'R4: failed adjustment changed stock to %', v; end if;
  begin perform adjust_inventory(a, 'updated_by', 1, 'x'); raise exception 'R4: arbitrary column accepted';
  exception when sqlstate '22023' then null; end;
  begin perform adjust_inventory(a, 'available', 0, 'x'); raise exception 'R4: zero accepted';
  exception when sqlstate '22023' then null; end;

  -- R2 recall -------------------------------------------------------------------
  select id into lot from inventory_lots where lot_number = 'A_1';
  insert into recalls (lot_id, status) values (lot, 'initiated') returning id into rc;
  res := quarantine_recall(rc);
  if (res->>'quantity_quarantined')::int <> 50 then raise exception 'R2: expected 50 quarantined, %', res; end if;
  select available, recalled into v, n from inventory where product_id = a;
  if v <> 10 or n <> 50 then raise exception 'R2: expected available 10 / recalled 50, got % / %', v, n; end if;
  select quantity_remaining into v from inventory_lots where id = lot; if v <> 50 then raise exception 'R2: lot remaining must stay 50 (by design), is %', v; end if;
  res := quarantine_recall(rc);
  if not (res->>'already_done')::boolean then raise exception 'R2: retry should be already_done'; end if;
  select recalled into n from inventory where product_id = a; if n <> 50 then raise exception 'R2 retry: recalled changed to %', n; end if;

  -- R3 return -------------------------------------------------------------------
  insert into orders (order_number) values ('TEST-1001') returning id into o;
  insert into order_items (order_id, product_name, sku, quantity) values (o, 'TEST B', 'T-B', 3) returning id into oi;
  insert into returns (order_id, order_item_id, status) values (o, oi, 'approved') returning id into r;
  begin perform receive_return(r, 'restock_available', 4); raise exception 'R3: quantity above the line accepted';
  exception when sqlstate '22023' then null; end;
  res := receive_return(r, 'restock_available', 1);
  if not (res->>'restocked')::boolean or (res->>'quantity')::int <> 1 then raise exception 'R3: %', res; end if;
  select available into v from inventory where product_id = b; if v <> 21 then raise exception 'R3: B should be 21, is %', v; end if;
  res := receive_return(r, 'restock_available', 1);
  if not (res->>'already_done')::boolean then raise exception 'R3: retry should be already_done'; end if;
  select available into v from inventory where product_id = b; if v <> 21 then raise exception 'R3 retry: B changed to %', v; end if;
  -- N13: a stale page sets the finished return back to 'approved' -> still no second restock
  update returns set status = 'approved' where id = r;
  res := receive_return(r, 'restock_available', 1);
  if not (res->>'already_done')::boolean or res->>'reason' <> 'received_before' then raise exception 'R3 N13: %', res; end if;
  select available into v from inventory where product_id = b; if v <> 21 then raise exception 'R3 N13: B changed to %', v; end if;
  -- unknown SKU: marked received, nothing restocked
  update order_items set sku = 'NOPE' where id = oi;
  insert into returns (order_id, order_item_id, status) values (o, oi, 'approved') returning id into r;
  res := receive_return(r, 'restock_available');
  if (res->>'restocked')::boolean or res->>'note' <> 'no_product_with_sku' then raise exception 'R3 unknown sku: %', res; end if;

  -- R5 delete -------------------------------------------------------------------
  res := delete_unused_product(a);
  if (res->>'deleted')::boolean or res->>'reason' <> 'has_stock' then raise exception 'R5: product with stock deleted? %', res; end if;
  update inventory set available = 0, recalled = 0, damaged = 0, returned = 0 where product_id = b;
  res := delete_unused_product(b);
  if (res->>'deleted')::boolean or res->>'reason' <> 'in_use' then raise exception 'R5: in-use product: %', res; end if;
  select count(*) into n from inventory where product_id = b; if n <> 1 then raise exception 'R5: stock row of in-use product was lost'; end if;
  res := delete_unused_product(c);
  if not (res->>'deleted')::boolean then raise exception 'R5: unused product not deleted: %', res; end if;

  raise notice 'ALL STOCK FUNCTION TESTS PASSED';
end $$;
rollback;
