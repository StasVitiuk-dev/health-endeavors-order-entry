-- DRAFT (2026-11-16). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   34   (PRODUCTION-CHANGE-DRAFT, step optional (not in the plan; needed before stock-count approval is used for real))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops if auth.uid(), current_role(), is_owner_or_admin(), is_active_staff() or the products / inventory / profiles tables are missing
-- @effect:      2 new empty tables (stock_count_adjustments, stock_count_approvers), a guard trigger (decisions by the owner or an administrator, an administrator also on their own proposal, owner decision of Nov 24; decided rows unchangeable, no deletes), production's audit trigger attached, propose / approve / reject / cancel and grant / revoke functions (security invoker); changes no stock figure
-- @postcheck:   both tables present and empty; anon cannot read them or run the functions; an administrator cannot approve; local-test/stock_count_adjustments_test.sh passes on a throwaway copy
-- @rollback:    drafts/35
-- @@ end metadata @@
-- written approval. DO NOT RUN until then. Rollback: 35_DRAFT_rollback_stock_count_adjustments.sql.
-- Tested only on the local throwaway database (local-test/stock_count_adjustments_test.sh).
--
-- Why: the owner's decision of Nov 16 on stock-count adjustments, changed by the
-- owner's decision of Nov 24 (administrator "almost like owner"):
--   * Staff and administrators may PROPOSE an adjustment, with a reason.
--   * The OWNER or an active ADMINISTRATOR approves one, an administrator also
--     their own proposal (no approval from the owner is needed); the owner is told
--     through the change history (production's audit trigger, attached below,
--     which the owner's Home note "what administrators changed" reads).
--     An employee's proposal is still approved by the owner or an administrator.
--   * The record keeps the original count, the requested count, the reason, who
--     submitted it, who decided it, and when.
--   * The rule is enforced here, in the database, not only by the page.
--   * The earlier per-account grant (grant_stock_count_approval) is kept so the
--     undo file still matches, but since Nov 24 every active administrator
--     approves without one.
--
-- What it adds
--   * table stock_count_adjustments   one row per proposal and its decision
--   * table stock_count_approvers     accounts the owner has granted approval to (empty at install)
--   * a guard on stock_count_adjustments: who may decide, and nothing decided can change
--   * can_approve_stock_count()                      true for the owner or an active administrator
--   * propose_stock_count_adjustment(product, bucket, counted, reason)
--   * approve_stock_count_adjustment(id) / reject_stock_count_adjustment(id, note) / cancel_stock_count_adjustment(id)
--   * grant_stock_count_approval(user, note) / revoke_stock_count_approval(user)   owner only
--
-- What it deliberately does NOT do
--   * It does not change any stock figure. Approving records the decision only;
--     applied_at stays empty. Writing the approved figure to inventory is a
--     separate, later step through the audited adjust function (drafts/10), and
--     needs its own approval. (Standing rule: real stock writes stay gated.)
--   * It changes no existing table, row, permission or screen. Nothing in the
--     dashboard uses it yet.
--
-- How it stays safe
--   * The original count is read from inventory by the database; it cannot be
--     typed. It is read when the proposal is made if the person proposing is
--     allowed to see stock figures; if they are not (a "blind count", which is
--     how staff count today under the existing row rules), it is read at the
--     moment of the decision instead. Either way a decided row always has it.
--   * Approval is refused if the stock has changed since the figure was read
--     ("count again"), or if the count now simply matches the system.
--   * The owner and administrators may approve their own proposal (Nov 24); staff never approve.
--   * Asking twice (a double click, a retry) decides once; the second answer says
--     it was already decided and changes nothing.
--   * A decided row can never be edited or deleted, by anyone.
--
-- Honest limits
--   * SECURITY INVOKER throughout (project rule: every new function runs with
--     the caller's own rights). The owner
--     check uses the existing public.current_role() helper.
--   * Production's own audit trigger is attached (its function's name is read
--     from production at install time, as drafts/50 does), so every proposal and
--     decision is also in the change history. The table is its own record too
--     (who, what, when; no edits, no deletes).
--   * Locking: creates two new, empty tables. Nothing existing is locked.
-- Safe to run twice: a second run changes nothing (IF NOT EXISTS / OR REPLACE).
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_stock_count_adjustments_install'));

do $pre$
declare missing text[] := '{}';
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.current_role()') is null then missing := missing || 'function public.current_role()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regclass('public.products') is null then missing := missing || 'table public.products'::text; end if;
  if to_regclass('public.inventory') is null then missing := missing || 'table public.inventory'::text; end if;
  if to_regclass('public.profiles') is null then missing := missing || 'table public.profiles'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
end $pre$;

-- Accounts the owner has granted approval to, one row each. Empty at install:
-- until the owner adds a row, only the owner can approve.
create table if not exists public.stock_count_approvers (
  user_id     uuid primary key references public.profiles(id),
  granted_by  uuid not null default auth.uid(),
  granted_at  timestamptz not null default now(),
  note        text not null check (length(btrim(note)) >= 5 and length(note) <= 500)
);

create table if not exists public.stock_count_adjustments (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id),
  bucket          text not null default 'available'
                  check (bucket in ('available', 'reserved', 'damaged', 'sample', 'wholesale', 'promotional', 'returned', 'recalled')),
  -- what the system held (read by the database: at proposal when the proposer
  -- may see stock, otherwise at the decision)
  original_count  integer check (original_count is null or original_count >= 0),
  -- what was physically counted
  requested_count integer not null check (requested_count >= 0),
  reason          text not null check (length(btrim(reason)) >= 5 and length(reason) <= 500),
  status          text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'cancelled')),
  submitted_by    uuid not null default auth.uid(),
  submitted_at    timestamptz not null default now(),
  decided_by      uuid,
  decided_at      timestamptz,
  decision_note   text check (decision_note is null or length(decision_note) <= 500),
  -- reserved for the later, separately approved step that writes the stock
  applied_at      timestamptz,
  applied_by      uuid,
  constraint stock_count_adjustments_is_a_change check (original_count is null or requested_count <> original_count),
  -- an approved or rejected row always says what the system held
  constraint stock_count_adjustments_decided_has_original check (status not in ('approved', 'rejected') or original_count is not null),
  -- an open proposal has no decision; a closed one says who and when
  constraint stock_count_adjustments_decision_recorded check (
    (status = 'proposed' and decided_by is null and decided_at is null)
    or (status <> 'proposed' and decided_by is not null and decided_at is not null)),
  constraint stock_count_adjustments_rejection_says_why check (status <> 'rejected' or (decision_note is not null and length(btrim(decision_note)) >= 5)),
  constraint stock_count_adjustments_applied_only_if_approved check (applied_at is null or status = 'approved')
);
-- one open proposal at a time for the same product and bucket
create unique index if not exists stock_count_adjustments_one_open on public.stock_count_adjustments (product_id, bucket) where status = 'proposed';
create index if not exists stock_count_adjustments_by_status on public.stock_count_adjustments (status, submitted_at desc);

