-- LOCAL ONLY tests for 13_DRAFT_report_totals.sql. Runs in a transaction and
-- rolls back. Adds the columns the guessed local schema lacks.
begin;
alter table orders   add column if not exists placed_at timestamptz, add column if not exists deleted_at timestamptz, add column if not exists tax_total numeric;
alter table expenses add column if not exists deleted_at timestamptz;
alter table returns  add column if not exists refund_amount numeric, add column if not exists refunded_at timestamptz;
\i docs/ops/sql/drafts/13_DRAFT_report_totals.sql
delete from returns; delete from order_items; delete from orders; delete from expenses;

insert into orders (id, order_number, status, total, tax_total, placed_at)
select gen_random_uuid(), 'SYN-' || g, 'paid', 10, 0.5, '2026-03-01 12:00+00' from generate_series(1, 2500) g;
insert into orders (id, order_number, status, total, placed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'SYN-R', 'refunded', 50, '2026-03-01 12:00+00'),
  ('00000000-0000-0000-0000-0000000000a2', 'SYN-C', 'Cancelled', 70, '2026-03-01 12:00+00'),
  ('00000000-0000-0000-0000-0000000000a3', 'SYN-P', 'partially_refunded', 80, '2026-03-01 12:00+00'),
  ('00000000-0000-0000-0000-0000000000a4', 'SYN-D', 'paid', 999, '2026-03-01 12:00+00');
update orders set deleted_at = now() where order_number = 'SYN-D';
insert into expenses (category, amount, expense_date) select 'packaging', 1, '2026-03-02' from generate_series(1, 1200);
insert into expenses (category, amount, expense_date, deleted_at) values ('packaging', 500, '2026-03-02', now());
insert into returns (order_id, status, refund_amount, refunded_at) values
  ((select id from orders where order_number = 'SYN-1'), 'refunded', 30, '2026-03-05 12:00+00'),
  ('00000000-0000-0000-0000-0000000000a1', 'refunded', 50, '2026-03-05 12:00+00'),
  ('00000000-0000-0000-0000-0000000000a3', 'refunded', 20, '2026-03-05 12:00+00');

do $$
declare t jsonb;
begin
  t := report_totals(null, null, null, null, 'status_only');
  if (t->>'revenue')::numeric <> 25080 then raise exception 'revenue %', t; end if;          -- 2500×10 + 80 partial
  if (t->>'excluded')::numeric <> 120 then raise exception 'excluded %', t; end if;          -- 50 refunded + 70 cancelled
  if (t->>'sales_tax')::numeric <> 1250 then raise exception 'tax %', t; end if;
  if (t->>'expenses_total')::numeric <> 1200 then raise exception 'expenses %', t; end if;   -- deleted 500 ignored
  if (t->>'return_refunds')::numeric <> 0 then raise exception 'refunds %', t; end if;
  t := report_totals(null, null, null, null, 'subtract_return_refunds');
  if (t->>'return_refunds')::numeric <> 50 then raise exception 'refunds B %', t; end if;    -- 30 + 20, not the 50 on the refunded order
  if (t->>'revenue')::numeric <> 25030 then raise exception 'revenue B %', t; end if;
  t := report_totals('2026-04-01', null, '2026-04-01', null, 'status_only');
  if (t->>'orders_count')::int <> 0 or (t->>'expenses_total')::numeric <> 0 then raise exception 'range %', t; end if;
  begin perform report_totals(null, null, null, null, 'nope'); raise exception 'bad policy accepted';
  exception when sqlstate '22023' then null; end;
  raise notice 'REPORT TOTALS TESTS PASSED';
end $$;
rollback;
