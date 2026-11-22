-- DRAFT (2026-11-15, revised 2026-11-22). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   32   (PRODUCTION-CHANGE-DRAFT, step optional (not in the plan; needed before any real invoice is issued))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops if auth.uid(), is_owner_or_admin(), is_active_staff(), the orders, tasks or audit_log table, or the audit trigger on tasks is missing; stops, changing nothing, if an invoice table already exists with a different shape
-- @effect:      4 new empty tables (invoices, invoice_counters, invoice_payments, invoice_events); guards: valid lines that add up, discounts within what they discount, confirmed tax = rate x taxable amount, lines and billing details before issue, Net 14 only with a recorded credit approval on every write path, creator and creation time unchangeable, status follows recorded payments; numbers HE-YYYY-NNNN with all digits after 9999; issue_invoice, void_invoice, record_invoice_payment, reverse_invoice_payment (security invoker); production's audit trigger attached; staff see invoices they created or whose order they can see; payments owner/administrator only
-- @postcheck:   the four tables present and empty; anon cannot read them or run the functions; the audit trigger on invoices exists; local-test/invoices_test.sh passes on a throwaway copy
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
-- Revised Nov 22 after the owner's review of the first version:
--   * audit: production's existing audit trigger (the one on `tasks`) is attached
--     to the new tables, and a readable invoice history (invoice_events) records
--     who created, changed, issued, voided, or recorded / reversed a payment.
--     The creator and creation time can never be changed.
--   * contents: the lines must be in the supported format and add up to the
--     subtotal; discounts cannot exceed what they discount; a confirmed tax
--     must equal the rate times the taxable amount; an invoice needs lines and
--     a billing name and address before it can be issued.
--   * Net 14: enforced on every write path (the issue function AND a direct
--     change of the row): it needs an explicit credit approval at the moment of
--     issue, and records who approved it and when.
--   * numbers: HE-2026-0001 ... HE-2026-9999, then HE-2026-10000 (all digits
--     kept); each year starts again at 0001.
--   * staff see an invoice only if they created it or can see its order (the
--     same rule as supplier documents); payments are owner / administrator only.
--   * a safe install: if any of the tables already exists with a different
--     shape, the install stops and names what differs.
--   * payments: "partially paid" and "paid" are no longer typed by hand. They
--     follow recorded payments (amount, date, method, reference), and a payment
--     is corrected by a linked reversal, never edited or deleted.
--
-- What it adds
--   * table invoices          one row per draft or issued invoice
--   * table invoice_counters  the last number used in each year
--   * table invoice_payments  payments and their reversals (append-only)
--   * table invoice_events    the readable history (append-only, written by the database)
--   * guards on invoices and invoice_payments, and production's audit trigger on both
--   * issue_invoice(id, terms, credit_approved)            owner / administrator
--   * void_invoice(id, reason)                             owner / administrator
--   * record_invoice_payment(key, id, amount, date, method, reference, note)   owner / administrator
--   * reverse_invoice_payment(key, payment_id, reason)     owner / administrator
--
-- The owner's decisions, enforced by the database itself (not only by the page):
--   1 tax      unknown tax is never stored as 0: a PENDING draft holds no rate, no
--              tax and no total, and cannot be issued. A CONFIRMED rate names its
--              place and its tax must be the rate times the taxable amount. A
--              resale-EXEMPT invoice carries tax 0 and records the verified document.
--   2 terms    due on receipt by default; Net 14 only with a credit approval given
--              at issue, recorded with who and when
--   3 invoices drafts first, issued by hand; number HE-YYYY-NNNN (more digits after
--              9999), per year, assigned at issue; a voided invoice keeps its row and
--              number; a number is never handed out again
--   4 day      the day of issue is the calendar day in America/Chicago
--   5 people   active staff prepare drafts for orders they can see; only the owner
--              or an administrator issue, void or record payments
--
-- Honest limits
--   * SECURITY INVOKER throughout (project rule: no SECURITY DEFINER), so the
--     owner / administrator can also change invoice_counters directly. That is
--     the same trust they already have over invoices; staff cannot touch it.
--   * "Approved for credit" is the issuer's explicit statement, recorded with
--     their name and time. There is no list of credit-approved accounts yet;
--     adding one is a separate decision.
--   * Which orders staff can see is decided by the orders table's own rules in
--     production. Invoices follow them; this file does not change them.
--   * Locking: creates new, empty tables. Nothing existing is locked.
-- Safe to run twice: a second run changes nothing.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_invoices_install'));

-- ---------------------------------------------------------------- 1. what must already exist
do $pre$
declare
  missing text[] := '{}';
  v_tg record;
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regclass('public.orders') is null then missing := missing || 'table public.orders'::text; end if;
  if to_regclass('public.tasks') is null then missing := missing || 'table public.tasks (its audit trigger is reused)'::text; end if;
  if to_regclass('public.audit_log') is null then missing := missing || 'table public.audit_log'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
  -- production's audit trigger on tasks: an AFTER, per-row trigger on insert, update and delete
  select t.tgtype into v_tg from pg_trigger t
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  if not found then
    raise exception 'Not installed: the audit trigger on public.tasks was not found, so invoices could not be audited the same way.';
  end if;
  if (v_tg.tgtype & 1) = 0 or (v_tg.tgtype & 2) <> 0 or (v_tg.tgtype & 4) = 0 or (v_tg.tgtype & 8) = 0 or (v_tg.tgtype & 16) = 0 then
    raise exception 'Not installed: the audit trigger on public.tasks is not an AFTER INSERT OR UPDATE OR DELETE row trigger (type %); it cannot be reused as is.', v_tg.tgtype;
  end if;
