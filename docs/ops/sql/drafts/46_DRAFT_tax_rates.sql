-- DRAFT (2026-11-23). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   46   (PRODUCTION-CHANGE-DRAFT, step optional (before the first real invoice; owner request of Nov 23: never charge too little or too much))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops if auth.uid(), current_role(), is_active_staff(), is_owner_or_admin(), the tasks or audit_log table, or the audit trigger on tasks is missing
-- @effect:      1 new table tax_rates (one row per confirmed rate per place: rate, start day, end day, source, who confirmed it and when, last re-check); set_tax_rate() ends the rate in force the day before the new one starts; recheck_tax_rate(); rates never deleted or edited; only the owner writes; active staff read; production's audit trigger attached; no existing table changes
-- @postcheck:   the table present and empty; anon cannot read it; local-test/tax_rates_test.sh passes on a throwaway copy
-- @rollback:    drafts/47
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 47_DRAFT_rollback_tax_rates.sql.
-- Tested only on the local throwaway database (local-test/tax_rates_test.sh).
--
-- Why (owner, Nov 23: "I don't want to charge too little or too much"): the sales
-- tax rate the owner confirmed, kept where every invoice can use it, with who
-- confirmed it, from which source, from which day, and when it was last
-- re-checked (Illinois rates can change on January 1 and July 1).
--   * tax_rates   one row per rate per place: the rate, the day it starts, the
--     day it ends (empty = still in force), the source ("IDOR Tax Rate Finder"),
--     who confirmed it and when, when it was last re-checked and by whom.
--     `place` is a short NAME for the place ("Ships from: Illinois"), never a
--     street address (the owner's address stays private).
--   * set_tax_rate(place, rate, from, source, note)   the owner confirms a rate;
--     a rate still in force for the same place ends the day before the new one
--     starts, in the same transaction; a rate never overlaps another for the same
--     place; the same confirmation twice is one row.
--   * recheck_tax_rate(id)   the owner says "re-checked today, still correct".
--   * A rate is never deleted and never edited: a change is a new rate. Only its
--     end day (once) and its re-check date move.
--
-- Who can see and do what: the owner confirms, ends and re-checks rates; every
-- active staff member, administrators included, can read them (they are printed
-- on invoices); visitors nothing. SECURITY INVOKER throughout (project rule).
-- Production's own audit trigger (the one on `tasks`) is attached, so every
-- change also lands in audit_log with who and when.
--
-- Honest limits
--   * This stores the owner's confirmed rates only; it does not look rates up.
--   * Invoices keep their own copy of the rate at issue (drafts/32), so changing
--     a rate later never changes an issued invoice.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_tax_rates_install'));

do $pre$
declare
  missing text[] := '{}';
  v_tg record;
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.current_role()') is null then missing := missing || 'function public.current_role()'::text; end if;
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regclass('public.tasks') is null then missing := missing || 'table public.tasks (its audit trigger is reused)'::text; end if;
  if to_regclass('public.audit_log') is null then missing := missing || 'table public.audit_log'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
  select t.tgtype into v_tg from pg_trigger t
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  if not found then
    raise exception 'Not installed: the audit trigger on public.tasks was not found, so tax rates could not be audited the same way.';
  end if;
  if (v_tg.tgtype & 1) = 0 or (v_tg.tgtype & 2) <> 0 or (v_tg.tgtype & 4) = 0 or (v_tg.tgtype & 8) = 0 or (v_tg.tgtype & 16) = 0 then
    raise exception 'Not installed: the audit trigger on public.tasks is not an AFTER INSERT OR UPDATE OR DELETE row trigger (type %); it cannot be reused as is.', v_tg.tgtype;
  end if;
end
$pre$;

create table if not exists public.tax_rates (
  id              uuid primary key default gen_random_uuid(),
  place           text not null check (length(btrim(place)) between 2 and 80),
  rate            numeric(7,5) not null check (rate >= 0 and rate <= 0.25),
  effective_from  date not null,
  effective_until date,
  source          text not null check (length(btrim(source)) between 3 and 200),
  note            text check (note is null or length(note) <= 300),
  confirmed_by    uuid not null default auth.uid(),
  confirmed_at    timestamptz not null default now(),
  rechecked_at    date,
  rechecked_by    uuid,
  constraint tax_rates_ends_after_start check (effective_until is null or effective_until >= effective_from),
  constraint tax_rates_recheck_pair check ((rechecked_at is null) = (rechecked_by is null))
);
create index if not exists tax_rates_by_place on public.tax_rates (lower(btrim(place)), effective_from);

-- Rows are confirmations: never deleted, never edited. Only the end day (once)
-- and the re-check date move, and only the owner moves them.
create or replace function public.tax_rates_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v_clash record;
begin
  if tg_op = 'DELETE' then
    raise exception 'A confirmed tax rate stays on the record; end it instead.' using errcode = '42501';
  end if;
  if coalesce(public.current_role(), '') <> 'owner' then
    raise exception 'Only the owner can confirm, end or re-check a tax rate.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.place := btrim(new.place); new.source := btrim(new.source);
    new.note := nullif(btrim(coalesce(new.note, '')), '');
    new.confirmed_by := auth.uid(); new.confirmed_at := now();
    new.rechecked_at := null; new.rechecked_by := null;
    perform pg_advisory_xact_lock(hashtext('health_endeavors_tax_rate:' || lower(new.place)));
    select id, effective_from, effective_until into v_clash from public.tax_rates
     where lower(btrim(place)) = lower(new.place)
       and daterange(effective_from, effective_until, '[]') && daterange(new.effective_from, new.effective_until, '[]')
     limit 1;
    if found then
      raise exception 'Another rate for % is already in force from % (until %); end it first.', new.place, v_clash.effective_from, coalesce(v_clash.effective_until::text, 'no end date')
        using errcode = '23P01';
    end if;
    return new;
  end if;
  -- UPDATE
  if new.place is distinct from old.place or new.rate is distinct from old.rate or new.effective_from is distinct from old.effective_from
     or new.source is distinct from old.source or new.note is distinct from old.note
     or new.confirmed_by is distinct from old.confirmed_by or new.confirmed_at is distinct from old.confirmed_at then
    raise exception 'A confirmed rate cannot be edited; confirm a new rate instead.' using errcode = '42501';
  end if;
  if new.effective_until is distinct from old.effective_until then
    if old.effective_until is not null then
      raise exception 'This rate already ended on %.', old.effective_until using errcode = '22023';
    end if;
    if new.effective_until is null or new.effective_until < old.effective_from then
      raise exception 'A rate cannot end before it starts.' using errcode = '22023';
    end if;
  end if;
  if new.rechecked_at is distinct from old.rechecked_at or new.rechecked_by is distinct from old.rechecked_by then
    new.rechecked_at := (now() at time zone 'America/Chicago')::date;
    new.rechecked_by := auth.uid();
  end if;
  return new;
end
$fn$;
drop trigger if exists tax_rates_guard on public.tax_rates;
create trigger tax_rates_guard before insert or update or delete on public.tax_rates
  for each row execute function public.tax_rates_guard();

-- ---------------------------------------------------------------- the owner confirms a rate
-- A rate still in force for the same place, started earlier, ends the day before
-- the new one starts (same transaction). The same confirmation twice is one row.
create or replace function public.set_tax_rate(p_place text, p_rate numeric, p_from date, p_source text, p_note text default null) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_place text := btrim(coalesce(p_place, ''));
  v_old public.tax_rates%rowtype;
  v_new public.tax_rates%rowtype;
begin
  if coalesce(public.current_role(), '') <> 'owner' then
    raise exception 'Only the owner can confirm a tax rate.' using errcode = '42501';
  end if;
  if p_from is null then raise exception 'Say from which day the rate applies.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('health_endeavors_tax_rate:' || lower(v_place)));
  select * into v_old from public.tax_rates
   where lower(btrim(place)) = lower(v_place) and effective_until is null
   order by effective_from desc limit 1;
  if found then
    if v_old.effective_from = p_from and v_old.rate = round(p_rate, 5) then
      return jsonb_build_object('ok', true, 'duplicate', true, 'id', v_old.id);
    end if;
    if v_old.effective_from >= p_from then
      raise exception 'The rate in force for % started on %; a new rate must start after that day.', v_place, v_old.effective_from using errcode = '23P01';
    end if;
    update public.tax_rates set effective_until = p_from - 1 where id = v_old.id;
  end if;
  insert into public.tax_rates (place, rate, effective_from, source, note)
    values (v_place, round(p_rate, 5), p_from, p_source, p_note)
    returning * into v_new;
  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v_new.id, 'ended', case when v_old.id is null then null else v_old.id end);
