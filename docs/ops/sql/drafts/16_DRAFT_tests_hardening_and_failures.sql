-- LOCAL ONLY tests for the 2026-10-06 hardening of 10_DRAFT_stock_functions.sql
-- and for all-or-nothing behaviour when something fails part-way.
-- Runs on the REAL table shapes (local-test/01_REAL_SHAPE_…) inside
-- BEGIN … ROLLBACK with synthetic rows: NOTHING is kept.
--
-- Failure injection: a test-only trigger (created inside this transaction and
-- rolled back with it) makes a chosen INSERT/UPDATE fail when the setting
-- test.fail_on = '<table>:<INSERT|UPDATE>'. For every workflow and failure
-- point the test fingerprints every business table before and after the
-- failed call and requires the two to be identical: a failure part-way must
-- leave the database exactly as it was.
-- Last line printed: ALL HARDENING AND FAILURE TESTS PASSED
begin;
insert into profiles (id, email, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'owner@example.test', 'owner'),
  ('00000000-0000-4000-8000-0000000000e1', 'employee@example.test', 'employee')
on conflict (id) do update set role = excluded.role;

-- Test-only failure trigger (public schema, removed by the final ROLLBACK).
create function public._test_fail_if() returns trigger language plpgsql as $f$
begin
  if current_setting('test.fail_on', true) = tg_table_name || ':' || tg_op then
    raise exception 'injected failure on %', tg_table_name
      using errcode = coalesce(nullif(current_setting('test.fail_code', true), ''), 'XX000');
  end if;
  return new;
end $f$;
do $$ declare t text; begin
  foreach t in array array['expenses','inventory_lots','inventory_adjustments','audit_log','returns','recalls',
                           'purchase_orders','purchase_order_items','inventory'] loop
    execute format('create trigger _test_fail before insert or update on public.%I for each row execute function public._test_fail_if()', t);
  end loop;
end $$;

-- Fingerprint of every table a stock workflow can touch.
create function public._test_snapshot() returns text language sql as $f$
  select md5(concat_ws('|',
    (select coalesce(string_agg(to_jsonb(x)::text, ',' order by x.product_id), '') from inventory x),
    (select coalesce(string_agg(to_jsonb(x)::text, ',' order by x.id), '') from inventory_lots x),
    (select coalesce(string_agg(to_jsonb(x)::text, ',' order by x.id), '') from inventory_adjustments x),
    (select coalesce(string_agg(to_jsonb(x)::text, ',' order by x.id), '') from expenses x),
    (select coalesce(string_agg(to_jsonb(x)::text, ',' order by x.id), '') from purchase_orders x),
    (select coalesce(string_agg(to_jsonb(x)::text, ',' order by x.id), '') from purchase_order_items x),
    (select coalesce(string_agg(to_jsonb(x)::text, ',' order by x.id), '') from returns x),
    (select coalesce(string_agg(to_jsonb(x)::text, ',' order by x.id), '') from recalls x),
    (select coalesce(string_agg(to_jsonb(x)::text, ',' order by x.id), '') from products x),
    (select count(*)::text from audit_log)))
$f$;
grant execute on function public._test_snapshot() to authenticated;

set local role authenticated;

do $$
declare
  owner_id constant text := '00000000-0000-4000-8000-0000000000a1';
  emp_id   constant text := '00000000-0000-4000-8000-0000000000e1';
  a uuid; b uuid; c uuid; d uuid; s uuid; po uuid; po2 uuid; l1 uuid; lot uuid; rc uuid;
  o uuid; oi uuid; r uuid; res jsonb; n int; v numeric; before text; pt text; code text;
  failpoints text[]; fp text; ok boolean;