end $pre$;

-- ---------------------------------------------------------------- 2. a safe install
-- If a table of this feature already exists, it must have exactly the expected
-- columns (name, type, required) and constraints; otherwise stop and say what
-- differs. The list is pinned by local-test/invoices_test.sh against a fresh install.
create temp table he_invoice_expected (tbl text, col text, typ text, req boolean) on commit drop;
insert into he_invoice_expected values
  ('invoice_counters','invoice_year','integer',true), ('invoice_counters','last_seq','integer',true),
  ('invoices','id','uuid',true), ('invoices','order_id','uuid',false), ('invoices','account_ref','text',false),
  ('invoices','bill_to','jsonb',false), ('invoices','ship_to','jsonb',false), ('invoices','status','text',true),
  ('invoices','invoice_number','text',false), ('invoices','invoice_year','integer',false), ('invoices','invoice_seq','integer',false),
  ('invoices','terms','text',false), ('invoices','currency','text',true), ('invoices','lines','jsonb',true),
  ('invoices','subtotal','numeric(12,2)',true), ('invoices','order_discount','numeric(12,2)',true), ('invoices','shipping','numeric(12,2)',true),
  ('invoices','tax_rate','numeric(7,5)',false), ('invoices','tax_rate_status','text',true), ('invoices','tax_place','text',false),
  ('invoices','tax_shipping','boolean',true), ('invoices','tax_exempt','boolean',true), ('invoices','tax_exempt_reason','text',false),
  ('invoices','tax','numeric(12,2)',false), ('invoices','total','numeric(12,2)',false), ('invoices','amount_paid','numeric(12,2)',true),
  ('invoices','issue_date','date',false), ('invoices','due_date','date',false), ('invoices','issued_at','timestamp with time zone',false),
  ('invoices','issued_by','uuid',false), ('invoices','credit_approved','boolean',true), ('invoices','credit_approved_by','uuid',false),
  ('invoices','credit_approved_at','timestamp with time zone',false), ('invoices','voided_at','timestamp with time zone',false),
  ('invoices','voided_by','uuid',false), ('invoices','void_reason','text',false), ('invoices','created_at','timestamp with time zone',true),
  ('invoices','created_by','uuid',false), ('invoices','updated_at','timestamp with time zone',true), ('invoices','updated_by','uuid',false),
  ('invoice_payments','id','uuid',true), ('invoice_payments','request_key','uuid',true), ('invoice_payments','invoice_id','uuid',true),
  ('invoice_payments','kind','text',true), ('invoice_payments','amount','numeric(12,2)',true), ('invoice_payments','received_on','date',true),
  ('invoice_payments','method','text',false), ('invoice_payments','reference','text',false), ('invoice_payments','note','text',false),
  ('invoice_payments','reverses','uuid',false), ('invoice_payments','recorded_by','uuid',false), ('invoice_payments','recorded_at','timestamp with time zone',true),
  ('invoice_events','id','bigint',true), ('invoice_events','invoice_id','uuid',false), ('invoice_events','event','text',true),
  ('invoice_events','by_user','uuid',false), ('invoice_events','at','timestamp with time zone',true), ('invoice_events','detail','jsonb',true);
create temp table he_invoice_expected_checks (tbl text, con text) on commit drop;
insert into he_invoice_expected_checks values
  ('invoices','invoices_number_iff_issued'), ('invoices','invoices_tax_confirmed_when_issued'), ('invoices','invoices_pending_has_no_figures'),
  ('invoices','invoices_confirmed_names_place'), ('invoices','invoices_total_adds_up'), ('invoices','invoices_void_has_reason'),
  ('invoices','invoices_exempt_is_documented'), ('invoices','invoices_year_seq_unique'), ('invoices','invoices_due_not_before_issue'),
  ('invoices','invoices_discount_within_subtotal'), ('invoices','invoices_paid_within_total'), ('invoices','invoices_net14_approved'),
  ('invoice_payments','invoice_payments_reversal_links'), ('invoice_payments','invoice_payments_request_key_key');

do $compat$
declare
  r record;
  v_diff text;
  v_cons text;
begin
  for r in select distinct tbl from he_invoice_expected loop
    if to_regclass('public.' || r.tbl) is null then continue; end if;
    select string_agg(x, '; ' order by x) into v_diff from (
      (select 'missing or different: ' || col || ' ' || typ || case when req then ' not null' else '' end as x
         from he_invoice_expected where tbl = r.tbl
       except
       select 'missing or different: ' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then ' not null' else '' end
         from pg_attribute a where a.attrelid = to_regclass('public.' || r.tbl) and a.attnum > 0 and not a.attisdropped)
      union all
      (select 'unexpected: ' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then ' not null' else '' end
         from pg_attribute a where a.attrelid = to_regclass('public.' || r.tbl) and a.attnum > 0 and not a.attisdropped
           and a.attname not in (select col from he_invoice_expected where tbl = r.tbl))) d;
    select string_agg(e.con, ', ' order by e.con) into v_cons from he_invoice_expected_checks e
     where e.tbl = r.tbl and not exists (select 1 from pg_constraint c where c.conrelid = to_regclass('public.' || r.tbl) and c.conname = e.con);
    if v_diff is not null or v_cons is not null then
      raise exception 'Not installed: public.% already exists with a different shape (% %). Nothing was changed. Compare it with this file before going on.',
        r.tbl, coalesce(v_diff, ''), case when v_cons is null then '' else '; missing constraints: ' || v_cons end;
    end if;
  end loop;
end $compat$;