end
$fn$;

-- ---------------------------------------------------------------- re-checked, still correct
create or replace function public.recheck_tax_rate(p_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v public.tax_rates%rowtype;
begin
  if coalesce(public.current_role(), '') <> 'owner' then
    raise exception 'Only the owner can re-check a tax rate.' using errcode = '42501';
  end if;
  select * into v from public.tax_rates where id = p_id;
  if not found then raise exception 'No such tax rate.' using errcode = 'P0002'; end if;
  if v.effective_until is not null and v.effective_until < (now() at time zone 'America/Chicago')::date then
    raise exception 'This rate already ended on %; confirm the rate that applies now instead.', v.effective_until using errcode = '22023';
  end if;
  update public.tax_rates set rechecked_at = (now() at time zone 'America/Chicago')::date, rechecked_by = auth.uid() where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'id', v.id, 'rechecked_at', v.rechecked_at);
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
  execute format('drop trigger if exists %I on public.%I', 'tax_rates_audit', 'tax_rates');
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function %I.%I()',
                 'tax_rates_audit', 'tax_rates', v_nsp, v_fn);
end $audit$;

-- ---------------------------------------------------------------- who can see and do what
alter table public.tax_rates enable row level security;
revoke all on public.tax_rates from public, anon;
grant select, insert, update on public.tax_rates to authenticated;
drop policy if exists tax_rates_read on public.tax_rates;
create policy tax_rates_read on public.tax_rates for select to authenticated using (public.is_active_staff() or public.is_owner_or_admin());
drop policy if exists tax_rates_owner_add on public.tax_rates;
create policy tax_rates_owner_add on public.tax_rates for insert to authenticated with check (coalesce(public.current_role(), '') = 'owner');
drop policy if exists tax_rates_owner_change on public.tax_rates;
create policy tax_rates_owner_change on public.tax_rates for update to authenticated
  using (coalesce(public.current_role(), '') = 'owner') with check (coalesce(public.current_role(), '') = 'owner');

revoke all on function public.set_tax_rate(text, numeric, date, text, text) from public, anon;
revoke all on function public.recheck_tax_rate(uuid) from public, anon;
revoke all on function public.tax_rates_guard() from public, anon;
grant execute on function public.set_tax_rate(text, numeric, date, text, text) to authenticated;
grant execute on function public.recheck_tax_rate(uuid) to authenticated;

commit;
