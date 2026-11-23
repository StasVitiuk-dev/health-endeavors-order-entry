-- DRAFT (2026-11-23). NOT INSTALLED. Rollback of 46_DRAFT_tax_rates.sql.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   47   (ROLLBACK, rolls back 46)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, while any tax rate is recorded, unless deleting them was authorized in the session
-- @effect:      drops the two functions, the table and its guard
-- @postcheck:   to_regclass('public.tax_rates') is null
-- @rollback:    (this file is the rollback of drafts/46)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the tax rates table and its functions. Changes no other table; issued
-- invoices keep their own copy of the rate they used.
-- STOPS, and removes nothing, while any rate is recorded: those are the record of
-- what the owner confirmed, when and from which source. Export them first;
-- deleting them must be authorized in the same session:
--     set he.rollback_delete_tax_rates = 'yes, delete the tax rates';
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_tax_rates_install'));

do $guard$
declare v_rows bigint := 0;
begin
  if to_regclass('public.tax_rates') is not null then
    execute format('lock table %I.%I in access exclusive mode', 'public', 'tax_rates');
    execute format('select count(*) from %I.%I', 'public', 'tax_rates') into v_rows;
  end if;
  if v_rows > 0 and coalesce(current_setting('he.rollback_delete_tax_rates', true), '') <> 'yes, delete the tax rates' then
    raise exception 'Rollback stopped: % tax rate(s) are recorded. Export them, then authorize deleting them in this session.', v_rows;
  end if;
end
$guard$;

-- the guard refuses deletes row by row; dropping the table removes the rows without it
drop function if exists public.recheck_tax_rate(uuid);
drop function if exists public.set_tax_rate(text, numeric, date, text, text);
drop table if exists public.tax_rates;
drop function if exists public.tax_rates_guard();

commit;
