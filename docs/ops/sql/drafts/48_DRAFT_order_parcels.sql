-- DRAFT (2026-11-24). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   48   (PRODUCTION-CHANGE-DRAFT, step optional (before the scan page marks parcels dropped off; owner request of Nov 23: one drop-off receipt updates every order on it))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if the Shipping/Tracking agent's shipments table is missing or lacks order_id, carrier or tracking_number (it is only read); stops if an order_parcels or order_parcel_events table, or a function with one of this draft's names, exists that this draft did not create (it checks its own marks); stops if auth.uid(), is_active_staff(), is_owner_or_admin(), the orders, tasks or audit_log table, or the audit trigger on tasks is missing
-- @effect:      2 new tables of its own: order_parcels (one row per parcel: order, carrier, tracking number unique per carrier, status, dropped-off and delivered times, how and by whom it was added) and order_parcel_events (the parcel's diary, written by the database only); add_order_parcel() keeps a tracking number with its order (refused on a different order); mark_parcels_dropped_off() marks every parcel on a receipt (up to 500) once, looking a label it has not seen up in the agent's shipments table (read only); status only moves forward; nothing is deleted; the agent's shipments table is never changed
-- @postcheck:   both tables present and empty; anon cannot read them; public.shipments has the same columns, rules, triggers and links as before; local-test/order_parcels_test.sh passes on a throwaway copy
-- @rollback:    drafts/49
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 49_DRAFT_rollback_order_parcels.sql.
-- Tested only on the local throwaway database (local-test/order_parcels_test.sh).
--
-- Why (owner, Nov 23: "if I have 100 orders that I brought to UPS I can just scan
-- the receipt and it updates every order"): each parcel's tracking number is kept
-- with its order, and a drop-off receipt marks every parcel on it "dropped off" in
-- one step, with who and when. The same rows are what the delivery watch (gap 7 in
-- docs/ops/OPERATIONS_CHAIN_ALL_CHANNELS.md) follows.
--
-- ADAPTED Nov 24 to production as it is (read-only shape check of Nov 23,
-- docs/ops/shapes/PRODUCTION_SHAPES_2026-11-23.md): production already has a
-- `shipments` table, the Shipping/Tracking agent's. This draft now keeps its own
-- records in its OWN two tables and never changes that one:
--   * public.shipments (the agent's) is only READ, in one place: when a drop-off
--     receipt carries a label this draft has not seen, the label's order is looked
--     up there. No column, rule, guard, trigger or link is added to it, so the
--     agent can go on inserting, changing and deleting its rows exactly as today.
--   * order_parcels        one row per parcel: the order, the carrier, the tracking
--     number (unique per carrier), its status, when it was dropped off and
--     delivered, how it was added (scan, typed, channel, import, or "agent" when
--     first found in the agent's table), who added it.
--   * order_parcel_events  the parcel's diary: every status it took, when, who.
--     Written by the database itself on every status change; never edited or
--     deleted.
--   * add_order_parcel(order, carrier, tracking, source)   keeps a tracking number
--     with its order. The same number on the same order again is one row; on a
--     DIFFERENT order it is refused (one label belongs to one parcel).
--   * mark_parcels_dropped_off(tracking numbers)   one call for a whole receipt (up
--     to 500 numbers): each known parcel that is still "label created" becomes
--     "dropped off"; a label known only to the agent's table is added first; each
--     number gets its own answer (marked, already further along, not found, on two
--     orders, or not marked because it was cancelled or returned). Pressing it
--     twice changes nothing the second time.
--
-- Who can see and do what: every active team member (packing is staff work),
-- administrators and the owner read parcels and can add and mark them; a
-- deactivated account and visitors nothing. Status only moves forward, and the
-- order, carrier and tracking number of a parcel never change after it is added.
-- SECURITY INVOKER throughout (project rule), so reading the agent's table follows
-- that table's own rules for the person signed in. Production's own audit trigger
-- (the one on `tasks`) is attached to order_parcels, so every change also lands in
-- audit_log with who and when.
--
-- Honest limits
--   * The agent's table had 0 rows on Nov 23, so its status words are not known.
--     Nothing here reads or writes its status; "dropped off" is what the owner's
--     receipt says. The carrier's own tracking stays the agent's job.
--   * If the agent later stores one label under two different orders, a receipt
--     with that label answers "on two orders" and marks nothing for it.
--   * Nothing here contacts a carrier or a customer.
--   * No existing table changes; orders and the agent's shipments are only read.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_order_parcels_install'));

do $pre$
declare
  missing text[] := '{}';
  v_tg record;
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regclass('public.orders') is null then missing := missing || 'table public.orders'::text; end if;
  if to_regclass('public.tasks') is null then missing := missing || 'table public.tasks (its audit trigger is reused)'::text; end if;
  if to_regclass('public.audit_log') is null then missing := missing || 'table public.audit_log'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
  -- The Shipping/Tracking agent's own table (public.shipments) is only READ by this
  -- draft, to find the order of a label the agent already knows. It is never changed:
  -- no column, rule, guard or link is added to it. The three columns read must exist.
  if to_regclass('public.shipments') is null then
    raise exception 'Not installed: table public.shipments (the Shipping/Tracking agent''s, only read here) is missing. Nothing was changed.';
  end if;
  select array_agg(c) into missing from unnest(array['order_id', 'carrier', 'tracking_number']) c
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'shipments' and column_name = c);
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: public.shipments has no column % (its shape changed since the read-only check of Nov 23). Nothing was changed. Send this message to the session.', array_to_string(missing, ', ');
  end if;
  -- This draft's own objects: installed only where the name is free, or already this
  -- draft's own (marked below). Otherwise it stops and changes nothing.
  if to_regclass('public.order_parcels') is not null
     and coalesce(obj_description(to_regclass('public.order_parcels'), 'pg_class'), '') <> 'Health Endeavors drafts/48: parcels and drop-off receipts' then
    raise exception 'Not installed: an order_parcels table already exists that this draft did not create. Nothing was changed. Send this message to the session.';
  end if;
  if to_regclass('public.order_parcel_events') is not null
     and coalesce(obj_description(to_regclass('public.order_parcel_events'), 'pg_class'), '') <> 'Health Endeavors drafts/48: parcel diary' then
    raise exception 'Not installed: an order_parcel_events table already exists that this draft did not create. Nothing was changed. Send this message to the session.';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('add_order_parcel', 'mark_parcels_dropped_off', 'order_parcels_guard', 'order_parcels_diary', 'order_parcel_events_guard')
                and coalesce(obj_description(p.oid, 'pg_proc'), '') <> 'Health Endeavors drafts/48') then
    raise exception 'Not installed: a function with one of this draft''s names already exists that this draft did not create. Nothing was changed. Send this message to the session.';
  end if;
  select t.tgtype into v_tg from pg_trigger t
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  if not found then
    raise exception 'Not installed: the audit trigger on public.tasks was not found, so parcels could not be audited the same way.';
  end if;
  if (v_tg.tgtype & 1) = 0 or (v_tg.tgtype & 2) <> 0 or (v_tg.tgtype & 4) = 0 or (v_tg.tgtype & 8) = 0 or (v_tg.tgtype & 16) = 0 then
    raise exception 'Not installed: the audit trigger on public.tasks is not an AFTER INSERT OR UPDATE OR DELETE row trigger (type %); it cannot be reused as is.', v_tg.tgtype;
  end if;
