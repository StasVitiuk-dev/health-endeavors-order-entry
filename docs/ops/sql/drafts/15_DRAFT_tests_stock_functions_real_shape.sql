-- LOCAL ONLY tests for 10_DRAFT_stock_functions.sql on the REAL table shapes
-- (local-test/01_REAL_SHAPE_schema_for_local_tests.sql). Runs inside
-- BEGIN … ROLLBACK, as the `authenticated` role, with synthetic rows: NOTHING
-- is kept. Each check raises (and stops) if a result is wrong; the last line
-- prints ALL REAL-SHAPE STOCK FUNCTION TESTS PASSED.
-- Users: one owner and one employee (profiles.role), so the Owner/Administrator
-- rule the real database applies to stock tables (Query A) is exercised.
begin;
insert into profiles (id, email, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'owner@example.test', 'owner'),
  ('00000000-0000-4000-8000-0000000000e1', 'employee@example.test', 'employee');
set local role authenticated;

do $$
declare
  owner_id constant text := '00000000-0000-4000-8000-0000000000a1';
  emp_id   constant text := '00000000-0000-4000-8000-0000000000e1';
  a uuid; b uuid; c uuid; s uuid; po uuid; po2 uuid; po3 uuid; po4 uuid; l1 uuid; l2 uuid; lot uuid; lot2 uuid; rc uuid; rc2 uuid;
  o uuid; oi uuid; oi2 uuid; r uuid; r2 uuid; r3 uuid; res jsonb; n int; v numeric;