-- Who may approve: the owner or an active administrator (owner decision of Nov 24).
create or replace function public.can_approve_stock_count() returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select coalesce(public.current_role()::text in ('owner', 'administrator'), false)
$fn$;

-- The guard: runs for every insert, update and delete, whoever makes it.
create or replace function public.stock_count_adjustments_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'A stock-count adjustment stays on the record and cannot be deleted.' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'proposed' then
      raise exception 'A stock-count adjustment starts as a proposal.' using errcode = '22023';
    end if;
    new.submitted_by := auth.uid();
    new.submitted_at := now();
    new.decided_by := null; new.decided_at := null; new.decision_note := null;
    new.applied_at := null; new.applied_by := null;
    return new;
  end if;

  if old.status <> 'proposed' then
    raise exception 'This stock-count adjustment was already % and cannot be changed.', old.status using errcode = '22023';
  end if;

  -- The facts of a proposal never change. To correct one, cancel it and propose again.
  -- (The system's figure may be filled in once, at the decision, when the
  -- person who proposed could not see it.)
  if new.product_id is distinct from old.product_id or new.bucket is distinct from old.bucket
     or (old.original_count is not null and new.original_count is distinct from old.original_count)
     or (old.original_count is null and new.original_count is not null and new.status not in ('approved', 'rejected'))
     or new.requested_count is distinct from old.requested_count
     or new.reason is distinct from old.reason or new.submitted_by is distinct from old.submitted_by
     or new.submitted_at is distinct from old.submitted_at or new.applied_at is distinct from old.applied_at
     or new.applied_by is distinct from old.applied_by then
    raise exception 'A proposal cannot be edited. Cancel it and propose again.' using errcode = '22023';
  end if;

  if new.status = 'proposed' then
    new.decided_by := null; new.decided_at := null; new.decision_note := null;
    return new;
  end if;

  if new.status in ('approved', 'rejected') then
    if not public.can_approve_stock_count() then
      raise exception 'Only the owner or an administrator can approve or reject a stock-count adjustment.' using errcode = '42501';
    end if;
    if old.submitted_by = auth.uid() and coalesce(public.current_role()::text not in ('owner', 'administrator'), true) then
      raise exception 'You cannot decide your own proposal. The owner or an administrator must.' using errcode = '42501';
    end if;
  elsif new.status = 'cancelled' then
    if not (old.submitted_by = auth.uid() or public.can_approve_stock_count()) then
      raise exception 'Only the person who proposed it, or an approver, can cancel a proposal.' using errcode = '42501';
    end if;
  end if;
  new.decided_by := auth.uid();
  new.decided_at := now();
  return new;
