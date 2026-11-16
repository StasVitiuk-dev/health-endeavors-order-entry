-- DRAFT (2026-11-15). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   32   (PRODUCTION-CHANGE-DRAFT, step optional (not in the plan; needed before any real invoice is issued))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops if auth.uid(), is_owner_or_admin(), is_active_staff() or the orders table is missing
-- @effect:      2 new empty tables (invoices, invoice_counters), a guard trigger that assigns HE-YYYY-NNNN at issue, issue_invoice() and void_invoice() (security invoker), row rules: staff draft, owner/administrator issue and void
-- @postcheck:   both tables present and empty; anon cannot read them or run the functions; local-test/invoices_test.sh passes on a throwaway copy
-- @rollback:    drafts/33
-- @@ end metadata @@
-- written approval. DO NOT RUN until then. Rollback: 33_DRAFT_rollback_invoices.sql.
-- Tested only on the local throwaway database (local-test/invoices_test.sh).
--
-- Why: the owner's invoice decisions of Nov 14 (OWNER_DECISIONS_2026-11-14.md)
-- are built and tested in the dashboard as logic only. There is nowhere to STORE
-- an invoice, and no place that can hand out invoice numbers safely. This file
-- adds that place. Nothing in the dashboard uses it yet; installing it changes
-- no existing table, row, permission or screen.
--
-- What it adds
--   * table invoices          one row per draft or issued invoice
--   * table invoice_counters  the last number used in each year
--   * a guard on invoices     the only thing that hands out a number
--   * issue_invoice(id, terms, credit_approved)   owner / administrator
--   * void_invoice(id, reason)                    owner / administrator
--
-- The owner's decisions, enforced by the database itself (not only by the page):
--   1 tax      (tightened Nov 16) unknown tax is never stored as 0: a draft whose
--              tax is PENDING holds no rate, no tax and no total, and cannot be
--              issued. A CONFIRMED rate names the place it is for. A resale-
--              EXEMPT invoice carries tax 0 and must record why (the verified
--              exemption document). The total must add up.
--   2 terms    due on receipt by default; Net 14 only when the person issuing
--              says the account is approved for credit; the due date follows
--   3 invoices drafts first, issued by hand; number HE-YYYY-NNNN, per year,
--              assigned at the moment of issue; a voided invoice keeps its row
--              and its number, and the number is never handed out again
--   4 day      the day of issue is the calendar day in America/Chicago
--   5 people   active staff may prepare and edit drafts; only the owner or an
--              administrator can issue or void
--
-- How the number stays safe: the number is assigned by the guard, in the same
-- transaction as the change to "issued". The year's counter row is locked while
-- that happens, so two people issuing at the same moment get two different
-- numbers, and a failed attempt hands its number back (no gap). A number typed
-- by anyone is ignored. An issued invoice's lines and amounts cannot be edited.
--
-- Honest limits
--   * SECURITY INVOKER throughout (project rule: no SECURITY DEFINER), so the
--     owner / administrator can also change invoice_counters directly. That is
--     the same trust they already have over invoices; staff cannot touch it.
--   * No audit trigger is attached here: the name of production's audit trigger
--     function is not in this repository. Add it with the same statement the
--     other tables use, after reading Query A.
--   * Payments are not modelled. The status values for them exist so a later
--     step can record them without changing this table.
--   * Locking: creates two new, empty tables. Nothing existing is locked.
-- Safe to run twice: a second run changes nothing (IF NOT EXISTS / OR REPLACE).
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_invoices_install'));

do $pre$
declare missing text[] := '{}';
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regclass('public.orders') is null then missing := missing || 'table public.orders'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
end $pre$;

