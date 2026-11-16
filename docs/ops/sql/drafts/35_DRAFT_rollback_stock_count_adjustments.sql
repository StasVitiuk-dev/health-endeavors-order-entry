-- DRAFT (2026-11-16). NOT INSTALLED. Rollback of 34_DRAFT_stock_count_adjustments.sql.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   35   (ROLLBACK, rolls back 34)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, if any approved or rejected adjustment exists (the record of decisions)
-- @effect:      drops the functions, the guard and the two tables; open or cancelled proposals and any grant are removed with them
-- @postcheck:   to_regclass('public.stock_count_adjustments') is null
-- @rollback:    (this file is the rollback of drafts/34)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the stock-count adjustment functions, the guard and the two tables.
-- It changes no other table and no stock figure.
--
-- STOPS, and removes nothing, if any adjustment has been approved or rejected:
-- those rows are the record of the owner's decisions. To remove the tables
-- then, export the rows first and take that decision separately — this file
-- will not do it. Open or cancelled proposals alone do not stop it; they are
-- counted in the notice and removed. A grant to an account is listed too.
-- Safe to run twice (IF EXISTS everywhere).
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_stock_count_adjustments_install'));

do $guard$
declare
  v_kept bigint := 0;
  v_open bigint := 0;
  v_grants bigint := 0;
begin
  if to_regclass('public.stock_count_adjustments') is not null then
    -- dynamic, so the statement is not planned where the table is missing
    execute format('select count(*) filter (where status in (%L, %L)), count(*) filter (where status not in (%L, %L)) from %I.%I',
      'approved', 'rejected', 'approved', 'rejected', 'public', 'stock_count_adjustments') into v_kept, v_open;
    if v_kept > 0 then
      raise exception 'Not rolled back: % approved or rejected stock-count adjustment(s) exist. They are the record of the decisions. Export them and decide separately.', v_kept;
    end if;
    if to_regclass('public.stock_count_approvers') is not null then
      execute format('select count(*) from %I.%I', 'public', 'stock_count_approvers') into v_grants;
    end if;
    raise notice 'Removing the stock-count adjustment tables. Open or cancelled proposals removed: %. Approval grants removed: %.', v_open, v_grants;
  else
    raise notice 'Nothing to remove: the stock-count adjustment tables are not installed.';
  end if;
end $guard$;

drop function if exists public.propose_stock_count_adjustment(uuid, text, integer, text);
drop function if exists public.approve_stock_count_adjustment(uuid);
drop function if exists public.reject_stock_count_adjustment(uuid, text);
drop function if exists public.cancel_stock_count_adjustment(uuid);
drop function if exists public.grant_stock_count_approval(uuid, text);
drop function if exists public.revoke_stock_count_approval(uuid);
drop table if exists public.stock_count_adjustments;
drop function if exists public.stock_count_adjustments_guard();
drop function if exists public.stock_count_current(uuid, text);
drop function if exists public.can_approve_stock_count();
drop table if exists public.stock_count_approvers;

commit;
