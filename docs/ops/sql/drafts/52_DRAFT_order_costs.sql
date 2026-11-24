-- DRAFT (2026-11-24). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   52   (PRODUCTION-CHANGE-DRAFT, step optional (owner request of Nov 23: exact fees and postage per order instead of estimates in Real profit))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if an order_costs table exists that this file did not create (it checks its own mark); stops if auth.uid(), is_owner_or_admin(), the orders, tasks or audit_log table, or the audit trigger on tasks is missing
-- @effect:      1 new table order_costs (one row per order: real fee and real postage in cents, each with its source, who saved it and when); set_order_costs() saves up to 500 orders at once, keeps a part that is not given, skips orders that do not exist; rows never deleted, never moved to another order; only the owner and administrators read and write; production's audit trigger attached; no existing table changes
-- @postcheck:   the table present and empty; anon cannot read it; local-test/order_costs_test.sh passes on a throwaway copy
-- @rollback:    drafts/53
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 53_DRAFT_rollback_order_costs.sql.
-- Tested only on the local throwaway database (local-test/order_costs_test.sh).
--
-- Why (owner, Nov 23: "how can we fix this problem? They are estimates, not the
-- exact fee per order"): Real profit should use what each order really cost
-- wherever a platform records it, and an estimate only where nothing is known.
--   * order_costs   one row per order: the real platform fee and the real postage,
--     each with where the figure came from (the channel's own money report, a
--     Shopify Shipping label, or typed by hand), who saved it and when. Either
--     part may be missing: a missing part stays an estimate on the screen.
--   * set_order_costs(rows)   saves up to 500 orders at once. A part that is not
--     given keeps the value already saved (the fee and the postage often arrive
--     from different places). Orders that do not exist are counted and skipped.
--   * A row is replaced, never deleted from the dashboard; every change lands in
--     audit_log with who and when.
--
-- Money figures only: no customer details. Amounts are whole cents.
--
-- Who can see and do what: the owner and administrators read and save (money is
-- for them only, owner decision of Nov 23); staff and visitors nothing.
-- SECURITY INVOKER throughout (project rule). Production's own audit trigger
-- (the one on `tasks`) is attached.
--
-- Honest limits
--   * It stores what it is given; it does not fetch fees from any platform.
--   * It refuses to install over a table called order_costs that it did not
--     create itself (it checks its own mark), and changes no existing table.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_order_costs_install'));

do $pre$
declare
  missing text[] := '{}';
  v_tg record;
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regclass('public.orders') is null then missing := missing || 'table public.orders'::text; end if;
  if to_regclass('public.tasks') is null then missing := missing || 'table public.tasks (its audit trigger is reused)'::text; end if;
  if to_regclass('public.audit_log') is null then missing := missing || 'table public.audit_log'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
  if to_regclass('public.order_costs') is not null
     and coalesce(obj_description(to_regclass('public.order_costs'), 'pg_class'), '') <> 'Health Endeavors drafts/52: the real fee and postage of each order' then
    raise exception 'Not installed: a table public.order_costs already exists and was not created by this file. Nothing was changed; show this message before going further.';
  end if;
  select t.tgtype into v_tg from pg_trigger t
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  if not found then
    raise exception 'Not installed: the audit trigger on public.tasks was not found, so order costs could not be audited the same way.';
  end if;
  if (v_tg.tgtype & 1) = 0 or (v_tg.tgtype & 2) <> 0 or (v_tg.tgtype & 4) = 0 or (v_tg.tgtype & 8) = 0 or (v_tg.tgtype & 16) = 0 then
    raise exception 'Not installed: the audit trigger on public.tasks is not an AFTER INSERT OR UPDATE OR DELETE row trigger (type %); it cannot be reused as is.', v_tg.tgtype;
  end if;
end
$pre$;

create table if not exists public.order_costs (
  order_id       uuid primary key references public.orders(id),
  fee_cents      integer check (fee_cents is null or fee_cents between 0 and 100000000),
  fee_source     text check (fee_source is null or fee_source in ('shopify', 'amazon', 'etsy', 'tiktok', 'manual')),
  postage_cents  integer check (postage_cents is null or postage_cents between 0 and 100000000),
  postage_source text check (postage_source is null or postage_source in ('shopify_shipping', 'amazon', 'etsy', 'tiktok', 'manual')),
  updated_by     uuid not null default auth.uid(),
  updated_at     timestamptz not null default now(),
  constraint order_costs_fee_pair check ((fee_cents is null) = (fee_source is null)),
  constraint order_costs_postage_pair check ((postage_cents is null) = (postage_source is null)),
  constraint order_costs_something check (fee_cents is not null or postage_cents is not null)
);
comment on table public.order_costs is 'Health Endeavors drafts/52: the real fee and postage of each order';

-- Only the owner and administrators save. A row is replaced, never deleted; its order never changes.
create or replace function public.order_costs_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'The real costs of an order stay on the record; save the corrected figures instead.' using errcode = '42501';
  end if;
  if not coalesce(public.is_owner_or_admin(), false) then
    raise exception 'Only the owner and administrators can save order costs.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.order_id is distinct from old.order_id then
    raise exception 'Costs belong to their order and cannot be moved to another one.' using errcode = '42501';
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end
$fn$;
drop trigger if exists order_costs_guard on public.order_costs;
create trigger order_costs_guard before insert or update or delete on public.order_costs
  for each row execute function public.order_costs_guard();

-- ---------------------------------------------------------------- save the real costs of up to 500 orders
-- p_rows: [{ "order_id": uuid, "fee_cents": int|null, "fee_source": text|null,
--            "postage_cents": int|null, "postage_source": text|null }, ...]
-- A part that is null keeps what is already saved for that order.
create or replace function public.set_order_costs(p_rows jsonb) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  r jsonb;
  v_id uuid;
  v_saved integer := 0;
  v_unknown integer := 0;
begin
  if not coalesce(public.is_owner_or_admin(), false) then
    raise exception 'Only the owner and administrators can save order costs.' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Give the orders as a list.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'At most 500 orders at a time (this list has %).', jsonb_array_length(p_rows) using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      v_id := (r->>'order_id')::uuid;
    exception when others then
      raise exception 'An order in the list has no valid id.' using errcode = '22023';
    end;
    if v_id is null then raise exception 'An order in the list has no valid id.' using errcode = '22023'; end if;
    if not exists (select 1 from public.orders o where o.id = v_id) then
      v_unknown := v_unknown + 1;
      continue;
    end if;
    insert into public.order_costs (order_id, fee_cents, fee_source, postage_cents, postage_source)
      values (v_id, (r->>'fee_cents')::integer, r->>'fee_source', (r->>'postage_cents')::integer, r->>'postage_source')
      on conflict (order_id) do update set
        fee_cents      = coalesce(excluded.fee_cents, public.order_costs.fee_cents),
        fee_source     = case when excluded.fee_cents is null then public.order_costs.fee_source else excluded.fee_source end,
        postage_cents  = coalesce(excluded.postage_cents, public.order_costs.postage_cents),
        postage_source = case when excluded.postage_cents is null then public.order_costs.postage_source else excluded.postage_source end;
    v_saved := v_saved + 1;
  end loop;
  return jsonb_build_object('ok', true, 'saved', v_saved, 'unknown_orders', v_unknown);
end
$fn$;

-- ---------------------------------------------------------------- audit: production's own audit trigger
-- Dynamic only because the function's name is read from production at install time.
do $audit$
declare
  v_nsp text;
  v_fn  text;
begin
  select n.nspname, p.proname into v_nsp, v_fn
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  execute format('drop trigger if exists %I on public.%I', 'order_costs_audit', 'order_costs');
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function %I.%I()',
                 'order_costs_audit', 'order_costs', v_nsp, v_fn);
end $audit$;

-- ---------------------------------------------------------------- who can see and do what
alter table public.order_costs enable row level security;
revoke all on public.order_costs from public, anon;
grant select, insert, update on public.order_costs to authenticated;
drop policy if exists order_costs_read on public.order_costs;
create policy order_costs_read on public.order_costs for select to authenticated using (public.is_owner_or_admin());
drop policy if exists order_costs_add on public.order_costs;
create policy order_costs_add on public.order_costs for insert to authenticated with check (public.is_owner_or_admin());
drop policy if exists order_costs_change on public.order_costs;
create policy order_costs_change on public.order_costs for update to authenticated
  using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());

revoke all on function public.set_order_costs(jsonb) from public, anon;
revoke all on function public.order_costs_guard() from public, anon;
grant execute on function public.set_order_costs(jsonb) to authenticated;

commit;