create table if not exists public.invoice_counters (
  invoice_year integer primary key check (invoice_year between 2020 and 2999),
  last_seq     integer not null check (last_seq >= 0)
);

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid references public.orders(id),
  -- who is billed, as it stood when the draft was made: an issued invoice keeps
  -- this copy even if the account's address changes later (added Nov 15)
  account_ref     text check (account_ref is null or length(account_ref) <= 100),
  bill_to         jsonb check (bill_to is null or (jsonb_typeof(bill_to) = 'object' and octet_length(bill_to::text) <= 4000)),
  ship_to         jsonb check (ship_to is null or (jsonb_typeof(ship_to) = 'object' and octet_length(ship_to::text) <= 4000)),
  status          text not null default 'draft'
                  check (status in ('draft', 'issued', 'partially_paid', 'paid', 'void')),
  invoice_number  text unique,
  invoice_year    integer,
  invoice_seq     integer check (invoice_seq is null or invoice_seq > 0),
  terms           text check (terms is null or terms in ('DUE_ON_RECEIPT', 'NET_14')),
  currency        text not null default 'USD',
  lines           jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  subtotal        numeric(12,2) not null default 0 check (subtotal >= 0),
  order_discount  numeric(12,2) not null default 0 check (order_discount >= 0),
  shipping        numeric(12,2) not null default 0 check (shipping >= 0),
  -- decision 1 (Nov 16): no default rate and no default tax. Empty means "not known yet".
  tax_rate        numeric(7,5)  check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 0.25)),
  tax_rate_status text not null default 'PENDING' check (tax_rate_status in ('PENDING', 'CONFIRMED', 'EXEMPT')),
  -- the place the confirmed rate is for (rates differ by place)
  tax_place       text check (tax_place is null or length(tax_place) <= 200),
  -- whether shipping was in the tax base, and a resale exemption with its reason
  tax_shipping    boolean not null default false,
  tax_exempt      boolean not null default false,
  tax_exempt_reason text check (tax_exempt_reason is null or length(tax_exempt_reason) <= 500),
  tax             numeric(12,2) check (tax is null or tax >= 0),
  total           numeric(12,2) check (total is null or total >= 0),
  issue_date      date,
  due_date        date,
  issued_at       timestamptz,
  issued_by       uuid,
  voided_at       timestamptz,
  voided_by       uuid,
  void_reason     text,
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  updated_at      timestamptz not null default now(),
  -- a draft has no number; everything else has all of its issue details
  constraint invoices_number_iff_issued check (
    (status = 'draft' and invoice_number is null and invoice_year is null and invoice_seq is null and issue_date is null)
    or (status <> 'draft' and invoice_number is not null and invoice_year is not null and invoice_seq is not null
        and issue_date is not null and due_date is not null and terms is not null and issued_by is not null)),
  -- decision 1: an invoice whose tax is not settled cannot exist outside draft
  constraint invoices_tax_confirmed_when_issued check (status = 'draft' or tax_rate_status in ('CONFIRMED', 'EXEMPT')),
  -- decision 1: pending means no figures at all (never 0); settled means all three
  constraint invoices_pending_has_no_figures check (
    (tax_rate_status = 'PENDING' and tax_rate is null and tax is null and total is null)
    or (tax_rate_status <> 'PENDING' and tax_rate is not null and tax is not null and total is not null)),
  -- decision 1: a confirmed rate says which place it is for
  constraint invoices_confirmed_names_place check (tax_rate_status <> 'CONFIRMED' or (tax_place is not null and length(btrim(tax_place)) > 0)),
  -- the total is what the parts add up to
  constraint invoices_total_adds_up check (total is null or total = greatest(subtotal - order_discount, 0) + shipping + tax),
  -- decision 3: a void invoice says why
  constraint invoices_void_has_reason check (status <> 'void' or (void_reason is not null and length(btrim(void_reason)) >= 5 and voided_at is not null)),
  -- decision 1: a resale-exempt invoice carries no tax and records why
  constraint invoices_exempt_is_documented check (
    (tax_rate_status = 'EXEMPT') = tax_exempt
    and (not tax_exempt or (tax = 0 and tax_rate = 0 and tax_exempt_reason is not null and length(btrim(tax_exempt_reason)) >= 5))),
  constraint invoices_year_seq_unique unique (invoice_year, invoice_seq),
  constraint invoices_due_not_before_issue check (due_date is null or issue_date is null or due_date >= issue_date)
);
-- one live invoice (draft or issued) per order; a voided one does not count
create unique index if not exists invoices_one_live_per_order on public.invoices (order_id) where order_id is not null and status <> 'void';