begin
  perform set_config('request.jwt.claim.sub', owner_id, true);
  insert into products (name, sku) values ('TEST A', 'T-A') returning id into a;
  insert into products (name, sku) values ('TEST B', 'T-B') returning id into b;
  insert into products (name, sku) values ('TEST C unused', 'T-C') returning id into c;
  insert into inventory (product_id, available) values (a, 10), (b, 0);
  insert into suppliers (name) values ('TEST supplier') returning id into s;

  -- R1 receive (owner) --------------------------------------------------------
  insert into purchase_orders (po_number, supplier_id, status, shipping_cost, tax) values ('TEST-PO-1', s, 'shipped', 15, 5) returning id into po;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, a, 'A', 50, 2) returning id into l1;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, b, 'B', 20, 5) returning id into l2;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, null, 'freight (not a product)', 0.5, 0);
  insert into inventory_lots (product_id, lot_number, quantity_received, quantity_remaining) values (a, 'AB1', 5, 5);

  res := receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', 'A_1')), '2026-10-03');
  if (res->>'stocked')::int <> 2 or (res->>'skipped')::int <> 1 then raise exception 'R1: expected 2 stocked + 1 skipped (fractional non-catalogue line is fine), got %', res; end if;
  select available into v from inventory where product_id = a; if v <> 60 then raise exception 'R1: A should be 60, is %', v; end if;
  select available into v from inventory where product_id = b; if v <> 20 then raise exception 'R1: B should be 20, is %', v; end if;
  select count(*) into n from expenses where note = 'Purchase order TEST-PO-1' and amount = 220 and expense_date = date '2026-10-03' and category = 'manufacturing';
  if n <> 1 then raise exception 'R1: expected one expense of 220 on 2026-10-03 (category from the PO)'; end if;
  select quantity_remaining into v from inventory_lots where lot_number = 'AB1'; if v <> 5 then raise exception 'R1: lot AB1 wrongly changed to %', v; end if;
  select count(*) into n from inventory_lots where lot_number = 'A_1' and quantity_remaining = 50; if n <> 1 then raise exception 'R1: lot A_1 not created'; end if;
  select count(*) into n from purchase_order_items where id = l1 and landed_unit_cost = 2.2; if n <> 1 then raise exception 'R1: landed cost should be 2.2'; end if;
  select count(*) into n from purchase_orders where id = po and status = 'received' and received_by = owner_id::uuid; if n <> 1 then raise exception 'R1: PO not marked received by the owner'; end if;
  select count(*) into n from audit_log where table_name = 'inventory' and changed_by = owner_id::uuid; if n < 2 then raise exception 'R1: audit rows should record the owner'; end if;
  res := receive_purchase_order(po);
  if not (res->>'already_received')::boolean then raise exception 'R1: retry should report already_received'; end if;
  select available into v from inventory where product_id = a; if v <> 60 then raise exception 'R1 retry: A changed to %', v; end if;

  -- R1: deleted purchase order refused, nothing changed
  insert into purchase_orders (po_number, supplier_id, status, deleted_at) values ('TEST-PO-DEL', s, 'shipped', now()) returning id into po2;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po2, a, 'A', 7, 1);
  begin perform receive_purchase_order(po2); raise exception 'R1: deleted PO was received';
  exception when sqlstate '55000' then null; end;
  select available into v from inventory where product_id = a; if v <> 60 then raise exception 'R1 deleted: A changed to %', v; end if;

  -- R1: non-whole catalogue quantity refused before anything changes
  insert into purchase_orders (po_number, supplier_id, status) values ('TEST-PO-FRAC', s, 'ordered') returning id into po3;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po3, a, 'A', 3, 1), (po3, b, 'B', 2.5, 1);
  begin perform receive_purchase_order(po3); raise exception 'R1: 2.5 units accepted';
  exception when sqlstate '22023' then null; end;
  select available into v from inventory where product_id = a; if v <> 60 then raise exception 'R1 fractional: A changed to %', v; end if;
  select count(*) into n from purchase_orders where id = po3 and status = 'ordered'; if n <> 1 then raise exception 'R1 fractional: PO status changed'; end if;
  select count(*) into n from expenses where note = 'Purchase order TEST-PO-FRAC'; if n <> 0 then raise exception 'R1 fractional: expense logged'; end if;

  -- R1: failure on the last line (by product order) leaves nothing behind
  insert into purchase_orders (po_number, supplier_id, status) values ('TEST-PO-ATOMIC', s, 'shipped') returning id into po4;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po4, a, 'A', 4, 1), (po4, b, 'B', 4, 1);
  begin
    perform receive_purchase_order(po4, (select jsonb_agg(jsonb_build_object('line_id', id, 'lot_number', repeat('X', 101))) from purchase_order_items where purchase_order_id = po4));
    raise exception 'R1: over-long lot accepted';
  exception when sqlstate '22001' then null; end;
  select available into v from inventory where product_id = a; if v <> 60 then raise exception 'R1 atomic: A changed to %', v; end if;
  select available into v from inventory where product_id = b; if v <> 20 then raise exception 'R1 atomic: B changed to %', v; end if;

  -- R1: cancelled refused
  update purchase_orders set status = 'cancelled' where id = po4;
  begin perform receive_purchase_order(po4); raise exception 'R1: cancelled PO received';
  exception when sqlstate '55000' then null; end;

  -- R4 adjust ------------------------------------------------------------------
  res := adjust_inventory(a, 'damaged', 3, 'test');
  if (res->>'new_value')::int <> 3 then raise exception 'R4: damaged should be 3, got %', res; end if;
  begin perform adjust_inventory(a, 'damaged', -4, 'too many'); raise exception 'R4: below zero accepted';
  exception when sqlstate '23514' then null; end;
  begin perform adjust_inventory(a, 'not_a_bucket', 1, 'x'); raise exception 'R4: unknown bucket accepted';
  exception when sqlstate '22023' then null; end;
  begin perform adjust_inventory(a, 'available', 0, 'x'); raise exception 'R4: zero accepted';
  exception when sqlstate '22023' then null; end;

  -- R2 recall (owner) --------------------------------------------------------------
  insert into inventory_lots (product_id, lot_number, quantity_received, quantity_remaining) values (b, 'L-REC', 50, 50) returning id into lot;
  insert into recalls (lot_id, product_id, reason) values (lot, b, 'TEST recall') returning id into rc;
  res := quarantine_recall(rc);
  if (res->>'quantity_quarantined')::int <> 20 then raise exception 'R2: should quarantine min(lot 50, available 20) = 20, got %', res; end if;
  select available, recalled into v, n from inventory where product_id = b; if v <> 0 or n <> 20 then raise exception 'R2: B available/recalled wrong'; end if;
  res := quarantine_recall(rc); if not (res->>'already_done')::boolean then raise exception 'R2: retry should be already_done'; end if;
  -- fractional lot remaining refused
  perform adjust_inventory(b, 'available', 5, 'refill');
  insert into inventory_lots (product_id, lot_number, quantity_received, quantity_remaining) values (b, 'L-FRAC', 3, 2.5) returning id into lot2;
  insert into recalls (lot_id, product_id, reason) values (lot2, b, 'TEST recall 2') returning id into rc2;
  begin perform quarantine_recall(rc2); raise exception 'R2: fractional lot accepted';
  exception when sqlstate '22023' then null; end;

  -- R3 return (owner) ---------------------------------------------------------------
  insert into orders (channel, order_number, status, source) values ('manual', 'TEST-1001', 'paid', 'manual') returning id into o;
  insert into order_items (order_id, product_name, sku, quantity, unit_price, line_total) values (o, 'TEST B', 't-b', 3, 10, 30) returning id into oi;  -- lower-case SKU
  insert into returns (order_id, order_item_id, reason, status) values (o, oi, 'damaged', 'approved') returning id into r;
  begin perform receive_return(r, 'restock_available', 4); raise exception 'R3: quantity above the line accepted';
  exception when sqlstate '22023' then null; end;
  begin perform receive_return(r, 'giveaway'); raise exception 'R3: unknown disposition accepted';
  exception when sqlstate '22023' then null; end;
  res := receive_return(r, 'restock_available', 1);
  if not (res->>'restocked')::boolean then raise exception 'R3: lower-case SKU t-b should match product T-B, got %', res; end if;
  select available into v from inventory where product_id = b; if v <> 6 then raise exception 'R3: B should be 5+1 = 6, is %', v; end if;
  res := receive_return(r, 'restock_available', 1); if not (res->>'already_done')::boolean then raise exception 'R3: retry should be already_done'; end if;
  update returns set status = 'approved' where id = r;  -- a stale page re-opens it (N13)
  res := receive_return(r, 'restock_available', 1);
  if res->>'reason' <> 'received_before' then raise exception 'R3 N13: %', res; end if;
  select available into v from inventory where product_id = b; if v <> 6 then raise exception 'R3 N13: B changed to %', v; end if;

  -- Employee: every stock change refused, nothing changed -----------------------------
  perform set_config('request.jwt.claim.sub', emp_id, true);
  begin perform adjust_inventory(a, 'available', 1, 'employee'); raise exception 'EMP: adjust accepted';
  exception when sqlstate '42501' then null; end;
  insert into returns (order_id, order_item_id, reason, status) values (o, oi, 'damaged', 'approved') returning id into r2;
  begin perform receive_return(r2, 'restock_available', 1); raise exception 'EMP: restock accepted';
  exception when sqlstate '42501' then null; end;
  perform set_config('request.jwt.claim.sub', owner_id, true);
  select count(*) into n from returns where id = r2 and status = 'approved' and received_at is null;
  if n <> 1 then raise exception 'EMP: a refused restock must leave the return approved, not received'; end if;
  select available into v from inventory where product_id = b; if v <> 6 then raise exception 'EMP: stock changed to %', v; end if;
  -- … but an employee may still receive a return that is discarded (no stock change)
  perform set_config('request.jwt.claim.sub', emp_id, true);
  res := receive_return(r2, 'discard');
  if (res->>'restocked')::boolean then raise exception 'EMP: discard restocked'; end if;
  perform set_config('request.jwt.claim.sub', owner_id, true);
  select count(*) into n from returns where id = r2 and status = 'received' and disposition = 'discard'; if n <> 1 then raise exception 'EMP: discard not recorded'; end if;
  -- unknown SKU: received, nothing restocked
  insert into order_items (order_id, product_name, sku, quantity) values (o, 'TEST ?', 'NOPE', 1) returning id into oi2;
  insert into returns (order_id, order_item_id, reason, status) values (o, oi2, 'damaged', 'approved') returning id into r3;
  res := receive_return(r3, 'restock_available');
  if (res->>'restocked')::boolean or res->>'note' <> 'no_product_with_sku' then raise exception 'R3 unknown sku: %', res; end if;

  -- R5 delete --------------------------------------------------------------------------
  res := delete_unused_product(a);
  if (res->>'deleted')::boolean or res->>'reason' <> 'has_stock' then raise exception 'R5: product with stock deleted? %', res; end if;
  update inventory set available = 0, recalled = 0, damaged = 0 where product_id = b;
  res := delete_unused_product(b);
  if (res->>'deleted')::boolean or res->>'reason' <> 'in_use' then raise exception 'R5: in-use product: %', res; end if;
  select count(*) into n from inventory where product_id = b; if n <> 1 then raise exception 'R5: stock row of an in-use product was lost'; end if;
  res := delete_unused_product(c);
  if not (res->>'deleted')::boolean then raise exception 'R5: unused product not deleted: %', res; end if;

  raise notice 'ALL REAL-SHAPE STOCK FUNCTION TESTS PASSED';
end $$;
rollback;
