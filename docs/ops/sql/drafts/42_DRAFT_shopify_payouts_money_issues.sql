-- DRAFT (2026-11-22). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   42   (PRODUCTION-CHANGE-DRAFT, step optional (before the automatic Shopify feed; owner request of Nov 22))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops if auth.uid() or is_owner_or_admin() is missing
-- @effect:      3 new tables: a read-only copy of Shopify payouts and their transactions (written only by the daily sync with the service role) and the list of money differences (open until the owner or an administrator marks one checked with a note; never deleted); check_shopify_payouts(), record_money_issue(), mark_money_issue_checked(); owner and administrators read, staff and visitors nothing; no existing table changes
-- @postcheck:   the three tables present and empty; anon cannot read them; local-test/shopify_payouts_test.sh passes on a throwaway copy
-- @rollback:    drafts/43
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 43_DRAFT_rollback_shopify_payouts_money_issues.sql.
-- Tested only on the local throwaway database (local-test/shopify_payouts_test.sh).
--
-- Why (owner request of Nov 22): match every transaction automatically and say
-- somewhere when something does not match.
--   * shopify_payouts, shopify_balance_transactions   a read-only copy of Shopify
--     Payments payouts and the charges, refunds, fees and adjustments inside them,
--     written ONLY by the daily sync (docs/ops/edge-drafts/shopify-payouts-sync,
--     running with the service role); nobody signed in can write them
--   * money_match_issues   every difference found, by the daily check or saved
--     from the Money matching screen; it stays OPEN until the owner or an
--     administrator marks it checked with a written note; never deleted
--   * check_shopify_payouts()   each payout must equal the net of its own
--     transactions (charges and refunds minus fees, adjustments included; the
--     payout's own TRANSFER line left out); a payout that does not add up
--     becomes an open issue, once (re-running adds nothing)
--   * record_money_issue(...)  the screen saves a difference it found in a bank
--     or card file (owner or administrator; the same difference twice is one issue)
--   * mark_money_issue_checked(id, note)  owner or administrator, written note
--
-- Who can see what: owner and administrators read all three tables; staff and
-- visitors read nothing. SECURITY INVOKER throughout (project rule).
--
-- Honest limits
--   * The sync itself (an Edge Function on a daily schedule with a Shopify access
--     key stored as a Supabase secret) is a separate, reviewed step; this file only
--     prepares where its data goes and how differences are recorded.
--   * Bank deposits are not stored here: the bank file is read in the browser.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_money_issues_install'));

do $pre$
declare missing text[] := '{}';
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
end
$pre$;

create table if not exists public.shopify_payouts (
  id            text primary key,                       -- Shopify's payout id (gid)
  issued_at     timestamptz not null,
  status        text not null check (length(status) between 1 and 40),
  net           numeric(12,2) not null,
  currency      text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  synced_at     timestamptz not null default now()
);

create table if not exists public.shopify_balance_transactions (
  id            text primary key,                       -- Shopify's balance transaction id (gid)
  payout_id     text,                                   -- null until Shopify assigns a payout
  type          text not null check (length(type) between 1 and 40),
  amount        numeric(12,2) not null,
  fee           numeric(12,2) not null default 0,
  net           numeric(12,2) not null,
  currency      text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  order_ref     text check (order_ref is null or length(order_ref) <= 120),
  occurred_at   timestamptz,
  test          boolean not null default false,
  synced_at     timestamptz not null default now(),
  constraint shopify_balance_transactions_net check (net = amount - fee)
);
create index if not exists shopify_balance_transactions_by_payout on public.shopify_balance_transactions (payout_id);

create table if not exists public.money_match_issues (
  id              uuid primary key default gen_random_uuid(),
  -- one per difference: the daily check and a second save of the same file add nothing
  issue_key       text not null unique check (length(issue_key) between 3 and 200),
  source          text not null check (source in ('shopify_payout', 'bank', 'card')),
  outcome         text not null check (outcome in ('MISSING', 'AMOUNT_DIFFERS', 'DOUBLED', 'UNEXPECTED', 'NOT_RECORDED', 'UNKNOWN')),
  summary         text not null check (length(summary) between 3 and 300),
  expected        numeric(12,2),
  found           numeric(12,2),
  occurred_on     date,
  status          text not null default 'open' check (status in ('open', 'checked')),
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  checked_by      uuid,
  checked_at      timestamptz,
  check_note      text check (check_note is null or length(check_note) <= 500),
  constraint money_match_issues_checked_has_note check (
    status = 'open' or (checked_by is not null and checked_at is not null and length(btrim(coalesce(check_note, ''))) >= 5))
);
create index if not exists money_match_issues_open on public.money_match_issues (status, created_at);

-- An issue keeps what was found; only its status moves, once, from open to
-- checked, by the owner or an administrator with a note. Never deleted.
create or replace function public.money_match_issues_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'A difference stays on the record; mark it checked instead.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'open'; new.checked_by := null; new.checked_at := null; new.check_note := null;
    new.created_at := now();
    if auth.uid() is not null then new.created_by := auth.uid(); end if;
    return new;
  end if;
  if new.issue_key is distinct from old.issue_key or new.source is distinct from old.source or new.outcome is distinct from old.outcome
     or new.summary is distinct from old.summary or new.expected is distinct from old.expected or new.found is distinct from old.found
     or new.occurred_on is distinct from old.occurred_on or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'What was found cannot be changed; only its status.' using errcode = '42501';
  end if;
  if old.status = 'checked' then
    raise exception 'This difference was already checked.' using errcode = '22023';
  end if;
  if not public.is_owner_or_admin() then
    raise exception 'Only the owner or an administrator can mark a difference checked.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(new.check_note, ''))) < 5 then
    raise exception 'Write what you found (at least 5 characters).' using errcode = '22023';
  end if;
  new.checked_by := auth.uid(); new.checked_at := now(); new.check_note := btrim(new.check_note);
  return new;
end
$fn$;
drop trigger if exists money_match_issues_guard on public.money_match_issues;
create trigger money_match_issues_guard before insert or update or delete on public.money_match_issues
  for each row execute function public.money_match_issues_guard();

-- ---------------------------------------------------------------- the daily check
-- Every payout against the net of its own transactions (the payout's TRANSFER
-- lines and test transactions left out). Returns how many new issues it added.
create or replace function public.check_shopify_payouts() returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_added integer := 0;
  n integer;
  p record;
begin
  if auth.uid() is not null and not public.is_owner_or_admin() then
    raise exception 'Only the owner or an administrator can run the payout check.' using errcode = '42501';
  end if;
  for p in
    select po.id, po.net, po.issued_at,
           coalesce(sum(t.net) filter (where t.type not in ('TRANSFER', 'TRANSFER_FAILURE', 'TRANSFER_CANCEL') and not t.test), 0) as inside,
           count(t.id) filter (where t.type not in ('TRANSFER', 'TRANSFER_FAILURE', 'TRANSFER_CANCEL') and not t.test) as n_tx
      from public.shopify_payouts po
      left join public.shopify_balance_transactions t on t.payout_id = po.id
     group by po.id, po.net, po.issued_at
  loop
    if p.inside <> p.net then
      insert into public.money_match_issues (issue_key, source, outcome, summary, expected, found, occurred_on)
        values ('shopify_payout:' || p.id || ':' || p.net || ':' || p.inside, 'shopify_payout', 'AMOUNT_DIFFERS',
                'Shopify payout of $' || to_char(p.net, 'FM999999990.00') || ': its ' || p.n_tx || ' transaction(s) add up to $' || to_char(p.inside, 'FM999999990.00'),
                p.net, p.inside, (p.issued_at at time zone 'America/Chicago')::date)
        on conflict (issue_key) do nothing;
      get diagnostics n = row_count;
      v_added := v_added + n;
    end if;
  end loop;
  return v_added;
end
$fn$;

-- ---------------------------------------------------------------- the screen saves what it found
create or replace function public.record_money_issue(p_issue_key text, p_source text, p_outcome text, p_summary text,
  p_expected numeric default null, p_found numeric default null, p_occurred_on date default null) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v public.money_match_issues%rowtype;
begin
  if not public.is_owner_or_admin() then
    raise exception 'Only the owner or an administrator can save differences.' using errcode = '42501';
  end if;
  insert into public.money_match_issues (issue_key, source, outcome, summary, expected, found, occurred_on)
    values (btrim(p_issue_key), p_source, p_outcome, btrim(p_summary), p_expected, p_found, p_occurred_on)
    on conflict (issue_key) do nothing
    returning * into v;
  if not found then
    select * into v from public.money_match_issues where issue_key = btrim(p_issue_key);
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', v.id, 'status', v.status);
  end if;
  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v.id, 'status', v.status);
