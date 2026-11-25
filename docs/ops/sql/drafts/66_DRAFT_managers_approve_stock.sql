-- DRAFT (2026-11-25). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   66   (PRODUCTION-CHANGE-DRAFT, step optional, ONLY if the owner chooses A (owner decision of Nov 25: a manager approves deliveries and returns too; A = a manager changes stock only by deciding). After drafts/40 and drafts/62)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  40, 62
-- @risk:        MEDIUM
-- @precheck:    stops, changing nothing, if drafts/40 (as of Nov 25, with stock_may_decide() and stock_can_decide()) is not installed, if current_role() or is_owner_or_admin() is missing, or if the role word manager is missing (drafts/62 first)
-- @effect:      stock_may_decide() and stock_can_decide() also answer yes for an active manager, never for a record they recorded themselves; the four decision actions (approve_receiving_record, reject_receiving_record, decide_supplier_return, decide_customer_return) run with raised rights so the stock steps after a decision work, and nothing else does; a manager reads deliveries and returns to the supplier waiting for a decision (2 reading rules replaced); no table, row or stock figure changes; a manager still cannot change stock directly, decide a surplus, correct a movement or read the stock history
-- @postcheck:   exactly the four decision actions run with raised rights; local-test/managers_approve_stock_test.sh passes on a throwaway copy
-- @rollback:    drafts/67
-- @@ end metadata @@
-- written approval AND the owner's choice "A" (see below). DO NOT RUN until then.
-- Rollback: 67_DRAFT_rollback_managers_approve_stock.sql.
-- Tested only on the local throwaway database (local-test/managers_approve_stock_test.sh).
--
-- Why (owner, Nov 25): "yes, manager should be able to approve it": a manager approves
-- deliveries and returns too. This file is OPTION A of the two ways to do it
-- (docs/ops/sql-review/ITEM_5_DRAFT_40_PARTIAL_RECEIVING.md, "How a manager may change
-- stock"): a manager changes stock ONLY by deciding a delivery or a return that someone
-- else recorded, and never by editing stock directly. Prepared before the owner chose,
-- so it is ready if the answer is A; if the answer is B, this file is not used.
--
-- What it changes (needs drafts/40 as of Nov 25, and the Manager role word, drafts/62)
--   1. stock_may_decide() and stock_can_decide(submitted_by): today "owner or administrator".
--      After this file: also an active MANAGER, but stock_can_decide() never lets a manager
--      decide a record they recorded themselves (a second person always decides).
--   2. The four decision actions run with RAISED RIGHTS:
--        approve_receiving_record, reject_receiving_record,
--        decide_supplier_return, decide_customer_return.
--      Why: the steps that follow a decision read the purchase-order lines and change stock
--      and the stock history, which the existing rules (Query A) let only the owner or an
--      administrator touch. With the person's own rights, a manager's decision would fail,
--      or worse, read nothing where it should read the order line. Each of the four first
--      checks who is asking (stock_may_decide) and the guard on the record then checks
--      stock_can_decide(who recorded it); nothing else runs with raised rights.
--      This is the project's one deliberate exception to "every function runs with the
--      caller's rights", pinned by name in tests/tools/sql-lint.js and
--      tests/specs/sql-drafts-static.spec.js so no other function can slip in.
--   3. A manager can READ the deliveries and returns to the supplier waiting for a
--      decision (needed to decide them). Customer returns are already readable by staff.
--
-- What it does NOT change
--   * No table, no row, no stock figure. Installing decides nothing.
--   * A manager still cannot: change a stock figure directly, decide about a surplus,
--     correct a stock movement, read the stock history, or decide a record they recorded.
--   * The rules on the stock tables themselves (owner or administrator) are untouched.
--   * The owner and administrators keep exactly what they had.
--
-- Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_managers_approve_stock_install'));

do $pre$
declare missing text[] := '{}';
begin
  if to_regprocedure('public.current_role()') is null then missing := missing || 'function public.current_role()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regprocedure('public.stock_is_owner()') is null then missing := missing || 'function public.stock_is_owner() (drafts/40)'::text; end if;
  if to_regprocedure('public.stock_may_decide()') is null then missing := missing || 'function public.stock_may_decide() (drafts/40 as of Nov 25)'::text; end if;
  if to_regprocedure('public.stock_can_decide(uuid)') is null then missing := missing || 'function public.stock_can_decide(uuid) (drafts/40 as of Nov 25)'::text; end if;
  if to_regprocedure('public.approve_receiving_record(uuid, text)') is null then missing := missing || 'function public.approve_receiving_record(uuid, text) (drafts/40)'::text; end if;
  if to_regprocedure('public.reject_receiving_record(uuid, text)') is null then missing := missing || 'function public.reject_receiving_record(uuid, text) (drafts/40)'::text; end if;
  if to_regprocedure('public.decide_supplier_return(uuid, text, text)') is null then missing := missing || 'function public.decide_supplier_return(uuid, text, text) (drafts/40)'::text; end if;
  if to_regprocedure('public.decide_customer_return(uuid, integer, integer, integer, boolean, boolean, text)') is null then missing := missing || 'function public.decide_customer_return(...) (drafts/40)'::text; end if;
  if to_regclass('public.receiving_records') is null then missing := missing || 'table public.receiving_records (drafts/40)'::text; end if;
  if to_regclass('public.supplier_returns') is null then missing := missing || 'table public.supplier_returns (drafts/40)'::text; end if;
  -- the Manager role word (drafts/62), where the roles are a fixed list
  if to_regtype('public.app_role') is not null
     and not exists (select 1 from pg_enum where enumtypid = to_regtype('public.app_role') and enumlabel = 'manager') then
    missing := missing || 'the role word manager (install drafts/62 first)'::text;
  end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
end $pre$;

-- 1. who may decide: the owner, an administrator, or a manager (never their own record)
create or replace function public.stock_may_decide() returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select coalesce(public.current_role() in ('owner', 'administrator', 'manager'), false)
$fn$;

create or replace function public.stock_can_decide(p_submitted_by uuid) returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select coalesce(public.current_role() in ('owner', 'administrator')
               or (public.current_role() = 'manager' and p_submitted_by is distinct from auth.uid()), false)
$fn$;

revoke all on function public.stock_may_decide() from public, anon;
revoke all on function public.stock_can_decide(uuid) from public, anon;
grant execute on function public.stock_may_decide() to authenticated;
grant execute on function public.stock_can_decide(uuid) to authenticated;

-- 2. the four decision actions, and only these, run with raised rights (see the note above)
alter function public.approve_receiving_record(uuid, text) security definer;
alter function public.reject_receiving_record(uuid, text) security definer;
alter function public.decide_supplier_return(uuid, text, text) security definer;
alter function public.decide_customer_return(uuid, integer, integer, integer, boolean, boolean, text) security definer;
revoke all on function public.approve_receiving_record(uuid, text) from public, anon;
revoke all on function public.reject_receiving_record(uuid, text) from public, anon;
revoke all on function public.decide_supplier_return(uuid, text, text) from public, anon;
revoke all on function public.decide_customer_return(uuid, integer, integer, integer, boolean, boolean, text) from public, anon;

-- 3. a manager reads what waits for a decision
drop policy if exists receiving_records_read on public.receiving_records;
create policy receiving_records_read on public.receiving_records for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin() or public.current_role() = 'manager');
drop policy if exists supplier_returns_read on public.supplier_returns;
create policy supplier_returns_read on public.supplier_returns for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin() or public.current_role() = 'manager');

commit;
