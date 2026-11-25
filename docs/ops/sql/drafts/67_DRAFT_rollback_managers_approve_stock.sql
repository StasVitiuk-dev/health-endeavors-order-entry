-- DRAFT (2026-11-25). NOT INSTALLED. ROLLBACK of drafts/66 (managers approve deliveries and returns).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   67   (ROLLBACK, rolls back 66)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if drafts/40 (as of Nov 25) is not installed
-- @effect:      the two helpers answer owner or administrator again; the four decision actions run with the caller's rights again; drafts/40's own 2 reading rules again; decisions already made stay on the record; no stock figure changes
-- @postcheck:   no drafts/40 function runs with raised rights; a manager is refused a decision again
-- @rollback:    (this file is the rollback of drafts/66)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
-- Tested only on the local throwaway database (local-test/managers_approve_stock_test.sh).
--
-- Puts drafts/40 back exactly as it was before drafts/66:
--   * stock_may_decide() and stock_can_decide() answer "owner or administrator" again;
--   * the four decision actions run with the caller's own rights again;
--   * the two reading rules are drafts/40's own again.
-- Decisions a manager already made stay on the record, with their name: nothing is
-- deleted, and no stock figure changes. If drafts/40 is not installed, it stops and
-- changes nothing. Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_managers_approve_stock_install'));

do $pre$
begin
  if to_regprocedure('public.stock_may_decide()') is null or to_regclass('public.receiving_records') is null then
    raise exception 'Nothing to undo: drafts/40 (as of Nov 25) is not installed.';
  end if;
end $pre$;

create or replace function public.stock_may_decide() returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select public.stock_is_owner()
$fn$;

create or replace function public.stock_can_decide(p_submitted_by uuid) returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select public.stock_is_owner()
$fn$;

revoke all on function public.stock_may_decide() from public, anon;
revoke all on function public.stock_can_decide(uuid) from public, anon;
grant execute on function public.stock_may_decide() to authenticated;
grant execute on function public.stock_can_decide(uuid) to authenticated;

alter function public.approve_receiving_record(uuid, text) security invoker;
alter function public.reject_receiving_record(uuid, text) security invoker;
alter function public.decide_supplier_return(uuid, text, text) security invoker;
alter function public.decide_customer_return(uuid, integer, integer, integer, boolean, boolean, text) security invoker;

drop policy if exists receiving_records_read on public.receiving_records;
create policy receiving_records_read on public.receiving_records for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin());
drop policy if exists supplier_returns_read on public.supplier_returns;
create policy supplier_returns_read on public.supplier_returns for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin());

commit;