end
$fn$;

drop trigger if exists stock_count_adjustments_guard on public.stock_count_adjustments;
create trigger stock_count_adjustments_guard before insert or update or delete on public.stock_count_adjustments
  for each row execute function public.stock_count_adjustments_guard();

-- The figure the system holds now for one product and bucket (null if there is no stock row).
create or replace function public.stock_count_current(p_product_id uuid, p_bucket text) returns integer
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select case p_bucket
    when 'available' then i.available when 'reserved' then i.reserved when 'damaged' then i.damaged
    when 'sample' then i.sample when 'wholesale' then i.wholesale when 'promotional' then i.promotional
    when 'returned' then i.returned when 'recalled' then i.recalled end
  from public.inventory i where i.product_id = p_product_id
$fn$;

-- Propose: any active staff member. The original count is read here, not typed.
create or replace function public.propose_stock_count_adjustment(
  p_product_id      uuid,
  p_bucket          text,
  p_requested_count integer,
  p_reason          text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_now integer;
  v public.stock_count_adjustments%rowtype;
begin
  if not public.is_active_staff() then
    raise exception 'Only active staff can propose a stock-count adjustment.' using errcode = '42501';
  end if;
  if p_bucket is null or p_bucket not in ('available', 'reserved', 'damaged', 'sample', 'wholesale', 'promotional', 'returned', 'recalled') then
    raise exception 'Unknown stock bucket.' using errcode = '22023';
  end if;
  if p_requested_count is null or p_requested_count < 0 then
    raise exception 'The counted quantity must be zero or more.' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'A written reason is required to propose a stock-count adjustment.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'No such product.' using errcode = 'P0002';
  end if;
  -- null when this person may not see stock figures: a blind count
  v_now := public.stock_count_current(p_product_id, p_bucket);
  if v_now = p_requested_count then
    raise exception 'The count matches the system (%). There is nothing to adjust.', v_now using errcode = '22023';
  end if;
  insert into public.stock_count_adjustments (product_id, bucket, original_count, requested_count, reason)
    values (p_product_id, p_bucket, v_now, p_requested_count, btrim(p_reason))
    returning * into v;
  return jsonb_build_object('ok', true, 'id', v.id, 'status', v.status, 'original_count', v.original_count,
    'requested_count', v.requested_count, 'submitted_by', v.submitted_by, 'submitted_at', v.submitted_at);
end
$fn$;

-- Approve: the owner or an administrator. Decides once.
create or replace function public.approve_stock_count_adjustment(p_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.stock_count_adjustments%rowtype;
  v_now integer;
begin
  if not public.can_approve_stock_count() then
    raise exception 'Only the owner or an administrator can approve a stock-count adjustment.' using errcode = '42501';
  end if;
  select * into v from public.stock_count_adjustments where id = p_id for update;
  if not found then
    raise exception 'No such stock-count adjustment.' using errcode = 'P0002';
  end if;
  if v.status <> 'proposed' then
    return jsonb_build_object('ok', v.status = 'approved', 'already_decided', true, 'status', v.status,
      'decided_by', v.decided_by, 'decided_at', v.decided_at, 'applied', v.applied_at is not null);
  end if;
  v_now := public.stock_count_current(v.product_id, v.bucket);
  if v_now is null then
    raise exception 'That product has no stock record to adjust.' using errcode = 'P0002';
  end if;
  if v.original_count is not null and v_now <> v.original_count then
    raise exception 'The stock has changed since this count (it was %, it is now %). Count again.', v.original_count, v_now using errcode = '22023';
  end if;
  if v_now = v.requested_count then
    raise exception 'The count now matches the system (%). There is nothing to adjust: reject or cancel this proposal.', v_now using errcode = '22023';
  end if;
  update public.stock_count_adjustments set status = 'approved', original_count = v_now where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'already_decided', false, 'status', v.status,
    'original_count', v.original_count, 'requested_count', v.requested_count,
    'decided_by', v.decided_by, 'decided_at', v.decided_at, 'applied', false,
    'note', 'Recorded. No stock figure was changed: applying it is a separate step.');
end
$fn$;

create or replace function public.reject_stock_count_adjustment(p_id uuid, p_note text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.stock_count_adjustments%rowtype;
begin
  if not public.can_approve_stock_count() then
    raise exception 'Only the owner or an administrator can reject a stock-count adjustment.' using errcode = '42501';
  end if;
  if p_note is null or length(btrim(p_note)) < 5 then
    raise exception 'A written reason is required to reject a stock-count adjustment.' using errcode = '22023';
  end if;
  select * into v from public.stock_count_adjustments where id = p_id for update;
  if not found then
    raise exception 'No such stock-count adjustment.' using errcode = 'P0002';
  end if;
  if v.status <> 'proposed' then
    return jsonb_build_object('ok', v.status = 'rejected', 'already_decided', true, 'status', v.status, 'decided_by', v.decided_by, 'decided_at', v.decided_at);
  end if;
  update public.stock_count_adjustments set status = 'rejected', decision_note = btrim(p_note),
    original_count = coalesce(v.original_count, public.stock_count_current(v.product_id, v.bucket)) where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'already_decided', false, 'status', v.status, 'decided_by', v.decided_by, 'decided_at', v.decided_at);
end
$fn$;

create or replace function public.cancel_stock_count_adjustment(p_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.stock_count_adjustments%rowtype;
begin
  select * into v from public.stock_count_adjustments where id = p_id for update;
  if not found then
    raise exception 'No such stock-count adjustment.' using errcode = 'P0002';
  end if;
  if v.status <> 'proposed' then
    return jsonb_build_object('ok', v.status = 'cancelled', 'already_decided', true, 'status', v.status);
  end if;
  update public.stock_count_adjustments set status = 'cancelled' where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'already_decided', false, 'status', v.status);
end
$fn$;

-- Grant approval to ONE named account. Owner only; never to oneself by anyone else.
create or replace function public.grant_stock_count_approval(p_user_id uuid, p_note text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_role text;
begin
  if coalesce(public.current_role()::text <> 'owner', true) then
    raise exception 'Only the owner can grant stock-count approval.' using errcode = '42501';
  end if;
  if p_note is null or length(btrim(p_note)) < 5 then
    raise exception 'Say in a few words why this account is granted approval.' using errcode = '22023';
  end if;
  select role into v_role from public.profiles where id = p_user_id and is_active and deleted_at is null;
  if not found then
    raise exception 'No active account with that id.' using errcode = 'P0002';
  end if;
  if v_role <> 'administrator' then
    raise exception 'Approval can only be granted to an administrator account (this one is %).', v_role using errcode = '22023';
  end if;
  insert into public.stock_count_approvers (user_id, note) values (p_user_id, btrim(p_note))
    on conflict (user_id) do nothing;
  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'granted', true);
end
$fn$;

create or replace function public.revoke_stock_count_approval(p_user_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_n integer;
begin
  if coalesce(public.current_role()::text <> 'owner', true) then
    raise exception 'Only the owner can revoke stock-count approval.' using errcode = '42501';
  end if;
  delete from public.stock_count_approvers where user_id = p_user_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'revoked', v_n > 0);
end
$fn$;

-- Permissions. Visitors (anon) get nothing. Signed-in people go through the
-- row rules below; the guard above applies to everyone on top of them.
alter table public.stock_count_adjustments enable row level security;
-- ---------------------------------------------------------------- audit: production's own audit trigger
-- Dynamic only because the function's name is read from production at install time (as drafts/50).
do $audit$
declare
  v_nsp text;
  v_fn  text;
begin
  select n.nspname, p.proname into v_nsp, v_fn
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  if v_fn is null then
    raise exception 'Not installed: the audit trigger on public.tasks was not found, so the change history could not be attached.';
  end if;
  execute format('drop trigger if exists %I on public.%I', 'stock_count_adjustments_audit', 'stock_count_adjustments');
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function %I.%I()',
                 'stock_count_adjustments_audit', 'stock_count_adjustments', v_nsp, v_fn);
