-- DRAFT (2026-10-10, extension 9). NOT INSTALLED. PRODUCTION CHANGE: needs the
-- owner's approval (and the thresholds decision X8-D4). Rollback:
-- 26_DRAFT_rollback_integrity_check_schedule.sql.
-- Tested only on the local throwaway database (local-test/integrity_schedule_test.sh).
--
-- What it is: Query F (05_READONLY_F_daily_integrity_check.sql), run every
-- night by the database itself, with each night's answer kept in a small
-- table, so problems are noticed without anyone remembering to run it:
--   * view    public.integrity_check_f       = Query F's exact text (a test
--             keeps the two identical)
--   * table   public.integrity_check_results = one row per check per night
--             (no customer data: counts and record numbers, as Query F)
--   * function public.run_integrity_check()  = saves one run; only reads
--             business tables, only writes its own results table
--   * a pg_cron job at 06:17 UTC (≈ 1 am Central) if pg_cron is installed;
--     otherwise it says so and nothing is scheduled
-- Row-level security is ON for the results table with NO policy: only the
-- database's own job can use it. Showing the latest result on Home is a
-- separate, later change (a read policy for owner/admin + a dashboard PR).
-- It never deletes or changes business data.

begin;

create view public.integrity_check_f as
  select 'F01 stuck work' as section, 'tasks "in progress" with no change for 14+ days' as check_name,
         count(*) as findings, string_agg(left(id::text, 8), ', ' order by updated_at) as examples
    from (select id, updated_at from tasks where status = 'in_progress' and updated_at < now() - interval '14 days' order by updated_at limit 1000) t
  union all
  select 'F02 stuck work', 'open tasks more than 7 days past due',
         count(*), string_agg(left(id::text, 8), ', ' order by due_at)
    from (select id, due_at from tasks where status in ('open', 'in_progress') and due_at < now() - interval '7 days' order by due_at limit 1000) t
  union all
  select 'F03 stuck work', 'approval requests pending for 7+ days',
         count(*), string_agg(left(id::text, 8), ', ' order by created_at)
    from (select id, created_at from approval_requests where status = 'pending' and created_at < now() - interval '7 days' order by created_at limit 1000) t
  union all
  select 'F04 stuck work', 'recalls still "initiated" (nothing quarantined) after 14+ days',
         count(*), string_agg(left(id::text, 8), ', ')
    from recalls where status = 'initiated' and created_at < now() - interval '14 days'
  union all
  select 'F05 stuck work', 'purchase orders ordered / shipped, expected 7+ days ago, not received',
         count(*), string_agg(po_number, ', ' order by expected_at)
    from purchase_orders where status in ('ordered', 'shipped') and expected_at < current_date - 7
  union all
  select 'F06 probable duplicate', 'order numbers used by more than one (not deleted) order',
         count(*), string_agg(order_number, ', ')
    from (select order_number from orders where deleted_at is null and order_number is not null group by order_number having count(*) > 1) d
  union all
  select 'F07 probable duplicate', 'suppliers with the same name (ignoring case and spaces)',
         count(*), string_agg(nm, ', ')
    from (select lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))) as nm from suppliers group by 1 having count(*) > 1) d
  union all
  select 'F08 probable duplicate', 'products with the same name (ignoring case and spaces)',
         count(*), string_agg(nm, ', ')
    from (select lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))) as nm from products group by 1 having count(*) > 1) d
  union all
  select 'F09 probable duplicate', 'expenses with the same date, amount, category and vendor (not deleted)',
         count(*), string_agg(k, ', ')
    from (select expense_date::text || ' ' || amount::text || ' ' || category as k from expenses
           where deleted_at is null group by expense_date, amount, category, lower(btrim(coalesce(vendor, ''))) having count(*) > 1) d
  union all
  select 'F10 points at the wrong thing', 'returns whose order line belongs to a different order',
         count(*), string_agg(left(r.id::text, 8), ', ')
    from returns r join order_items oi on oi.id = r.order_item_id where oi.order_id <> r.order_id
  union all
  select 'F11 points at the wrong thing', 'order lines whose SKU matches no product (any case)',
         count(*), string_agg(distinct sku, ', ')
    from order_items oi join orders o on o.id = oi.order_id and o.deleted_at is null
   where oi.sku is not null and btrim(oi.sku) <> ''
     and not exists (select 1 from products p where lower(btrim(p.sku)) = lower(btrim(oi.sku)))
  union all
  select 'F12 impossible value', 'order totals that are missing or below zero (not deleted)',
         count(*), string_agg(coalesce(order_number, left(id::text, 8)), ', ')
    from orders where deleted_at is null and (total is null or total < 0)
  union all
  select 'F13 impossible value', 'order totals that differ from subtotal + shipping + tax by more than 1 cent',
         count(*), string_agg(coalesce(order_number, left(id::text, 8)), ', ')
    from orders where deleted_at is null and subtotal is not null and shipping_total is not null and tax_total is not null and total is not null
     and abs(total - (subtotal + shipping_total + tax_total)) > 0.01
  union all
  select 'F14 impossible value', 'stock buckets below zero',
         count(*), string_agg(p.sku, ', ')
    from inventory i join products p on p.id = i.product_id
   where least(i.available, i.reserved, i.damaged, i.sample, i.wholesale, i.promotional, i.returned, i.recalled) < 0
  union all
  select 'F15 impossible value', 'refunded returns without a refund date, or refund dates on unrefunded returns',
         count(*), string_agg(left(id::text, 8), ', ')
    from returns where (status = 'refunded' and refunded_at is null) or (status in ('requested', 'approved', 'rejected') and refunded_at is not null);

create table public.integrity_check_results (
  id bigint generated always as identity primary key,
  run_at timestamptz not null default now(),
  section text not null,
  check_name text not null,
  found bigint not null,
  examples text
);
alter table public.integrity_check_results enable row level security;
revoke all on public.integrity_check_results from public, anon, authenticated;
revoke all on public.integrity_check_f from public, anon, authenticated;

create function public.run_integrity_check() returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare n integer;
begin
  insert into public.integrity_check_results (section, check_name, found, examples)
  select section, check_name, findings, examples from public.integrity_check_f;
  get diagnostics n = row_count;
  -- keep 90 nights
  delete from public.integrity_check_results where run_at < now() - interval '90 days';
  return n;
end $$;
revoke all on function public.run_integrity_check() from public, anon, authenticated;

do $do$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron is not installed: the check was created but NOT scheduled. Run select public.run_integrity_check(); by hand, or install pg_cron first.';
  else
    perform cron.schedule('integrity_check_nightly', '17 6 * * *', 'select public.run_integrity_check()');
  end if;
end $do$;

commit;

-- Verification (read-only):
-- select jobname, schedule, active from cron.job where jobname = 'integrity_check_nightly';   -- 1 row, active
-- select run_at, section, check_name, found from public.integrity_check_results order by run_at desc, section limit 20;
