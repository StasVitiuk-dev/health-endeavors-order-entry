-- =============================================================================
-- DRAFT — NOT FOR PRODUCTION YET.  BLOCKED ON QUERY A/B (real column names and
-- status values). Written against the guessed local schema; tested only on a
-- local PostgreSQL 16 (see 14_DRAFT_tests_report_totals.sql).
--
-- Finding N14: Accounting / Tax Records / Business Health add rows up in the
-- browser. The dashboard now pages through every row (fetchAllRows), which is
-- correct but grows with the data. The long-term shape is: the database adds
-- up, the dashboard receives one small row.
--
-- report_totals() mirrors the dashboard's rules exactly:
--   * deleted orders/expenses (deleted_at set) are ignored
--   * an order is excluded when its status contains "cancel", or contains
--     "refund" without "partial" (same keyword rule as classifyOrderStatus)
--   * orders by placed_at in [p_orders_from, p_orders_to); expenses by
--     expense_date in [p_expenses_from, p_expenses_to) — the dashboard passes
--     both, so time-zone handling stays in one place (the browser)
--   * p_refund_policy: 'status_only' (today) or 'subtract_return_refunds'
--     (owner decision N4), with the same "never subtract twice" rule
-- SECURITY INVOKER: row-level security applies exactly as for today's reads.
-- =============================================================================
create or replace function public.report_totals(
  p_orders_from   timestamptz default null,
  p_orders_to     timestamptz default null,
  p_expenses_from date        default null,
  p_expenses_to   date        default null,
  p_refund_policy text        default 'status_only'
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v jsonb;
begin
  if p_refund_policy not in ('status_only', 'subtract_return_refunds') then
    raise exception 'Unknown refund policy %', p_refund_policy using errcode = '22023';
  end if;

  with o as (
    select id, coalesce(total, 0) as total, coalesce(tax_total, 0) as tax_total,
           (lower(coalesce(status, '')) like '%cancel%'
            or (lower(coalesce(status, '')) like '%refund%' and lower(coalesce(status, '')) not like '%partial%')) as excluded
      from orders
     where deleted_at is null
       and (p_orders_from is null or placed_at >= p_orders_from)
       and (p_orders_to   is null or placed_at <  p_orders_to)
  ), e as (
    select coalesce(amount, 0) as amount
      from expenses
     where deleted_at is null
       and (p_expenses_from is null or expense_date >= p_expenses_from)
       and (p_expenses_to   is null or expense_date <  p_expenses_to)
  ), r as (
    select coalesce(sum(rt.refund_amount), 0) as amount
      from returns rt
     where p_refund_policy = 'subtract_return_refunds'
       and rt.refund_amount is not null
       and (p_orders_from is null or rt.refunded_at >= p_orders_from)
       and (p_orders_to   is null or rt.refunded_at <  p_orders_to)
       and not exists (select 1 from o where o.id = rt.order_id and o.excluded)
  )
  select jsonb_build_object(
    'orders_count',    (select count(*) from o),
    'revenue_gross',   (select coalesce(sum(total) filter (where not excluded), 0) from o),
    'excluded',        (select coalesce(sum(total) filter (where excluded), 0) from o),
    'sales_tax',       (select coalesce(sum(tax_total) filter (where not excluded), 0) from o),
    'return_refunds',  (select amount from r),
    'revenue',         (select coalesce(sum(total) filter (where not excluded), 0) from o) - (select amount from r),
    'expenses_count',  (select count(*) from e),
    'expenses_total',  (select coalesce(sum(amount), 0) from e)
  ) into v;
  return v;
end;
$$;

revoke all on function public.report_totals(timestamptz, timestamptz, date, date, text) from public, anon;
grant execute on function public.report_totals(timestamptz, timestamptz, date, date, text) to authenticated;

-- Rollback: drop function if exists public.report_totals(timestamptz, timestamptz, date, date, text);
-- (Revert the dashboard PR that calls it first; the paged browser version keeps working.)