end $audit$;

alter table public.stock_count_approvers enable row level security;
revoke all on public.stock_count_adjustments from public, anon;
revoke all on public.stock_count_approvers from public, anon;
grant select, insert, update on public.stock_count_adjustments to authenticated;
grant select, insert, delete on public.stock_count_approvers to authenticated;

drop policy if exists stock_count_adjustments_staff_read on public.stock_count_adjustments;
create policy stock_count_adjustments_staff_read on public.stock_count_adjustments for select to authenticated using (public.is_active_staff());
drop policy if exists stock_count_adjustments_staff_propose on public.stock_count_adjustments;
create policy stock_count_adjustments_staff_propose on public.stock_count_adjustments for insert to authenticated with check (public.is_active_staff() and status = 'proposed');
-- who may decide is the guard's job; the row rule only keeps outsiders away
drop policy if exists stock_count_adjustments_staff_update on public.stock_count_adjustments;
create policy stock_count_adjustments_staff_update on public.stock_count_adjustments for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

drop policy if exists stock_count_approvers_read on public.stock_count_approvers;
create policy stock_count_approvers_read on public.stock_count_approvers for select to authenticated using (user_id = auth.uid() or public.is_owner_or_admin());
drop policy if exists stock_count_approvers_owner_insert on public.stock_count_approvers;
create policy stock_count_approvers_owner_insert on public.stock_count_approvers for insert to authenticated with check (public.current_role()::text = 'owner');
drop policy if exists stock_count_approvers_owner_delete on public.stock_count_approvers;
create policy stock_count_approvers_owner_delete on public.stock_count_approvers for delete to authenticated using (public.current_role()::text = 'owner');