end
$pre$;

create table if not exists public.order_parcels (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id),
  carrier         text not null check (carrier in ('ups', 'usps', 'fedex', 'dhl', 'other')),
  tracking_number text not null check (tracking_number ~ '^[A-Z0-9]{8,40}$'),
  status          text not null default 'label_created'
                  check (status in ('label_created', 'dropped_off', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned', 'cancelled')),
  source          text not null default 'scan' check (source in ('scan', 'typed', 'channel', 'import', 'agent')),
  dropped_off_at  timestamptz,
  delivered_at    timestamptz,
  status_at       timestamptz not null default now(),
  created_by      uuid not null default auth.uid(),
  created_at      timestamptz not null default now(),
  constraint order_parcels_one_parcel_per_label unique (carrier, tracking_number)
);
comment on table public.order_parcels is 'Health Endeavors drafts/48: parcels and drop-off receipts';
create index if not exists order_parcels_by_order on public.order_parcels (order_id);
create index if not exists order_parcels_by_tracking on public.order_parcels (tracking_number);
create index if not exists order_parcels_open on public.order_parcels (status, status_at) where status not in ('delivered', 'returned', 'cancelled');

create table if not exists public.order_parcel_events (
  id           bigint generated always as identity primary key,
  parcel_id  uuid not null references public.order_parcels(id),
  status       text not null,
  at           timestamptz not null default now(),
  recorded_by  uuid default auth.uid()
);
comment on table public.order_parcel_events is 'Health Endeavors drafts/48: parcel diary';
create index if not exists order_parcel_events_by_parcel on public.order_parcel_events (parcel_id, at);

-- Status only moves forward; a parcel's order, carrier and number never change.
create or replace function public.order_parcels_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_next text[];
begin
  if tg_op = 'DELETE' then
    raise exception 'A parcel stays on the record; mark it cancelled instead.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.tracking_number := upper(regexp_replace(coalesce(new.tracking_number, ''), '[^A-Za-z0-9]', '', 'g'));
    new.status := 'label_created'; new.status_at := now();
    new.dropped_off_at := null; new.delivered_at := null;
    new.created_by := auth.uid(); new.created_at := now();
    return new;
  end if;
  if new.order_id is distinct from old.order_id or new.carrier is distinct from old.carrier
     or new.tracking_number is distinct from old.tracking_number or new.source is distinct from old.source
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'A parcel''s order, carrier and tracking number cannot be changed; cancel it and add the right one.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    v_next := case old.status
      when 'label_created'    then array['dropped_off', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'cancelled']
      when 'dropped_off'      then array['in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned']
      when 'in_transit'       then array['out_for_delivery', 'delivered', 'exception', 'returned']
      when 'out_for_delivery' then array['delivered', 'exception', 'returned']
      when 'exception'        then array['in_transit', 'out_for_delivery', 'delivered', 'returned']
      else array[]::text[] end;
    if not (new.status = any (v_next)) then
      raise exception 'A parcel that is % cannot become %.', replace(old.status, '_', ' '), replace(new.status, '_', ' ') using errcode = '22023';
    end if;
    new.status_at := now();
    if new.status <> 'cancelled' and new.status <> 'exception' and old.dropped_off_at is null then new.dropped_off_at := now(); end if;
    if new.status = 'delivered' then new.delivered_at := now(); end if;
  else
    new.status_at := old.status_at; new.dropped_off_at := old.dropped_off_at; new.delivered_at := old.delivered_at;
  end if;
  return new;
end
$fn$;
drop trigger if exists order_parcels_guard on public.order_parcels;
create trigger order_parcels_guard before insert or update or delete on public.order_parcels
  for each row execute function public.order_parcels_guard();

-- The diary is written by the database on every status the parcel takes.
create or replace function public.order_parcels_diary() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_parcel_events (parcel_id, status) values (new.id, new.status);
  end if;
  return null;
end
$fn$;
drop trigger if exists order_parcels_diary on public.order_parcels;
create trigger order_parcels_diary after insert or update on public.order_parcels
  for each row execute function public.order_parcels_diary();

create or replace function public.order_parcel_events_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op <> 'INSERT' then
    raise exception 'The parcel diary is written by the database only and is never changed.' using errcode = '42501';
  end if;
  if pg_trigger_depth() < 2 then
    raise exception 'The parcel diary is written by the database only.' using errcode = '42501';
  end if;
  new.at := now(); new.recorded_by := auth.uid();
  return new;
end
$fn$;
drop trigger if exists order_parcel_events_guard on public.order_parcel_events;
create trigger order_parcel_events_guard before insert or update or delete on public.order_parcel_events
  for each row execute function public.order_parcel_events_guard();

-- ---------------------------------------------------------------- keep a tracking number with its order
create or replace function public.add_order_parcel(p_order_id uuid, p_carrier text, p_tracking text, p_source text default 'scan') returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_tracking text := upper(regexp_replace(coalesce(p_tracking, ''), '[^A-Za-z0-9]', '', 'g'));
  v_carrier text := lower(btrim(coalesce(p_carrier, '')));
  v_old public.order_parcels%rowtype;
  v_new public.order_parcels%rowtype;
begin
  if not (public.is_active_staff() or public.is_owner_or_admin()) then
    raise exception 'Only an active team member can add a parcel.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.orders where id = p_order_id and deleted_at is null) then
    raise exception 'That order does not exist (or was deleted).' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('health_endeavors_parcel:' || v_carrier || ':' || v_tracking));
  select * into v_old from public.order_parcels where carrier = v_carrier and tracking_number = v_tracking;
  if found then
    if v_old.order_id = p_order_id then
      return jsonb_build_object('ok', true, 'duplicate', true, 'id', v_old.id);
    end if;
    raise exception 'Tracking number % is already on another order. One label belongs to one parcel.', v_tracking using errcode = '23505';
  end if;
  insert into public.order_parcels (order_id, carrier, tracking_number, source)
    values (p_order_id, v_carrier, v_tracking, coalesce(nullif(btrim(p_source), ''), 'scan'))
    returning * into v_new;
  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v_new.id);