-- ---------------------------------------------------------------- 3. tables
create table if not exists public.invoice_counters (
  invoice_year integer primary key check (invoice_year between 2020 and 2999),
  last_seq     integer not null check (last_seq >= 0)
);

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid references public.orders(id),
  -- who is billed, as it stood when the draft was made
  account_ref     text check (account_ref is null or length(account_ref) <= 100),
  bill_to         jsonb check (bill_to is null or (jsonb_typeof(bill_to) = 'object' and octet_length(bill_to::text) <= 4000)),
  ship_to         jsonb check (ship_to is null or (jsonb_typeof(ship_to) = 'object' and octet_length(ship_to::text) <= 4000)),
  status          text not null default 'draft'
                  check (status in ('draft', 'issued', 'partially_paid', 'paid', 'void')),
  invoice_number  text unique,
  invoice_year    integer,
  invoice_seq     integer check (invoice_seq is null or invoice_seq > 0),
  terms           text check (terms is null or terms in ('DUE_ON_RECEIPT', 'NET_14')),
  currency        text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  lines           jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  subtotal        numeric(12,2) not null default 0 check (subtotal >= 0),
  order_discount  numeric(12,2) not null default 0 check (order_discount >= 0),
  shipping        numeric(12,2) not null default 0 check (shipping >= 0),
  tax_rate        numeric(7,5)  check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 0.25)),
  tax_rate_status text not null default 'PENDING' check (tax_rate_status in ('PENDING', 'CONFIRMED', 'EXEMPT')),
  tax_place       text check (tax_place is null or length(tax_place) <= 200),
  tax_shipping    boolean not null default false,
  tax_exempt      boolean not null default false,
  tax_exempt_reason text check (tax_exempt_reason is null or length(tax_exempt_reason) <= 500),
  tax             numeric(12,2) check (tax is null or tax >= 0),
  total           numeric(12,2) check (total is null or total >= 0),
  -- kept by the payments trigger; never typed
  amount_paid     numeric(12,2) not null default 0 check (amount_paid >= 0),
  issue_date      date,
  due_date        date,
  issued_at       timestamptz,
  issued_by       uuid,
  -- Net 14: the issuer's explicit credit approval, with who and when (set at issue)
  credit_approved    boolean not null default false,
  credit_approved_by uuid,
  credit_approved_at timestamptz,
  voided_at       timestamptz,
  voided_by       uuid,
  void_reason     text,
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid,
  constraint invoices_number_iff_issued check (
    (status = 'draft' and invoice_number is null and invoice_year is null and invoice_seq is null and issue_date is null)
    or (status <> 'draft' and invoice_number is not null and invoice_year is not null and invoice_seq is not null
        and issue_date is not null and due_date is not null and terms is not null and issued_by is not null)),
  constraint invoices_tax_confirmed_when_issued check (status = 'draft' or tax_rate_status in ('CONFIRMED', 'EXEMPT')),
  constraint invoices_pending_has_no_figures check (
    (tax_rate_status = 'PENDING' and tax_rate is null and tax is null and total is null)
    or (tax_rate_status <> 'PENDING' and tax_rate is not null and tax is not null and total is not null)),
  constraint invoices_confirmed_names_place check (tax_rate_status <> 'CONFIRMED' or (tax_place is not null and length(btrim(tax_place)) > 0)),
  constraint invoices_total_adds_up check (total is null or total = greatest(subtotal - order_discount, 0) + shipping + tax),
  constraint invoices_void_has_reason check (status <> 'void' or (void_reason is not null and length(btrim(void_reason)) >= 5 and voided_at is not null)),
  constraint invoices_exempt_is_documented check (
    (tax_rate_status = 'EXEMPT') = tax_exempt
    and (not tax_exempt or (tax = 0 and tax_rate = 0 and tax_exempt_reason is not null and length(btrim(tax_exempt_reason)) >= 5))),
  constraint invoices_year_seq_unique unique (invoice_year, invoice_seq),
  constraint invoices_due_not_before_issue check (due_date is null or issue_date is null or due_date >= issue_date),
  -- Nov 22: an order discount can never exceed the goods it discounts
  constraint invoices_discount_within_subtotal check (order_discount <= subtotal),
  -- Nov 22: payments never exceed the total
  constraint invoices_paid_within_total check (amount_paid = 0 or (total is not null and amount_paid <= total)),
  -- Nov 22: an issued Net 14 invoice always names who approved the credit, and when
  constraint invoices_net14_approved check (
    status = 'draft' or terms is distinct from 'NET_14'
    or (credit_approved and credit_approved_by is not null and credit_approved_at is not null))
);
-- one live invoice (draft or issued) per order; a voided one does not count
create unique index if not exists invoices_one_live_per_order on public.invoices (order_id) where order_id is not null and status <> 'void';

create table if not exists public.invoice_payments (
  id          uuid primary key default gen_random_uuid(),
  -- one per submission: pressing Save twice, or again after a lost reply, records once
  request_key uuid not null unique,
  invoice_id  uuid not null references public.invoices(id),
  kind        text not null check (kind in ('payment', 'reversal')),
  amount      numeric(12,2) not null check (amount > 0),
  received_on date not null,
  method      text check (method is null or method in ('check', 'ach', 'card', 'cash', 'wire', 'other')),
  reference   text check (reference is null or length(reference) <= 120),
  note        text check (note is null or length(note) <= 500),
  -- a reversal names the payment it corrects
  reverses    uuid references public.invoice_payments(id),
  recorded_by uuid default auth.uid(),
  recorded_at timestamptz not null default now(),
  constraint invoice_payments_reversal_links check (
    (kind = 'payment' and reverses is null)
    or (kind = 'reversal' and reverses is not null and note is not null and length(btrim(note)) >= 5))
);
create index if not exists invoice_payments_by_invoice on public.invoice_payments (invoice_id, recorded_at);
create unique index if not exists invoice_payments_one_reversal on public.invoice_payments (reverses) where reverses is not null;