revoke all on function public.can_approve_stock_count() from public, anon;
revoke all on function public.stock_count_current(uuid, text) from public, anon;
revoke all on function public.stock_count_adjustments_guard() from public, anon;
revoke all on function public.propose_stock_count_adjustment(uuid, text, integer, text) from public, anon;
revoke all on function public.approve_stock_count_adjustment(uuid) from public, anon;
revoke all on function public.reject_stock_count_adjustment(uuid, text) from public, anon;
revoke all on function public.cancel_stock_count_adjustment(uuid) from public, anon;
revoke all on function public.grant_stock_count_approval(uuid, text) from public, anon;
revoke all on function public.revoke_stock_count_approval(uuid) from public, anon;
grant execute on function public.can_approve_stock_count() to authenticated;
grant execute on function public.stock_count_current(uuid, text) to authenticated;
grant execute on function public.propose_stock_count_adjustment(uuid, text, integer, text) to authenticated;
grant execute on function public.approve_stock_count_adjustment(uuid) to authenticated;
grant execute on function public.reject_stock_count_adjustment(uuid, text) to authenticated;
grant execute on function public.cancel_stock_count_adjustment(uuid) to authenticated;
grant execute on function public.grant_stock_count_approval(uuid, text) to authenticated;
grant execute on function public.revoke_stock_count_approval(uuid) to authenticated;

commit;