begin
  perform set_config('request.jwt.claim.sub', owner_id, true);
  insert into products (name, sku) values ('HX A', 'HX-A') returning id into a;
  insert into products (name, sku) values ('HX B', 'HX-B') returning id into b;
  insert into products (name, sku) values ('HX C unused', 'HX-C') returning id into c;
  insert into products (name, sku) values ('HX D', 'HX-D') returning id into d;
  insert into inventory (product_id, available) values (a, 10), (b, 0), (d, 5);
  insert into suppliers (name) values ('HX supplier') returning id into s;

  -- ---------------------------------------------------------------------------
  -- R4: expected-value check (stale tab, resent request)
  -- ---------------------------------------------------------------------------
  res := adjust_inventory(a, 'available', 3, 'count', 10);
  if (res->>'new_value')::int <> 13 then raise exception 'R4 expected: 10+3 should be 13, got %', res; end if;
  before := _test_snapshot();
  begin perform adjust_inventory(a, 'available', 3, 'count', 10); raise exception 'R4: resent request applied twice';
  exception when sqlstate '55000' then get stacked diagnostics pt = pg_exception_hint; if pt <> 'stale_value' then raise exception 'R4: wrong hint %', pt; end if; end;
  if _test_snapshot() <> before then raise exception 'R4: stale refusal changed something'; end if;
  res := adjust_inventory(a, 'available', -3, null);  -- no expected value: still allowed (old behaviour)
  if (res->>'new_value')::int <> 10 then raise exception 'R4: plain adjust broken'; end if;

  -- R4 malformed inputs: zero, unknown bucket, injection-looking bucket,
  -- below zero, fractional (refused by the integer parameter, never rounded)
  before := _test_snapshot();
  begin perform adjust_inventory(a, 'available', 0); raise exception 'R4: zero accepted';
  exception when sqlstate '22023' then null; end;
  begin perform adjust_inventory(a, 'avail; drop table inventory', 1); raise exception 'R4: odd bucket accepted';
  exception when sqlstate '22023' then null; end;
  begin perform adjust_inventory(a, 'available', -11); raise exception 'R4: below zero accepted';
  exception when sqlstate '23514' then null; end;
  begin perform adjust_inventory(a, 'available', '2.5'); raise exception 'R4: 2.5 accepted';
  exception when sqlstate '22P02' then null; end;
  begin perform adjust_inventory(null, 'available', 1); raise exception 'R4: null product accepted';
  exception when sqlstate 'P0002' then null; end;
  begin perform adjust_inventory(gen_random_uuid(), 'available', 1); raise exception 'R4: unknown product accepted';
  exception when sqlstate 'P0002' then null; end;
  if _test_snapshot() <> before then raise exception 'R4: a refused input changed something'; end if;

  -- ---------------------------------------------------------------------------
  -- R5: permission, stock that cancels out, silent RLS skip
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', emp_id, true);
  begin perform delete_unused_product(c); raise exception 'R5: employee deleted a product';
  exception when sqlstate '42501' then null; end;
  perform set_config('request.jwt.claim.sub', owner_id, true);
  select count(*) into n from products where id = c; if n <> 1 then raise exception 'R5: product gone after refusal'; end if;
  update inventory set available = 5, recalled = -5 where product_id = d;  -- sums to 0
  res := delete_unused_product(d);
  if (res->>'deleted')::boolean or res->>'reason' <> 'has_stock' then raise exception 'R5: buckets cancelling to 0 treated as empty: %', res; end if;
  update inventory set available = 5, recalled = 0 where product_id = d;
  res := delete_unused_product(c);
  if not (res->>'deleted')::boolean then raise exception 'R5: unused product not deleted: %', res; end if;

  -- ---------------------------------------------------------------------------
  -- R1: lot upsert — two orders bringing the same NEW lot add up, any case
  -- ---------------------------------------------------------------------------
  insert into purchase_orders (po_number, supplier_id, status) values ('HX-PO-1', s, 'ordered') returning id into po;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, b, 'B', 4, 1) returning id into l1;
  perform receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', 'New_Lot-1')));
  insert into purchase_orders (po_number, supplier_id, status) values ('HX-PO-2', s, 'ordered') returning id into po2;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po2, b, 'B', 6, 1) returning id into l1;
  perform receive_purchase_order(po2, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', 'NEW_LOT-1')));
  select count(*), sum(quantity_received), sum(quantity_remaining) into n, v, v from inventory_lots where product_id = b and lower(lot_number) = 'new_lot-1';
  if n <> 1 or v <> 10 then raise exception 'R1: same lot should be one row of 10, got % rows, %', n, v; end if;

  -- R1 malformed inputs: lots not a list, lot number too long, number as lot
  insert into purchase_orders (po_number, supplier_id, status) values ('HX-PO-3', s, 'shipped') returning id into po;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, a, 'A', 2, 3) returning id into l1;
  before := _test_snapshot();
  begin perform receive_purchase_order(po, '{"line_id":"x"}'::jsonb); raise exception 'R1: object accepted as lots';
  exception when sqlstate '22023' then null; end;
  begin perform receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', repeat('L', 101)))); raise exception 'R1: 101-char lot accepted';
  exception when sqlstate '22001' then null; end;
  begin perform receive_purchase_order(gen_random_uuid()); raise exception 'R1: unknown PO accepted';
  exception when sqlstate 'P0002' then null; end;
  if _test_snapshot() <> before then raise exception 'R1: refused input changed something'; end if;
  res := receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', 12345)));
  select count(*) into n from inventory_lots where lot_number = '12345'; if n <> 1 then raise exception 'R1: numeric lot number not stored as text'; end if;

  -- R1 lot identity edge cases (INV-27): whitespace-only = no lot; padded and
  -- mixed-case spellings are one lot; non-ASCII letters match case-insensitively
  insert into purchase_orders (po_number, supplier_id, status) values ('HX-LOT-1', s, 'ordered') returning id into po;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, b, 'B', 1, 1) returning id into l1;
  perform receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', '   ')));
  select count(*) into n from inventory_lots where trim(lot_number) = ''; if n <> 0 then raise exception 'INV-27: whitespace lot stored'; end if;
  insert into purchase_orders (po_number, supplier_id, status) values ('HX-LOT-2', s, 'ordered') returning id into po;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, b, 'B', 2, 1) returning id into l1;
  perform receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', '  Lot-Q  ')));
  insert into purchase_orders (po_number, supplier_id, status) values ('HX-LOT-3', s, 'ordered') returning id into po;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, b, 'B', 3, 1) returning id into l1;
  perform receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', 'LOT-q')));
  select count(*), sum(quantity_remaining) into n, v from inventory_lots where product_id = b and lower(lot_number) = 'lot-q';
  if n <> 1 or v <> 5 then raise exception 'INV-27: padded/mixed-case lot should be one row of 5, got % rows, %', n, v; end if;
  insert into purchase_orders (po_number, supplier_id, status) values ('HX-LOT-4', s, 'ordered') returning id into po;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, b, 'B', 1, 1) returning id into l1;
  perform receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', 'ÖKO-1')));
  insert into purchase_orders (po_number, supplier_id, status) values ('HX-LOT-5', s, 'ordered') returning id into po;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, b, 'B', 1, 1) returning id into l1;
  perform receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', 'öko-1')));
  select count(*) into n from inventory_lots where product_id = b and lower(lot_number) = lower('ÖKO-1');
  if n <> 1 then raise exception 'INV-27: non-ASCII lot spelled in two cases made % rows', n; end if;

  -- ---------------------------------------------------------------------------
  -- All-or-nothing: inject a failure at each write of each workflow
  -- ---------------------------------------------------------------------------
  -- R1 receive: every write it makes
  failpoints := array['purchase_order_items:UPDATE','inventory_lots:INSERT','inventory:UPDATE',
                      'inventory_adjustments:INSERT','audit_log:INSERT','expenses:INSERT','purchase_orders:UPDATE'];
  foreach fp in array failpoints loop
    insert into purchase_orders (po_number, supplier_id, status, shipping_cost) values ('HX-FAIL-' || fp, s, 'shipped', 4) returning id into po;
    insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, a, 'A', 3, 2) returning id into l1;
    insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, b, 'B', 2, 2);
    before := _test_snapshot();
    perform set_config('test.fail_on', fp, true);
    ok := false;
    begin
      perform receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', 'F-' || fp)));
    exception when others then ok := true; end;
    perform set_config('test.fail_on', '', true);
    if not ok then raise exception 'R1 %: the injected failure did not fire', fp; end if;
    if _test_snapshot() <> before then raise exception 'R1 %: failure part-way left changes behind', fp; end if;
    -- and the same order still receives cleanly afterwards
    res := receive_purchase_order(po, jsonb_build_array(jsonb_build_object('line_id', l1, 'lot_number', 'F-' || fp)));
    if (res->>'stocked')::int <> 2 then raise exception 'R1 %: retry after failure did not receive: %', fp, res; end if;
  end loop;

  -- R1: a permission refusal part-way (simulated: the expense insert refused
  -- the way row-level security refuses) also leaves nothing behind
  insert into purchase_orders (po_number, supplier_id, status) values ('HX-RLS', s, 'shipped') returning id into po;
  insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values (po, a, 'A', 1, 9);
  before := _test_snapshot();
  perform set_config('test.fail_on', 'expenses:INSERT', true);
  perform set_config('test.fail_code', '42501', true);
  begin perform receive_purchase_order(po); raise exception 'R1: RLS-style refusal ignored';
  exception when sqlstate '42501' then null; end;
  perform set_config('test.fail_on', '', true);
  perform set_config('test.fail_code', '', true);
  if _test_snapshot() <> before then raise exception 'R1: RLS-style refusal part-way left changes'; end if;

  -- R2 quarantine
  insert into inventory_lots (product_id, lot_number, quantity_received, quantity_remaining) values (a, 'HX-RC', 4, 4) returning id into lot;
  insert into recalls (lot_id, product_id, reason, status) values (lot, a, 'test', 'initiated') returning id into rc;
  foreach fp in array array['inventory:UPDATE','inventory_adjustments:INSERT','audit_log:INSERT','recalls:UPDATE'] loop
    before := _test_snapshot();
    perform set_config('test.fail_on', fp, true);
    ok := false;
    begin perform quarantine_recall(rc); exception when others then ok := true; end;
    perform set_config('test.fail_on', '', true);
    if not ok then raise exception 'R2 %: the injected failure did not fire', fp; end if;
    if _test_snapshot() <> before then raise exception 'R2 %: failure part-way left changes behind', fp; end if;
  end loop;
  res := quarantine_recall(rc);
  if (res->>'quantity_quarantined')::int <> 4 then raise exception 'R2: quarantine after failures wrong: %', res; end if;

  -- R3 return restock
  insert into orders (order_number, channel, source, status, customer_name) values ('HX-O1', 'retail', 'manual', 'paid', 'Test') returning id into o;
  insert into order_items (order_id, sku, quantity, product_name) values (o, 'hx-a', 2, 'A') returning id into oi;
  insert into returns (order_id, order_item_id, reason, status) values (o, oi, 'other', 'approved') returning id into r;
  foreach fp in array array['inventory:UPDATE','inventory_adjustments:INSERT','audit_log:INSERT','returns:UPDATE'] loop
    before := _test_snapshot();
    perform set_config('test.fail_on', fp, true);
    ok := false;
    begin perform receive_return(r, 'restock_available'); exception when others then ok := true; end;
    perform set_config('test.fail_on', '', true);
    if not ok then raise exception 'R3 %: the injected failure did not fire', fp; end if;
    if _test_snapshot() <> before then raise exception 'R3 %: failure part-way left changes behind', fp; end if;
  end loop;
  res := receive_return(r, 'restock_available');
  if not (res->>'restocked')::boolean then raise exception 'R3: restock after failures failed: %', res; end if;
  res := receive_return(r, 'restock_available');
  if not (res->>'already_done')::boolean then raise exception 'R3: duplicate request restocked again'; end if;

  -- R3 malformed: zero / negative / too many units
  insert into returns (order_id, order_item_id, reason, status) values (o, oi, 'other', 'approved') returning id into r;
  before := _test_snapshot();
  foreach n in array array[0, -1, 3] loop
    begin perform receive_return(r, 'restock_available', n); raise exception 'R3: quantity % accepted', n;
    exception when sqlstate '22023' then null; end;
  end loop;
  if _test_snapshot() <> before then raise exception 'R3: refused quantity changed something'; end if;

  -- R4 adjust
  foreach fp in array array['inventory:UPDATE','inventory_adjustments:INSERT','audit_log:INSERT'] loop
    before := _test_snapshot();
    perform set_config('test.fail_on', fp, true);
    ok := false;
    begin perform adjust_inventory(a, 'damaged', 2, 'x'); exception when others then ok := true; end;
    perform set_config('test.fail_on', '', true);
    if not ok then raise exception 'R4 %: the injected failure did not fire', fp; end if;
    if _test_snapshot() <> before then raise exception 'R4 %: failure part-way left changes behind', fp; end if;
  end loop;

  raise notice 'ALL HARDENING AND FAILURE TESTS PASSED';
end $$;
rollback;
