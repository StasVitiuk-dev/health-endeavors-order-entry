-- DRAFT (2026-11-22). NOT INSTALLED. Rollback of 42_DRAFT_shopify_payouts_money_issues.sql.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   43   (ROLLBACK, rolls back 42)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, while any difference is recorded, unless deleting them was authorized in the session
-- @effect:      drops the functions and the three tables
-- @postcheck:   to_regclass('public.money_match_issues') is null
-- @rollback:    (this file is the rollback of drafts/42)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the payout copy, the differences list and their functions. Changes no
-- other table. The payout copy can always be synced again from Shopify.
-- STOPS, and removes nothing, while any difference is recorded (open or checked):
-- those are the record of what was found and who checked it. Export them first;
-- deleting them must be authorized in the same session:
--     set he.rollback_delete_money_issues = 'yes, delete the differences';
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_money_issues_install'));

do $guard$
declare v_issues bigint := 0;
begin
  if to_regclass('public.money_match_issues') is not null then
    execute format('lock table %I.%I in access exclusive mode', 'public', 'money_match_issues');
    execute format('select count(*) from %I.%I', 'public', 'money_match_issues') into v_issues;
  end if;
  if v_issues > 0 and coalesce(current_setting('he.rollback_delete_money_issues', true), '') <> 'yes, delete the differences' then
    raise exception 'Rollback stopped: % difference(s) are recorded. Export them, then authorize deleting them in this session.', v_issues;
  end if;
end
$guard$;

drop function if exists public.mark_money_issue_checked(uuid, text);
drop function if exists public.record_money_issue(text, text, text, text, numeric, numeric, date);
drop function if exists public.check_shopify_payouts();
drop table if exists public.money_match_issues;
drop table if exists public.shopify_balance_transactions;
drop table if exists public.shopify_payouts;
drop function if exists public.money_match_issues_guard();

commit;