end
$fn$;

-- ---------------------------------------------------------------- one receipt marks every parcel on it
-- A number is looked up among this draft's own parcels first. One that is not there
-- yet may already be known to the Shipping/Tracking agent (a label bought in
-- Shopify): its order is then READ from public.shipments and the parcel is added
-- here (source 'agent') and marked. public.shipments itself is never written.
create or replace function public.mark_parcels_dropped_off(p_trackings text[]) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_list text[];
  v_t text;
  v_rows public.order_parcels[];
  v_s public.order_parcels%rowtype;
  v_orders uuid[];
  v_carrier text;
  v_out jsonb := '[]'::jsonb;
begin
  if not (public.is_active_staff() or public.is_owner_or_admin()) then
    raise exception 'Only an active team member can mark parcels dropped off.' using errcode = '42501';
  end if;
  select array_agg(distinct t order by t) into v_list
    from (select upper(regexp_replace(coalesce(x, ''), '[^A-Za-z0-9]', '', 'g')) as t from unnest(coalesce(p_trackings, '{}'::text[])) x) s
   where t <> '';
  if v_list is null then
    raise exception 'No tracking numbers were given.' using errcode = '22023';
  end if;
  if array_length(v_list, 1) > 500 then
    raise exception 'At most 500 tracking numbers at a time (% were given).', array_length(v_list, 1) using errcode = '22023';
  end if;
  foreach v_t in array v_list loop
    -- one label at a time, in the same order for everyone: two people marking the
    -- same receipt at the same moment wait for each other instead of doubling up
    perform pg_advisory_xact_lock(hashtext('health_endeavors_parcel_number:' || v_t));
    select array_agg(s order by s.created_at) into v_rows from public.order_parcels s where s.tracking_number = v_t;
    if v_rows is null then
      select array_agg(distinct a.order_id), min(lower(btrim(coalesce(a.carrier, ''))))
        into v_orders, v_carrier
        from public.shipments a
       where a.order_id is not null and a.tracking_number is not null
         and upper(regexp_replace(a.tracking_number, '[^A-Za-z0-9]', '', 'g')) = v_t;
      if v_orders is null then
        v_out := v_out || jsonb_build_object('tracking', v_t, 'result', 'not_found');
      elsif array_length(v_orders, 1) > 1 then
        v_out := v_out || jsonb_build_object('tracking', v_t, 'result', 'ambiguous');
      elsif v_t !~ '^[A-Z0-9]{8,40}$' then
        v_out := v_out || jsonb_build_object('tracking', v_t, 'result', 'not_found');
      else
        v_carrier := case when v_carrier like '%usps%' or v_carrier like '%postal%' then 'usps'
                          when v_carrier like '%ups%' or v_carrier like '%united parcel%' then 'ups'
                          when v_carrier like '%fedex%' or v_carrier like '%federal express%' then 'fedex'
                          when v_carrier like '%dhl%' then 'dhl'
                          else 'other' end;
        insert into public.order_parcels (order_id, carrier, tracking_number, source)
          values (v_orders[1], v_carrier, v_t, 'agent') returning * into v_s;
        update public.order_parcels set status = 'dropped_off' where id = v_s.id returning * into v_s;
        v_out := v_out || jsonb_build_object('tracking', v_t, 'result', 'marked', 'order_id', v_s.order_id, 'status', v_s.status, 'from_agent', true);
      end if;
    elsif array_length(v_rows, 1) > 1 then
      v_out := v_out || jsonb_build_object('tracking', v_t, 'result', 'ambiguous');
    else
      select * into v_s from public.order_parcels where id = (v_rows[1]).id for update;
      if v_s.status = 'label_created' then
        update public.order_parcels set status = 'dropped_off' where id = v_s.id returning * into v_s;
        v_out := v_out || jsonb_build_object('tracking', v_t, 'result', 'marked', 'order_id', v_s.order_id, 'status', v_s.status);
      elsif v_s.status in ('dropped_off', 'in_transit', 'out_for_delivery', 'delivered') then
        v_out := v_out || jsonb_build_object('tracking', v_t, 'result', 'already', 'order_id', v_s.order_id, 'status', v_s.status);
      else
        v_out := v_out || jsonb_build_object('tracking', v_t, 'result', 'not_marked', 'order_id', v_s.order_id, 'status', v_s.status);
      end if;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'results', v_out);
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
  execute format('drop trigger if exists %I on public.%I', 'order_parcels_audit', 'order_parcels');
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function %I.%I()',
                 'order_parcels_audit', 'order_parcels', v_nsp, v_fn);
