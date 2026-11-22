-- DRAFT (2026-11-22). NOT INSTALLED. Rollback of 40_DRAFT_partial_receiving_returns.sql.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   41   (ROLLBACK, rolls back 40)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, if any stock movement exists, or if any request exists and its deletion was not authorized in the session
-- @effect:      drops the functions, guards and the six tables
-- @postcheck:   to_regclass('public.stock_movements') is null
-- @rollback:    (this file is the rollback of drafts/40)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the receiving, supplier-return, customer-return, movement and
-- correction tables and their functions. Changes no other table.
-- STOPS, and removes nothing, if any stock movement exists: stock has already
-- been changed through this feature, and those rows are the record of it.
-- STOPS too if any request is still waiting or was decided, unless deleting
-- those requests was separately authorized in the same session first:
--     set he.rollback_delete_stock_requests = 'yes, delete the requests';
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_partial_receiving_install'));

do $guard$
declare
  v_moves bigint := 0;
  v_requests bigint := 0;
begin
  if to_regclass('public.stock_movements') is null then
    raise notice 'Nothing to remove: partial receiving is not installed.';
    return;
  end if;
  -- dynamic, so the statements are not planned where the tables are missing
  execute format('lock table %I.%I, %I.%I, %I.%I, %I.%I in access exclusive mode', 'public', 'stock_movements', 'public', 'receiving_records', 'public', 'supplier_returns', 'public', 'customer_return_inspections');
  execute format('select count(*) from %I.%I', 'public', 'stock_movements') into v_moves;
  if v_moves > 0 then
    raise exception 'Not rolled back: % stock movement(s) were made through this feature. They are the record of stock changes. Export them and decide separately.', v_moves;
  end if;
  execute format('select (select count(*) from %I.%I) + (select count(*) from %I.%I) + (select count(*) from %I.%I)', 'public', 'receiving_records', 'public', 'supplier_returns', 'public', 'customer_return_inspections') into v_requests;
  if v_requests > 0 and coalesce(current_setting('he.rollback_delete_stock_requests', true), '') <> 'yes, delete the requests' then
    raise exception 'Not rolled back: % request(s) exist and would be deleted. To allow that, run first in the same session: set he.rollback_delete_stock_requests = ''yes, delete the requests'';', v_requests;
  end if;
  raise notice 'Removing partial receiving. Requests deleted with it: %.', v_requests;
end $guard$;

drop function if exists public.submit_receiving_record(uuid, uuid, jsonb, text);
drop function if exists public.approve_receiving_record(uuid, text);
drop function if exists public.reject_receiving_record(uuid, text);
drop function if exists public.cancel_receiving_record(uuid);
drop function if exists public.decide_receiving_surplus(uuid, text, text);
drop function if exists public.submit_supplier_return(uuid, uuid, integer, text, text, boolean);
drop function if exists public.decide_supplier_return(uuid, text, text);
drop function if exists public.record_customer_return(uuid, uuid, integer, uuid);
drop function if exists public.decide_customer_return(uuid, integer, integer, integer, boolean, boolean, text);
drop function if exists public.correct_stock_movement(uuid, bigint, text);
drop table if exists public.stock_corrections;
drop table if exists public.receiving_record_lines;
drop table if exists public.receiving_records;
drop table if exists public.supplier_returns;
drop table if exists public.customer_return_inspections;
drop table if exists public.stock_movements;
drop function if exists public.stock_movements_guard();
drop function if exists public.receiving_records_guard();
drop function if exists public.receiving_record_lines_guard();
drop function if exists public.receiving_records_apply();
drop function if exists public.receiving_surplus_apply();
drop function if exists public.supplier_returns_guard();
drop function if exists public.supplier_returns_apply();
drop function if exists public.customer_return_inspections_guard();
drop function if exists public.customer_return_inspections_apply();
drop function if exists public.stock_corrections_guard();
drop function if exists public.stock_corrections_apply();
drop function if exists public.po_item_outstanding(uuid);
drop function if exists public.stock_is_owner();

commit;