create table if not exists public.invoice_events (
  id          bigint generated always as identity primary key,
  invoice_id  uuid,
  event       text not null check (event in ('created', 'draft_changed', 'issued', 'voided', 'payment_recorded',
                                             'payment_reversed', 'status_changed', 'draft_deleted')),
  by_user     uuid,
  at          timestamptz not null default now(),
  detail      jsonb not null default '{}'::jsonb
);
create index if not exists invoice_events_by_invoice on public.invoice_events (invoice_id, id);

-- ---------------------------------------------------------------- 4. checks used by the guards
-- What is wrong with these lines, or null if they are in the supported format:
-- an array of at most 200 objects with only these keys:
--   sku (text, 1-64) and/or description (text, up to 300): at least one of them
--   quantity   a whole number from 1 to 100000
--   unitPrice  0 to 1,000,000, whole cents
--   discount   0 up to quantity x unitPrice, whole cents (absent = 0)
--   lineTotal  exactly quantity x unitPrice - discount
--   lotNumber  absent, null or text up to 64
create or replace function public.invoice_lines_problem(p_lines jsonb) returns text
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_line jsonb;
  v_n integer := 0;
  v_key text;
  v_qty numeric; v_unit numeric; v_disc numeric; v_total numeric;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then return 'the lines are not a list'; end if;
  if jsonb_array_length(p_lines) > 200 then return 'more than 200 lines'; end if;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_n := v_n + 1;
    if jsonb_typeof(v_line) <> 'object' then return 'line ' || v_n || ' is not a line'; end if;
    for v_key in select jsonb_object_keys(v_line) loop
      if v_key not in ('sku', 'description', 'quantity', 'unitPrice', 'discount', 'lineTotal', 'lotNumber') then
        return 'line ' || v_n || ' has an unknown field "' || left(v_key, 40) || '"';
      end if;
    end loop;
    if coalesce(jsonb_typeof(v_line->'sku'), 'null') not in ('string', 'null') or coalesce(jsonb_typeof(v_line->'description'), 'null') not in ('string', 'null')
       or coalesce(jsonb_typeof(v_line->'lotNumber'), 'null') not in ('string', 'null') then
      return 'line ' || v_n || ': the SKU, description and lot must be text';
    end if;
    if length(coalesce(v_line->>'sku', '')) > 64 or length(coalesce(v_line->>'description', '')) > 300 or length(coalesce(v_line->>'lotNumber', '')) > 64 then
      return 'line ' || v_n || ': the SKU, description or lot is too long';
    end if;
    if length(btrim(coalesce(v_line->>'sku', ''))) = 0 and length(btrim(coalesce(v_line->>'description', ''))) = 0 then
      return 'line ' || v_n || ' has neither a SKU nor a description';
    end if;
    if jsonb_typeof(v_line->'quantity') is distinct from 'number' or jsonb_typeof(v_line->'unitPrice') is distinct from 'number'
       or jsonb_typeof(v_line->'lineTotal') is distinct from 'number'
       or coalesce(jsonb_typeof(v_line->'discount'), 'null') not in ('number', 'null') then
      return 'line ' || v_n || ': quantity, unit price and line total must be numbers';
    end if;
    v_qty := (v_line->>'quantity')::numeric;
    v_unit := (v_line->>'unitPrice')::numeric;
    v_disc := coalesce((v_line->>'discount')::numeric, 0);
    v_total := (v_line->>'lineTotal')::numeric;
    if v_qty <> trunc(v_qty) or v_qty < 1 or v_qty > 100000 then
      return 'line ' || v_n || ': the quantity must be a whole number from 1 to 100000';
    end if;
    if v_unit < 0 or v_unit > 1000000 or v_unit <> round(v_unit, 2) then
      return 'line ' || v_n || ': the unit price must be 0 to 1,000,000 in whole cents';
    end if;
    if v_disc < 0 or v_disc <> round(v_disc, 2) then
      return 'line ' || v_n || ': the discount must be zero or more, in whole cents';
    end if;
    if v_disc > v_qty * v_unit then
      return 'line ' || v_n || ': the discount is more than the line is worth';
    end if;
    if v_total <> v_qty * v_unit - v_disc then
      return 'line ' || v_n || ': the line total is not quantity x price - discount';
    end if;
  end loop;
  return null;
end
$fn$;

-- The line totals added up (0 for no lines). Only called on lines that passed the check above.
create or replace function public.invoice_lines_sum(p_lines jsonb) returns numeric
language sql
immutable
security invoker
set search_path = public, pg_temp
as $fn$
  select coalesce(sum((e->>'lineTotal')::numeric), 0) from jsonb_array_elements(p_lines) e
$fn$;