end $audit$;

-- ---------------------------------------------------------------- who can see and do what
alter table public.order_parcels enable row level security;
alter table public.order_parcel_events enable row level security;
revoke all on public.order_parcels from public, anon;
revoke all on public.order_parcel_events from public, anon;
grant select, insert, update on public.order_parcels to authenticated;
grant select, insert on public.order_parcel_events to authenticated;
drop policy if exists order_parcels_read on public.order_parcels;
create policy order_parcels_read on public.order_parcels for select to authenticated using (public.is_active_staff() or public.is_owner_or_admin());
drop policy if exists order_parcels_team_add on public.order_parcels;
create policy order_parcels_team_add on public.order_parcels for insert to authenticated with check (public.is_active_staff() or public.is_owner_or_admin());
drop policy if exists order_parcels_team_change on public.order_parcels;
create policy order_parcels_team_change on public.order_parcels for update to authenticated
  using (public.is_active_staff() or public.is_owner_or_admin()) with check (public.is_active_staff() or public.is_owner_or_admin());
drop policy if exists order_parcel_events_read on public.order_parcel_events;
create policy order_parcel_events_read on public.order_parcel_events for select to authenticated using (public.is_active_staff() or public.is_owner_or_admin());
drop policy if exists order_parcel_events_diary on public.order_parcel_events;
create policy order_parcel_events_diary on public.order_parcel_events for insert to authenticated with check (public.is_active_staff() or public.is_owner_or_admin());

comment on function public.add_order_parcel(uuid, text, text, text) is 'Health Endeavors drafts/48';
comment on function public.mark_parcels_dropped_off(text[]) is 'Health Endeavors drafts/48';
comment on function public.order_parcels_guard() is 'Health Endeavors drafts/48';
comment on function public.order_parcels_diary() is 'Health Endeavors drafts/48';
comment on function public.order_parcel_events_guard() is 'Health Endeavors drafts/48';
revoke all on function public.add_order_parcel(uuid, text, text, text) from public, anon;
revoke all on function public.mark_parcels_dropped_off(text[]) from public, anon;
revoke all on function public.order_parcels_guard() from public, anon;
revoke all on function public.order_parcels_diary() from public, anon;
revoke all on function public.order_parcel_events_guard() from public, anon;
grant execute on function public.add_order_parcel(uuid, text, text, text) to authenticated;
grant execute on function public.mark_parcels_dropped_off(text[]) to authenticated;

commit;