-- The guard: the single place that hands out numbers and keeps an issued
-- invoice unchangeable. It runs for every insert and update, whoever makes it.
create or replace function public.invoices_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_seq integer;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'An invoice starts as a draft; issue it with issue_invoice().' using errcode = '22023';
    end if;
    new.invoice_number := null; new.invoice_year := null; new.invoice_seq := null;
    new.issue_date := null; new.due_date := null; new.issued_at := null; new.issued_by := null;
    new.voided_at := null; new.voided_by := null; new.void_reason := null;
    return new;
  end if;

  new.updated_at := now();

  if old.status = 'draft' and new.status = 'draft' then
    new.invoice_number := null; new.invoice_year := null; new.invoice_seq := null;
    new.issue_date := null; new.due_date := null; new.issued_at := null; new.issued_by := null;
    return new;
  end if;

  if old.status = 'draft' and new.status = 'issued' then
    if not public.is_owner_or_admin() then
      raise exception 'Only the owner or an administrator can issue an invoice.' using errcode = '42501';
    end if;
    if new.tax_rate_status not in ('CONFIRMED', 'EXEMPT') or new.tax is null or new.total is null then
      raise exception 'The tax on this draft is still pending. It cannot be issued until the tax is confirmed.' using errcode = '22023';
    end if;
    -- decision 4: the day of issue is the Central-time calendar day
    new.issue_date := (now() at time zone 'America/Chicago')::date;
    new.invoice_year := extract(year from new.issue_date)::integer;
    new.terms := coalesce(new.terms, 'DUE_ON_RECEIPT');
    new.due_date := case when new.terms = 'NET_14' then new.issue_date + 14 else new.issue_date end;
    -- the next number of that year; the counter row stays locked until commit
    insert into public.invoice_counters as c (invoice_year, last_seq) values (new.invoice_year, 1)
      on conflict (invoice_year) do update set last_seq = c.last_seq + 1
      returning c.last_seq into v_seq;
    new.invoice_seq := v_seq;
    new.invoice_number := 'HE-' || new.invoice_year::text || '-' || lpad(v_seq::text, 4, '0');
    new.issued_at := now();
    new.issued_by := auth.uid();
    return new;
  end if;

  if old.status = 'draft' then
    raise exception 'A draft can only be edited or issued (asked for: %).', new.status using errcode = '22023';
  end if;

  -- From here the invoice has been issued: what was issued can never change.
  if new.invoice_number is distinct from old.invoice_number or new.invoice_year is distinct from old.invoice_year
     or new.invoice_seq is distinct from old.invoice_seq or new.issue_date is distinct from old.issue_date
     or new.due_date is distinct from old.due_date or new.terms is distinct from old.terms
     or new.issued_at is distinct from old.issued_at or new.issued_by is distinct from old.issued_by
     or new.lines is distinct from old.lines or new.subtotal is distinct from old.subtotal
     or new.order_discount is distinct from old.order_discount or new.shipping is distinct from old.shipping
     or new.tax_rate is distinct from old.tax_rate or new.tax_rate_status is distinct from old.tax_rate_status
     or new.tax is distinct from old.tax or new.total is distinct from old.total
     or new.currency is distinct from old.currency or new.order_id is distinct from old.order_id
     or new.account_ref is distinct from old.account_ref or new.bill_to is distinct from old.bill_to
     or new.ship_to is distinct from old.ship_to or new.tax_shipping is distinct from old.tax_shipping
     or new.tax_exempt is distinct from old.tax_exempt or new.tax_place is distinct from old.tax_place
     or new.tax_exempt_reason is distinct from old.tax_exempt_reason then
    raise exception 'An issued invoice cannot be edited. Void it and issue a new one.' using errcode = '22023';
  end if;

  if new.status = old.status then
    if new.void_reason is distinct from old.void_reason or new.voided_at is distinct from old.voided_at or new.voided_by is distinct from old.voided_by then
      raise exception 'Void details are set by void_invoice() only.' using errcode = '22023';
    end if;
    return new;
  end if;

  if new.status = 'void' then
    if not public.is_owner_or_admin() then
      raise exception 'Only the owner or an administrator can void an invoice.' using errcode = '42501';
    end if;
    if old.status = 'paid' then
      raise exception 'A paid invoice cannot be voided. Issue a credit note instead.' using errcode = '22023';
    end if;
    if old.status = 'void' then
      raise exception 'This invoice is already void.' using errcode = '22023';
    end if;
    new.voided_at := now();
    new.voided_by := auth.uid();
    return new;
  end if;

  if (old.status = 'issued' and new.status in ('partially_paid', 'paid'))
     or (old.status = 'partially_paid' and new.status = 'paid') then
    if not public.is_owner_or_admin() then
      raise exception 'Only the owner or an administrator can change the status of an issued invoice.' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'An invoice cannot go from % to %.', old.status, new.status using errcode = '22023';
end
$fn$;

drop trigger if exists invoices_guard on public.invoices;
create trigger invoices_guard before insert or update on public.invoices
  for each row execute function public.invoices_guard();

-- Decision 3: a number, once given, stays on the record. Only a draft can be deleted.
create or replace function public.invoices_no_delete_after_issue() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if old.status <> 'draft' then
    raise exception 'An issued or void invoice stays on the record and cannot be deleted.' using errcode = '22023';
  end if;
  return old;
end
$fn$;

drop trigger if exists invoices_no_delete_after_issue on public.invoices;
create trigger invoices_no_delete_after_issue before delete on public.invoices
  for each row execute function public.invoices_no_delete_after_issue();