-- Enough to bill: a name, and an address (address lines, or a city and state).
create or replace function public.invoice_bill_to_complete(p_bill_to jsonb) returns boolean
language sql
immutable
security invoker
set search_path = public, pg_temp
as $fn$
  select coalesce(
    jsonb_typeof(p_bill_to) = 'object'
    and length(btrim(coalesce(p_bill_to->>'name', ''))) >= 2
    and (
      (jsonb_typeof(p_bill_to->'lines') = 'array'
        and exists (select 1 from jsonb_array_elements(p_bill_to->'lines') l where jsonb_typeof(l) = 'string' and length(btrim(l #>> '{}')) >= 3))
      or (length(btrim(coalesce(p_bill_to->>'city', ''))) >= 2 and length(btrim(coalesce(p_bill_to->>'state', ''))) >= 2)),
    false)
$fn$;

-- HE-YYYY-NNNN: at least four digits, all of them kept after 9999.
create or replace function public.invoice_number_text(p_year integer, p_seq integer) returns text
language sql
immutable
security invoker
set search_path = public, pg_temp
as $fn$
  select 'HE-' || p_year::text || '-' || case when p_seq < 10000 then lpad(p_seq::text, 4, '0') else p_seq::text end
$fn$;

-- The status that recorded payments imply for an issued invoice.
create or replace function public.invoice_status_for(p_amount_paid numeric, p_total numeric) returns text
language sql
immutable
security invoker
set search_path = public, pg_temp
as $fn$
  select case when coalesce(p_amount_paid, 0) = 0 then 'issued'
              when p_amount_paid < p_total then 'partially_paid'
              else 'paid' end
$fn$;

-- ---------------------------------------------------------------- 5. the guard on invoices
create or replace function public.invoices_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_seq integer;
  v_problem text;
  v_expected_tax numeric;
begin
  -- who made it, and when, can never change (Nov 22)
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'An invoice starts as a draft; issue it with issue_invoice().' using errcode = '22023';
    end if;
    new.created_by := auth.uid(); new.created_at := now();
    new.invoice_number := null; new.invoice_year := null; new.invoice_seq := null;
    new.issue_date := null; new.due_date := null; new.issued_at := null; new.issued_by := null;
    new.voided_at := null; new.voided_by := null; new.void_reason := null;
    new.credit_approved := false; new.credit_approved_by := null; new.credit_approved_at := null;
    new.amount_paid := 0;
  else
    if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'Who created an invoice, and when, cannot be changed.' using errcode = '42501';
    end if;
    if new.amount_paid is distinct from old.amount_paid and pg_trigger_depth() < 2 then
      raise exception 'Payments are recorded with record_invoice_payment(); the amount paid is never typed.' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now(); new.updated_by := auth.uid();

  -- a draft (being created, edited, or issued): its contents must be valid
  if tg_op = 'INSERT' or old.status = 'draft' then
    v_problem := public.invoice_lines_problem(new.lines);
    if v_problem is not null then
      raise exception 'The invoice lines are not valid: %.', v_problem using errcode = '22023';
    end if;
    if new.subtotal <> public.invoice_lines_sum(new.lines) then
      raise exception 'The lines add up to %, not to the subtotal %.', public.invoice_lines_sum(new.lines), new.subtotal using errcode = '22023';
    end if;
    if new.order_discount > new.subtotal then
      raise exception 'The order discount (%) is more than the goods it discounts (%).', new.order_discount, new.subtotal using errcode = '22023';
    end if;
    if new.tax_rate_status = 'CONFIRMED' and new.tax_rate is not null and new.tax is not null then
      v_expected_tax := round((greatest(new.subtotal - new.order_discount, 0) + case when new.tax_shipping then new.shipping else 0 end) * new.tax_rate, 2);
      if new.tax <> v_expected_tax then
        raise exception 'The tax % is not the confirmed rate times the taxable amount (it should be %).', new.tax, v_expected_tax using errcode = '22023';
      end if;
    end if;
    if new.status = 'draft' then
      new.invoice_number := null; new.invoice_year := null; new.invoice_seq := null;
      new.issue_date := null; new.due_date := null; new.issued_at := null; new.issued_by := null;
      new.credit_approved := false; new.credit_approved_by := null; new.credit_approved_at := null;
      return new;
    end if;
  end if;

  if old.status = 'draft' and new.status = 'issued' then
    if not public.is_owner_or_admin() then
      raise exception 'Only the owner or an administrator can issue an invoice.' using errcode = '42501';
    end if;
    if new.tax_rate_status not in ('CONFIRMED', 'EXEMPT') or new.tax is null or new.total is null then
      raise exception 'The tax on this draft is still pending. It cannot be issued until the tax is confirmed.' using errcode = '22023';
    end if;
    if jsonb_array_length(new.lines) = 0 then
      raise exception 'An invoice with no lines cannot be issued.' using errcode = '22023';
    end if;
    if not public.invoice_bill_to_complete(new.bill_to) then
      raise exception 'The billing details are not complete: a name and an address (address lines, or a city and state) are needed before issuing.' using errcode = '22023';
    end if;
    new.terms := coalesce(new.terms, 'DUE_ON_RECEIPT');
    -- Net 14, on every path (issue_invoice or a direct change): an explicit credit
    -- approval given now, recorded with who and when
    if new.terms = 'NET_14' then
      if not coalesce(new.credit_approved, false) then
        raise exception 'Net 14 is only for an account approved for credit. Confirm the approval or use due on receipt.' using errcode = '22023';
      end if;
      new.credit_approved_by := auth.uid(); new.credit_approved_at := now();
    else
      new.credit_approved := false; new.credit_approved_by := null; new.credit_approved_at := null;
    end if;
    new.issue_date := (now() at time zone 'America/Chicago')::date;
    new.invoice_year := extract(year from new.issue_date)::integer;
    new.due_date := case when new.terms = 'NET_14' then new.issue_date + 14 else new.issue_date end;
    -- the next number of that year; the counter row stays locked until commit
    insert into public.invoice_counters as c (invoice_year, last_seq) values (new.invoice_year, 1)
      on conflict (invoice_year) do update set last_seq = c.last_seq + 1
      returning c.last_seq into v_seq;
    new.invoice_seq := v_seq;
    new.invoice_number := public.invoice_number_text(new.invoice_year, v_seq);
    new.issued_at := now();
    new.issued_by := auth.uid();
    new.amount_paid := 0;
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
     or new.credit_approved is distinct from old.credit_approved or new.credit_approved_by is distinct from old.credit_approved_by
     or new.credit_approved_at is distinct from old.credit_approved_at
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

  if new.status = 'void' then
    if old.status = 'void' then
      if new.void_reason is distinct from old.void_reason or new.voided_at is distinct from old.voided_at or new.voided_by is distinct from old.voided_by then
        raise exception 'Void details are set once, by void_invoice().' using errcode = '22023';
      end if;
      return new;
    end if;
    if not public.is_owner_or_admin() then
      raise exception 'Only the owner or an administrator can void an invoice.' using errcode = '42501';
    end if;
    if old.amount_paid > 0 then
      raise exception 'An invoice with payments recorded against it cannot be voided. Reverse the payments, or issue a credit note.' using errcode = '22023';
    end if;
    new.voided_at := now();
    new.voided_by := auth.uid();
    return new;
  end if;
  if old.status = 'void' then
    raise exception 'A void invoice stays void.' using errcode = '22023';
  end if;
  if new.void_reason is distinct from old.void_reason or new.voided_at is distinct from old.voided_at or new.voided_by is distinct from old.voided_by then
    raise exception 'Void details are set by void_invoice() only.' using errcode = '22023';
  end if;

  -- issued / partially paid / paid: the status always follows the recorded payments
  if not public.is_owner_or_admin() then
    raise exception 'Only the owner or an administrator can change an issued invoice.' using errcode = '42501';
  end if;
  if new.status is distinct from public.invoice_status_for(new.amount_paid, new.total) then
    raise exception 'The status follows the payments recorded (% of % paid means %). Record the payment instead of changing the status.',
      new.amount_paid, new.total, public.invoice_status_for(new.amount_paid, new.total) using errcode = '22023';
  end if;
  return new;
end
$fn$;

drop trigger if exists invoices_guard on public.invoices;
create trigger invoices_guard before insert or update on public.invoices
  for each row execute function public.invoices_guard();

-- A number, once given, stays on the record. Only a draft can be deleted.
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

-- ---------------------------------------------------------------- 6. the readable history
-- Written only from inside this feature's own triggers; never by hand, never changed.
create or replace function public.invoice_events_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op <> 'INSERT' then
    raise exception 'The invoice history cannot be changed or deleted.' using errcode = '42501';
  end if;
  if pg_trigger_depth() < 2 then
    raise exception 'The invoice history is written by the database only.' using errcode = '42501';
  end if;
  new.by_user := auth.uid();
  new.at := now();
  return new;
end
$fn$;

drop trigger if exists invoice_events_guard on public.invoice_events;
create trigger invoice_events_guard before insert or update or delete on public.invoice_events
  for each row execute function public.invoice_events_guard();

create or replace function public.invoices_history() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_changed text[];
begin
  if tg_op = 'INSERT' then
    insert into public.invoice_events (invoice_id, event, detail)
      values (new.id, 'created', jsonb_build_object('order_id', new.order_id, 'subtotal', new.subtotal, 'lines', jsonb_array_length(new.lines)));
    return null;
  end if;
  if tg_op = 'DELETE' then
    insert into public.invoice_events (invoice_id, event, detail)
      values (old.id, 'draft_deleted', jsonb_build_object('order_id', old.order_id, 'subtotal', old.subtotal, 'created_by', old.created_by));
    return null;
  end if;
  if old.status = 'draft' and new.status = 'draft' then
    select coalesce(array_agg(k order by k), '{}') into v_changed
      from jsonb_object_keys(to_jsonb(new)) k
     where k not in ('updated_at', 'updated_by') and to_jsonb(new)->k is distinct from to_jsonb(old)->k;
    if array_length(v_changed, 1) is not null then
      insert into public.invoice_events (invoice_id, event, detail) values (new.id, 'draft_changed', jsonb_build_object('fields', to_jsonb(v_changed)));
    end if;
  elsif old.status = 'draft' and new.status = 'issued' then
    insert into public.invoice_events (invoice_id, event, detail)
      values (new.id, 'issued', jsonb_build_object('invoice_number', new.invoice_number, 'terms', new.terms, 'total', new.total,
        'credit_approved_by', new.credit_approved_by));
  elsif new.status = 'void' and old.status <> 'void' then
    insert into public.invoice_events (invoice_id, event, detail)
      values (new.id, 'voided', jsonb_build_object('invoice_number', new.invoice_number, 'reason', new.void_reason));
  elsif new.status is distinct from old.status then
    insert into public.invoice_events (invoice_id, event, detail)
      values (new.id, 'status_changed', jsonb_build_object('from', old.status, 'to', new.status, 'amount_paid', new.amount_paid));
  end if;
  return null;
end
$fn$;

drop trigger if exists invoices_history on public.invoices;
create trigger invoices_history after insert or update or delete on public.invoices
  for each row execute function public.invoices_history();

-- ---------------------------------------------------------------- 7. payments
-- A payment or a reversal is checked and then added; nothing is ever edited or
-- deleted. The invoice's amount paid and status follow automatically.
create or replace function public.invoice_payments_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_inv public.invoices%rowtype;
  v_orig public.invoice_payments%rowtype;
  v_paid numeric;
begin
  if tg_op <> 'INSERT' then
    raise exception 'A recorded payment cannot be changed or deleted. Record a reversal instead.' using errcode = '42501';
  end if;
  if not public.is_owner_or_admin() then
    raise exception 'Only the owner or an administrator can record payments.' using errcode = '42501';
  end if;
  -- one payment at a time per invoice: the invoice row stays locked until commit
  select * into v_inv from public.invoices where id = new.invoice_id for update;
  if not found then
    raise exception 'No such invoice.' using errcode = 'P0002';
  end if;
  if v_inv.status not in ('issued', 'partially_paid', 'paid') then
    raise exception 'Payments are recorded only against an issued invoice (this one is %).', v_inv.status using errcode = '22023';
  end if;
  new.recorded_by := auth.uid(); new.recorded_at := now();
  if new.amount <> round(new.amount, 2) then
    raise exception 'A payment is in whole cents.' using errcode = '22023';
  end if;
  if new.kind = 'payment' then
    if new.amount > v_inv.total - v_inv.amount_paid then
      raise exception 'This payment (%) is more than is still owed (%).', new.amount, v_inv.total - v_inv.amount_paid using errcode = '22023';
    end if;
  else
    select * into v_orig from public.invoice_payments where id = new.reverses;
    if not found or v_orig.invoice_id <> new.invoice_id or v_orig.kind <> 'payment' then
      raise exception 'A reversal must name a payment of this same invoice.' using errcode = '22023';
    end if;
    if new.amount <> v_orig.amount then
      raise exception 'A reversal undoes the whole payment (%).', v_orig.amount using errcode = '22023';
    end if;
  end if;
  return new;
end
$fn$;

drop trigger if exists invoice_payments_guard on public.invoice_payments;
create trigger invoice_payments_guard before insert or update or delete on public.invoice_payments
  for each row execute function public.invoice_payments_guard();

create or replace function public.invoice_payments_apply() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_paid numeric;
  v_total numeric;
begin
  select coalesce(sum(case when kind = 'payment' then amount else -amount end), 0) into v_paid
    from public.invoice_payments where invoice_id = new.invoice_id;
  select total into v_total from public.invoices where id = new.invoice_id;
  update public.invoices set amount_paid = v_paid, status = public.invoice_status_for(v_paid, v_total) where id = new.invoice_id;
  insert into public.invoice_events (invoice_id, event, detail)
    values (new.invoice_id, case when new.kind = 'payment' then 'payment_recorded' else 'payment_reversed' end,
      jsonb_build_object('payment_id', new.id, 'amount', new.amount, 'received_on', new.received_on, 'method', new.method,
        'reference', new.reference, 'reverses', new.reverses, 'note', new.note, 'amount_paid', v_paid));
  return null;
end
$fn$;

drop trigger if exists invoice_payments_apply on public.invoice_payments;
create trigger invoice_payments_apply after insert on public.invoice_payments
  for each row execute function public.invoice_payments_apply();

-- ---------------------------------------------------------------- 8. functions the page calls
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
  -- the guard checks Net 14 again (and records who approved it)
  update public.invoices set status = 'issued', terms = v_terms, credit_approved = coalesce(p_credit_approved, false)
   where id = p_invoice_id returning * into v;
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

-- Record a payment. Sending the same request key again returns the payment
-- already recorded and records nothing (a lost reply, a double click).
create or replace function public.record_invoice_payment(
  p_request_key uuid, p_invoice_id uuid, p_amount numeric, p_received_on date,
  p_method text default null, p_reference text default null, p_note text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.invoice_payments%rowtype;
  v_inv public.invoices%rowtype;
begin
  if not public.is_owner_or_admin() then
    raise exception 'Only the owner or an administrator can record payments.' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'A request key is required, so that a retry cannot record a payment twice.' using errcode = '22023';
  end if;
  select * into v from public.invoice_payments where request_key = p_request_key;
  if found then
    select * into v_inv from public.invoices where id = v.invoice_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', v.id, 'status', v_inv.status, 'amount_paid', v_inv.amount_paid);
  end if;
  insert into public.invoice_payments (request_key, invoice_id, kind, amount, received_on, method, reference, note)
    values (p_request_key, p_invoice_id, 'payment', p_amount, coalesce(p_received_on, (now() at time zone 'America/Chicago')::date),
            nullif(btrim(p_method), ''), nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''))
    returning * into v;
  select * into v_inv from public.invoices where id = p_invoice_id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'payment_id', v.id, 'status', v_inv.status, 'amount_paid', v_inv.amount_paid);
end
$fn$;

-- Correct a payment recorded in error: a linked reversal with a reason. The
-- original stays in the record.
create or replace function public.reverse_invoice_payment(p_request_key uuid, p_payment_id uuid, p_reason text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.invoice_payments%rowtype;
  v_orig public.invoice_payments%rowtype;
  v_inv public.invoices%rowtype;
begin
  if not public.is_owner_or_admin() then
    raise exception 'Only the owner or an administrator can reverse a payment.' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'A request key is required, so that a retry cannot reverse twice.' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'A written reason is required to reverse a payment.' using errcode = '22023';
  end if;
  select * into v from public.invoice_payments where request_key = p_request_key;
  if found then
    select * into v_inv from public.invoices where id = v.invoice_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'payment_id', v.id, 'status', v_inv.status, 'amount_paid', v_inv.amount_paid);
  end if;
  select * into v_orig from public.invoice_payments where id = p_payment_id;
  if not found then
    raise exception 'No such payment.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.invoice_payments where reverses = p_payment_id) then
    raise exception 'That payment has already been reversed.' using errcode = '22023';
  end if;
  insert into public.invoice_payments (request_key, invoice_id, kind, amount, received_on, reverses, note)
    values (p_request_key, v_orig.invoice_id, 'reversal', v_orig.amount, (now() at time zone 'America/Chicago')::date, p_payment_id, btrim(p_reason))
    returning * into v;
  select * into v_inv from public.invoices where id = v_orig.invoice_id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'payment_id', v.id, 'status', v_inv.status, 'amount_paid', v_inv.amount_paid);
end
$fn$;

-- ---------------------------------------------------------------- 9. audit: production's own audit trigger
-- The same trigger function the tasks table uses, attached to the new tables, so
-- every insert, change and delete also lands in audit_log with who and when.
-- Dynamic only because the function's name is read from production at install time.
do $audit$
declare
  v_nsp text;
  v_fn  text;
  v_tbl text;
begin
  select n.nspname, p.proname into v_nsp, v_fn
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  foreach v_tbl in array array['invoices', 'invoice_payments', 'invoice_counters'] loop
    execute format('drop trigger if exists %I on public.%I', v_tbl || '_audit', v_tbl);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function %I.%I()',
                   v_tbl || '_audit', v_tbl, v_nsp, v_fn);
  end loop;
end $audit$;

-- ---------------------------------------------------------------- 10. permissions
-- Visitors (anon) get nothing. Signed-in people go through the row rules below;
-- the guards above apply to everyone on top of them.
alter table public.invoices enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_events enable row level security;
revoke all on public.invoices, public.invoice_counters, public.invoice_payments, public.invoice_events from public, anon;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update on public.invoice_counters to authenticated;
grant select, insert on public.invoice_payments to authenticated;
grant select, insert on public.invoice_events to authenticated;

-- Nov 22: staff see an invoice they created, or one for an order they can see
-- (the orders table's own rules decide that). Unlinked invoices made by someone
-- else, payments and credit approvals of others' invoices: owner / administrator.
drop policy if exists invoices_staff_read on public.invoices;
create policy invoices_staff_read on public.invoices for select to authenticated using (public.is_active_staff() and (created_by = auth.uid() or (order_id is not null and exists (select 1 from public.orders o where o.id = invoices.order_id))));
drop policy if exists invoices_staff_draft_insert on public.invoices;
create policy invoices_staff_draft_insert on public.invoices for insert to authenticated with check (public.is_active_staff() and status = 'draft' and (order_id is null or exists (select 1 from public.orders o where o.id = invoices.order_id)));
drop policy if exists invoices_staff_draft_update on public.invoices;
create policy invoices_staff_draft_update on public.invoices for update to authenticated using (public.is_active_staff() and status = 'draft' and (created_by = auth.uid() or (order_id is not null and exists (select 1 from public.orders o where o.id = invoices.order_id)))) with check (public.is_active_staff() and status = 'draft');
drop policy if exists invoices_staff_draft_delete on public.invoices;
create policy invoices_staff_draft_delete on public.invoices for delete to authenticated using (public.is_active_staff() and status = 'draft' and (created_by = auth.uid() or (order_id is not null and exists (select 1 from public.orders o where o.id = invoices.order_id))));
drop policy if exists invoices_owner_admin_all on public.invoices;
create policy invoices_owner_admin_all on public.invoices for all to authenticated using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());

drop policy if exists invoice_counters_owner_admin on public.invoice_counters;
create policy invoice_counters_owner_admin on public.invoice_counters for all to authenticated using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());