end
$fn$;

create or replace function public.mark_money_issue_checked(p_id uuid, p_note text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v public.money_match_issues%rowtype;
begin
  update public.money_match_issues set status = 'checked', check_note = p_note where id = p_id returning * into v;
  if not found then raise exception 'No such difference.' using errcode = 'P0002'; end if;
  return jsonb_build_object('ok', true, 'id', v.id, 'status', v.status, 'checked_at', v.checked_at);
end
$fn$;

-- ---------------------------------------------------------------- who can see and do what
alter table public.shopify_payouts enable row level security;
alter table public.shopify_balance_transactions enable row level security;
alter table public.money_match_issues enable row level security;
revoke all on public.shopify_payouts, public.shopify_balance_transactions, public.money_match_issues from public, anon;
grant select on public.shopify_payouts, public.shopify_balance_transactions to authenticated;
grant select, insert, update on public.money_match_issues to authenticated;
drop policy if exists shopify_payouts_read on public.shopify_payouts;
create policy shopify_payouts_read on public.shopify_payouts for select to authenticated using (public.is_owner_or_admin());
drop policy if exists shopify_balance_transactions_read on public.shopify_balance_transactions;
create policy shopify_balance_transactions_read on public.shopify_balance_transactions for select to authenticated using (public.is_owner_or_admin());
drop policy if exists money_match_issues_read on public.money_match_issues;
create policy money_match_issues_read on public.money_match_issues for select to authenticated using (public.is_owner_or_admin());
drop policy if exists money_match_issues_add on public.money_match_issues;
create policy money_match_issues_add on public.money_match_issues for insert to authenticated with check (public.is_owner_or_admin());
drop policy if exists money_match_issues_check on public.money_match_issues;
create policy money_match_issues_check on public.money_match_issues for update to authenticated using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());

revoke all on function public.check_shopify_payouts() from public, anon;
revoke all on function public.record_money_issue(text, text, text, text, numeric, numeric, date) from public, anon;
revoke all on function public.mark_money_issue_checked(uuid, text) from public, anon;
revoke all on function public.money_match_issues_guard() from public, anon;
grant execute on function public.check_shopify_payouts() to authenticated;
grant execute on function public.record_money_issue(text, text, text, text, numeric, numeric, date) to authenticated;
grant execute on function public.mark_money_issue_checked(uuid, text) to authenticated;

commit;