-- Issue one draft. Asking twice (a lost reply, a double click) is safe: the
-- second call returns the number the invoice already has and issues nothing.
create or replace function public.issue_invoice(
  p_invoice_id      uuid,
  p_terms           text    default null,
  p_credit_approved boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.invoices%rowtype;
  v_terms text;
begin
  if not public.is_owner_or_admin() then
    raise exception 'Only the owner or an administrator can issue an invoice.' using errcode = '42501';
  end if;
  select * into v from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'No such invoice.' using errcode = 'P0002';
  end if;
  if v.status <> 'draft' then
    return jsonb_build_object('ok', v.status <> 'void', 'already_issued', true, 'status', v.status,
      'invoice_number', v.invoice_number, 'issue_date', v.issue_date, 'due_date', v.due_date, 'terms', v.terms);
  end if;
  v_terms := coalesce(p_terms, v.terms, 'DUE_ON_RECEIPT');
  if v_terms not in ('DUE_ON_RECEIPT', 'NET_14') then
    raise exception 'Unknown payment terms %.', v_terms using errcode = '22023';
  end if;
  if v_terms = 'NET_14' and not coalesce(p_credit_approved, false) then
    raise exception 'Net 14 is only for an account approved for credit. Confirm the approval or use due on receipt.' using errcode = '22023';
  end if;
  update public.invoices set status = 'issued', terms = v_terms where id = p_invoice_id returning * into v;
  return jsonb_build_object('ok', true, 'already_issued', false, 'status', v.status,
    'invoice_number', v.invoice_number, 'issue_date', v.issue_date, 'due_date', v.due_date, 'terms', v.terms);
end
$fn$;

-- Void an issued invoice. Its row and its number stay.
create or replace function public.void_invoice(p_invoice_id uuid, p_reason text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.invoices%rowtype;
begin
  if not public.is_owner_or_admin() then
    raise exception 'Only the owner or an administrator can void an invoice.' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'A written reason is required to void an invoice.' using errcode = '22023';
  end if;
  select * into v from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'No such invoice.' using errcode = 'P0002';
  end if;
  if v.status = 'void' then
    return jsonb_build_object('ok', true, 'already_void', true, 'invoice_number', v.invoice_number);
  end if;
  if v.status = 'draft' then
    raise exception 'A draft is not void-able: delete the draft instead.' using errcode = '22023';
  end if;
  update public.invoices set status = 'void', void_reason = btrim(p_reason) where id = p_invoice_id returning * into v;
  return jsonb_build_object('ok', true, 'already_void', false, 'invoice_number', v.invoice_number);
end
$fn$;

-- Permissions. Visitors (anon) get nothing. Signed-in people go through the
-- row rules below; the guard above applies to everyone on top of them.
alter table public.invoices enable row level security;
alter table public.invoice_counters enable row level security;
revoke all on public.invoices from public, anon;
revoke all on public.invoice_counters from public, anon;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update on public.invoice_counters to authenticated;

drop policy if exists invoices_staff_read on public.invoices;
create policy invoices_staff_read on public.invoices for select to authenticated using (public.is_active_staff());
-- decision 5: staff prepare drafts; they can never produce a non-draft row
drop policy if exists invoices_staff_draft_insert on public.invoices;
create policy invoices_staff_draft_insert on public.invoices for insert to authenticated with check (public.is_active_staff() and status = 'draft');
drop policy if exists invoices_staff_draft_update on public.invoices;
create policy invoices_staff_draft_update on public.invoices for update to authenticated using (public.is_active_staff() and status = 'draft') with check (public.is_active_staff() and status = 'draft');
drop policy if exists invoices_staff_draft_delete on public.invoices;
create policy invoices_staff_draft_delete on public.invoices for delete to authenticated using (public.is_active_staff() and status = 'draft');
drop policy if exists invoices_owner_admin_all on public.invoices;
create policy invoices_owner_admin_all on public.invoices for all to authenticated using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());

drop policy if exists invoice_counters_owner_admin on public.invoice_counters;
create policy invoice_counters_owner_admin on public.invoice_counters for all to authenticated using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());

revoke all on function public.issue_invoice(uuid, text, boolean) from public, anon;
revoke all on function public.void_invoice(uuid, text) from public, anon;
revoke all on function public.invoices_guard() from public, anon;
revoke all on function public.invoices_no_delete_after_issue() from public, anon;
grant execute on function public.issue_invoice(uuid, text, boolean) to authenticated;
grant execute on function public.void_invoice(uuid, text) to authenticated;

commit;