drop policy if exists invoice_payments_owner_admin_read on public.invoice_payments;
create policy invoice_payments_owner_admin_read on public.invoice_payments for select to authenticated using (public.is_owner_or_admin());
drop policy if exists invoice_payments_owner_admin_add on public.invoice_payments;
create policy invoice_payments_owner_admin_add on public.invoice_payments for insert to authenticated with check (public.is_owner_or_admin());

drop policy if exists invoice_events_read on public.invoice_events;
create policy invoice_events_read on public.invoice_events for select to authenticated using (public.is_owner_or_admin() or (public.is_active_staff() and exists (select 1 from public.invoices i where i.id = invoice_events.invoice_id)));
drop policy if exists invoice_events_trigger_insert on public.invoice_events;
create policy invoice_events_trigger_insert on public.invoice_events for insert to authenticated with check (public.is_active_staff());

revoke all on function public.issue_invoice(uuid, text, boolean) from public, anon;
revoke all on function public.void_invoice(uuid, text) from public, anon;
revoke all on function public.record_invoice_payment(uuid, uuid, numeric, date, text, text, text) from public, anon;
revoke all on function public.reverse_invoice_payment(uuid, uuid, text) from public, anon;
revoke all on function public.invoices_guard() from public, anon;
revoke all on function public.invoices_no_delete_after_issue() from public, anon;
revoke all on function public.invoices_history() from public, anon;
revoke all on function public.invoice_events_guard() from public, anon;
revoke all on function public.invoice_payments_guard() from public, anon;
revoke all on function public.invoice_payments_apply() from public, anon;
revoke all on function public.invoice_lines_problem(jsonb) from public, anon;
revoke all on function public.invoice_lines_sum(jsonb) from public, anon;
revoke all on function public.invoice_bill_to_complete(jsonb) from public, anon;
revoke all on function public.invoice_number_text(integer, integer) from public, anon;
revoke all on function public.invoice_status_for(numeric, numeric) from public, anon;
grant execute on function public.issue_invoice(uuid, text, boolean) to authenticated;
grant execute on function public.void_invoice(uuid, text) to authenticated;
grant execute on function public.record_invoice_payment(uuid, uuid, numeric, date, text, text, text) to authenticated;
grant execute on function public.reverse_invoice_payment(uuid, uuid, text) to authenticated;
grant execute on function public.invoice_lines_problem(jsonb) to authenticated;
grant execute on function public.invoice_lines_sum(jsonb) to authenticated;
grant execute on function public.invoice_bill_to_complete(jsonb) to authenticated;
grant execute on function public.invoice_number_text(integer, integer) to authenticated;
grant execute on function public.invoice_status_for(numeric, numeric) to authenticated;

commit;
