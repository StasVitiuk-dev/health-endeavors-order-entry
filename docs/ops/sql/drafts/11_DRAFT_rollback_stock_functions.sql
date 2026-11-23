-- PRODUCTION CHANGE - DO NOT RUN WITHOUT THE OWNER'S APPROVAL (rollback; tested locally only).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   11   (ROLLBACK, rolls back 10)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  22
-- @risk:        LOW
-- @precheck:    refuses while any stock_fn_* switch is ON (EXT14)
-- @effect:      removes the 6 functions; no table touched
-- @postcheck:   0 of the functions remain
-- @rollback:    (this file is the rollback of drafts/10)
-- @@ end metadata @@
-- DRAFT rollback for 10_DRAFT_stock_functions.sql. Removes the functions only;
-- no table or data is touched. Run this only if the functions must be removed
-- AFTER the dashboard has been switched back to its old code path (revert the
-- dashboard PR first, or the buttons would call missing functions).
-- Run as one transaction: all functions disappear together, or none do.
-- EXT14 (2026-10-11): the dashboard no longer needs a revert first: each button
-- has a stock_fn_* switch. This rollback now REFUSES (changes nothing) while
-- any of those switches is ON, so no button can be left calling a removed
-- function. Turn them off on Feature Switches first (switch rows that are OFF
-- may stay; drafts/22 removes them). Tested: local-test/rollback_guards_test.sh.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_stock_functions_install')); -- EXT5: a second copy run at the same time waits instead of failing
do $$
begin
  -- nested: the inner query is only planned when the table exists
  if to_regclass('public.feature_flags') is not null then
    if exists (select 1 from public.feature_flags where flag_key like 'stock_fn_%' and enabled is true) then
      raise exception 'Rollback stopped, nothing was changed: a stock_fn_* switch is still on. Turn it off on Feature Switches first.' using errcode = '55000';
    end if;
  end if;
end $$;
drop function if exists public.delete_unused_product(uuid);
drop function if exists public.receive_return(uuid, text, integer);
drop function if exists public.quarantine_recall(uuid);
drop function if exists public.receive_purchase_order(uuid, jsonb, date);
drop function if exists public.adjust_inventory(uuid, text, integer, text, integer);
drop function if exists public._he_apply_stock_change(uuid, text, integer, text, uuid, integer);
-- Earlier draft signatures (never installed; harmless if absent).
drop function if exists public.adjust_inventory(uuid, text, integer, text);
drop function if exists public._he_apply_stock_change(uuid, text, integer, text, uuid);
commit;
