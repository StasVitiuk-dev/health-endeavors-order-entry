-- DRAFT (2026-11-24). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   56   (PRODUCTION-CHANGE-DRAFT, step optional (owner decision of Nov 24: approve the wording of a campaign once, then choose who it goes to; a sending guard keeps the business out of spam). Records and rules only: nothing in it sends an email)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        MEDIUM
-- @precheck:    stops, changing nothing, if an email_campaigns, email_outbox or email_suppressions table exists that this file did not create (it checks its own marks); stops if auth.uid(), current_role(), is_owner_or_admin(), gen_random_uuid(), the tasks or audit_log table, or the audit trigger on tasks is missing
-- @effect:      3 new tables: email_campaigns (one row per approved wording; the wording never changes), email_outbox (one row per email to go out and what happened to it; never deleted), email_suppressions (the do-not-email list; only grows). approve_email_campaign() (the owner or an administrator; refuses a health claim), queue_campaign_emails() (the owner or an administrator; at most 500 at a time; leaves out unusable, suppressed and repeated addresses and stores written to in the last 90 days; gives each email the first working day with room), email_daily_cap() (20 a day in the first working week, then 40, 60, 80, 100; 0 on a weekend), set_email_campaign_status() (the owner or an administrator pauses, resumes, stops), add_email_suppression() (owner and administrators), next_emails_to_send() and record_email_result() (the sending program only, never a signed-in person). A bounce or spam complaint adds the address to the do-not-email list by itself; a campaign stops by itself after 2 complaints or when more than 5% of at least 20 sent emails came back. Production's audit trigger attached. No existing table changes. Holds customer and store email addresses
-- @postcheck:   the three tables present and empty; anon cannot read them; authenticated cannot execute next_emails_to_send or record_email_result; local-test/email_sending_test.sh passes on a throwaway copy
-- @rollback:    drafts/57
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 57_DRAFT_rollback_email_sending.sql.
-- Tested only on the local throwaway database (local-test/email_sending_test.sh).
--
-- NOTHING IN THIS FILE SENDS AN EMAIL. It only keeps the records that sending
-- needs, and the rules that keep sending safe. The program that hands emails to
-- an email service is separate, is not written here, and needs the owner's own
-- account with that service and the owner's approval of that specific step.
--
-- Why (owner, Nov 24): the owner approves the wording of a campaign once, then
-- chooses who it goes to; a sending guard keeps the business out of spam folders.
--   * email_campaigns     one row per approved wording: for stores or for
--     customers, the subject, the email, the business postal address, who
--     approved it and when. The wording cannot change afterwards: a changed
--     text is a new campaign and a new approval.
--   * email_outbox        one row per email to go out: the campaign, the address,
--     the day it may go, and what happened to it (queued, sent, failed, bounced,
--     complaint, skipped with the reason). An address is in a campaign once.
--   * email_suppressions  the do-not-email list: an address that unsubscribed,
--     bounced, or was marked as spam is never written to again.
--
-- The sending guard, enforced here and not only on the page:
--   * a slow start: 20 emails a day in the first working week of sending, then
--     40, 60, 80, and 100 a day from the fifth week; never on a weekend;
--   * a store is not written to again within 90 days;
--   * an address on the do-not-email list is never queued and never handed out;
--   * a bounce or a spam complaint puts the address on that list by itself;
--   * a campaign stops by itself after 2 spam complaints, or when more than 5% of
--     at least 20 sent emails came back; what was still queued is skipped;
--   * a wording with a health or medical claim (cure, treat, heal, prevent,
--     diagnose) is refused here too, as a backstop to the dashboard's check.
--
-- Who can see and do what: the owner and administrators approve a campaign,
-- queue its emails, and pause or stop it (owner decision of Nov 24: an
-- administrator is "almost like owner"; changed before this draft was installed;
-- who approved stays on each campaign). The owner and administrators read everything
-- and may add an address to the do-not-email list. Staff and visitors: nothing.
-- Only the sending program (which signs in as no person) may be handed emails
-- and may record what happened to them. SECURITY INVOKER throughout (project
-- rule). Production's own audit trigger (the one on `tasks`) is attached.
--
-- Honest limits
--   * The do-not-email list is permanent from the dashboard. Taking an address
--     off it after a mistake is a reviewed statement the owner runs.
--   * "Marketplace buyers are never emailed" is decided on the dashboard when
--     the list is built; this file cannot tell where an address came from.
--   * The outbox holds customer and store email addresses: real personal data,
--     readable by the owner and administrators only.
--   * It refuses to install over tables of these names that it did not create
--     (it checks its own marks), and changes no existing table.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_email_sending_install'));

do $pre$
declare
  missing text[] := '{}';
  v_tg record;
  v_name text;
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.current_role()') is null then missing := missing || 'function public.current_role()'::text; end if;
  if to_regprocedure('public.active_role()') is null then missing := missing || 'function public.active_role() (install step 0, drafts/72, first)'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regprocedure('gen_random_uuid()') is null then missing := missing || 'function gen_random_uuid()'::text; end if;
  if to_regclass('public.tasks') is null then missing := missing || 'table public.tasks (its audit trigger is reused)'::text; end if;
  if to_regclass('public.audit_log') is null then missing := missing || 'table public.audit_log'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
  foreach v_name in array array['email_campaigns', 'email_outbox', 'email_suppressions'] loop
    if to_regclass('public.' || v_name) is not null
       and coalesce(obj_description(to_regclass('public.' || v_name), 'pg_class'), '') not like 'Health Endeavors drafts/56:%' then
      raise exception 'Not installed: a table public.% already exists and was not created by this file. Nothing was changed; show this message before going further.', v_name;
    end if;
  end loop;
  select t.tgtype into v_tg from pg_trigger t
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  if not found then
    raise exception 'Not installed: the audit trigger on public.tasks was not found, so email sending could not be audited the same way.';
  end if;
  if (v_tg.tgtype & 1) = 0 or (v_tg.tgtype & 2) <> 0 or (v_tg.tgtype & 4) = 0 or (v_tg.tgtype & 8) = 0 or (v_tg.tgtype & 16) = 0 then
    raise exception 'Not installed: the audit trigger on public.tasks is not an AFTER INSERT OR UPDATE OR DELETE row trigger (type %); it cannot be reused as is.', v_tg.tgtype;
  end if;
end
$pre$;

-- ---------------------------------------------------------------- the tables
create table if not exists public.email_suppressions (
  email    text primary key check (email = lower(btrim(email)) and length(email) <= 254 and email ~ '^[^[:space:]@<>(),;:"'']+@[^[:space:]@<>(),;:"'']+\.[a-z]{2,}$'),
  reason   text not null check (reason in ('unsubscribed', 'bounced', 'complaint', 'owner')),
  note     text check (note is null or length(note) <= 500),
  added_by uuid default auth.uid(),
  added_at timestamptz not null default now()
);
comment on table public.email_suppressions is 'Health Endeavors drafts/56: the do-not-email list';

create table if not exists public.email_campaigns (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('store', 'customer')),
  name           text not null check (length(btrim(name)) between 3 and 120),
  subject        text not null check (length(btrim(subject)) between 5 and 120 and position(chr(10) in subject) = 0),
  body           text not null check (length(btrim(body)) between 40 and 2000),
  postal_address text not null check (length(btrim(postal_address)) between 10 and 300),
  status         text not null default 'approved' check (status in ('approved', 'paused', 'stopped', 'done')),
  stop_reason    text check (stop_reason is null or length(stop_reason) <= 500),
  approved_by    uuid not null default auth.uid(),
  approved_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.email_campaigns is 'Health Endeavors drafts/56: approved email campaigns';

create table if not exists public.email_outbox (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns (id),
  to_email    text not null check (to_email = lower(btrim(to_email)) and length(to_email) <= 254 and to_email ~ '^[^[:space:]@<>(),;:"'']+@[^[:space:]@<>(),;:"'']+\.[a-z]{2,}$'),
  to_name     text check (to_name is null or length(to_name) <= 160),
  fields      jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object' and length(fields::text) <= 600),
  send_on     date not null check (extract(isodow from send_on) < 6),
  status      text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'bounced', 'complaint', 'skipped')),
  skip_reason text check (skip_reason is null or length(skip_reason) <= 200),
  provider_id text check (provider_id is null or length(provider_id) <= 200),
  error       text check (error is null or length(error) <= 500),
  queued_by   uuid default auth.uid(),
  queued_at   timestamptz not null default now(),
  sent_at     timestamptz,
  updated_at  timestamptz not null default now(),
  unique (campaign_id, to_email)
);
comment on table public.email_outbox is 'Health Endeavors drafts/56: emails queued and what happened to them';
create index if not exists email_outbox_send_on_idx on public.email_outbox (send_on, status);
create index if not exists email_outbox_to_email_idx on public.email_outbox (to_email);

-- ---------------------------------------------------------------- guards (what may change, and by whom)
-- The do-not-email list only grows.
create or replace function public.email_suppressions_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op <> 'INSERT' then
    raise exception 'An address stays on the do-not-email list. Nothing was changed.' using errcode = '42501';
  end if;
  if auth.uid() is not null and not public.is_owner_or_admin() then
    raise exception 'Only the owner and administrators can add to the do-not-email list.' using errcode = '42501';
  end if;
  new.added_by := auth.uid();
  new.added_at := now();
  return new;
end
$fn$;
drop trigger if exists email_suppressions_guard on public.email_suppressions;
create trigger email_suppressions_guard before insert or update or delete on public.email_suppressions
  for each row execute function public.email_suppressions_guard();

-- A campaign is approved by the signed-in owner; its wording never changes; it is never deleted.
create or replace function public.email_campaigns_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'A campaign stays on the record; stop it instead.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if coalesce(public.active_role(), '') not in ('owner', 'administrator') then
      raise exception 'Only the owner or an administrator approves an email campaign.' using errcode = '42501';
    end if;
    if (new.subject || ' ' || new.body) ~* '\m(cures?|cured|curing|treats?|treated|treating|treatment|heals?|healed|healing|prevents?|prevented|diagnos[a-z]*)\M' then
      raise exception 'This wording makes a health or medical claim. A body-care product may not; change the wording.' using errcode = '23514';
    end if;
    new.status := 'approved'; new.stop_reason := null;
    new.approved_by := auth.uid(); new.approved_at := now(); new.updated_at := now();
    return new;
  end if;
  if new.id is distinct from old.id or new.kind is distinct from old.kind or new.name is distinct from old.name
     or new.subject is distinct from old.subject or new.body is distinct from old.body
     or new.postal_address is distinct from old.postal_address
     or new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at then
    raise exception 'An approved campaign cannot be changed. A new wording is a new campaign and a new approval.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if old.status in ('stopped', 'done') then
      raise exception 'This campaign is %; it cannot be started again.', old.status using errcode = '42501';
    end if;
    -- a person may pause, resume or stop: the owner or an administrator. The sending program (no person) may stop or finish it.
    if auth.uid() is not null and coalesce(public.active_role(), '') not in ('owner', 'administrator') then
      raise exception 'Only the owner or an administrator can pause or stop a campaign.' using errcode = '42501';
    end if;
    if auth.uid() is null and new.status not in ('stopped', 'done') then
      raise exception 'Only the owner or an administrator can pause or resume a campaign.' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end
$fn$;
drop trigger if exists email_campaigns_guard on public.email_campaigns;
create trigger email_campaigns_guard before insert or update or delete on public.email_campaigns
  for each row execute function public.email_campaigns_guard();

-- An email in the outbox: who it is for never changes; a person may only skip a queued one;
-- only the sending program records sent, failed, bounced and complaint.
create or replace function public.email_outbox_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'An email stays on the record; skip it instead.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if coalesce(public.active_role(), '') not in ('owner', 'administrator') then
      raise exception 'Only the owner or an administrator queues the emails of a campaign.' using errcode = '42501';
    end if;
    new.status := 'queued'; new.skip_reason := null; new.provider_id := null; new.error := null; new.sent_at := null;
    new.queued_by := auth.uid(); new.queued_at := now(); new.updated_at := now();
    return new;
  end if;
  if new.id is distinct from old.id or new.campaign_id is distinct from old.campaign_id or new.to_email is distinct from old.to_email
     or new.to_name is distinct from old.to_name or new.fields is distinct from old.fields or new.send_on is distinct from old.send_on
     or new.queued_by is distinct from old.queued_by or new.queued_at is distinct from old.queued_at then
    raise exception 'Who an email is for, and its day, cannot change. Skip it and queue a new one instead.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'queued' and new.status in ('sent', 'failed', 'skipped'))
         or (old.status = 'sent' and new.status in ('bounced', 'complaint'))) then
      raise exception 'An email that is % cannot become %.', old.status, new.status using errcode = '42501';
    end if;
    if auth.uid() is not null then
      if not public.is_owner_or_admin() or new.status <> 'skipped' then
        raise exception 'Only the sending program records what happened to an email. A person can only skip a queued one.' using errcode = '42501';
      end if;
    end if;
    if new.status = 'sent' then new.sent_at := now(); end if;
  elsif auth.uid() is not null and (new.provider_id is distinct from old.provider_id or new.error is distinct from old.error or new.sent_at is distinct from old.sent_at) then
    raise exception 'Only the sending program records what happened to an email.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end
$fn$;
drop trigger if exists email_outbox_guard on public.email_outbox;
create trigger email_outbox_guard before insert or update or delete on public.email_outbox
  for each row execute function public.email_outbox_guard();

-- After a bounce or a spam complaint: the address goes on the do-not-email list,
-- and the campaign stops by itself when the stop rule is met.
create or replace function public.email_outbox_after_result() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_sent bigint; v_bounced bigint; v_complaints bigint; v_why text;
begin
  if new.status is not distinct from old.status or new.status not in ('bounced', 'complaint') then return null; end if;
  insert into public.email_suppressions (email, reason, note)
    values (new.to_email, new.status, 'added by itself after an email came back or was marked as spam')
    on conflict (email) do nothing;
  update public.email_outbox set status = 'skipped', skip_reason = 'on the do-not-email list'
   where to_email = new.to_email and status = 'queued';
  select count(*) filter (where status in ('sent', 'bounced', 'complaint')),
         count(*) filter (where status = 'bounced'), count(*) filter (where status = 'complaint')
    into v_sent, v_bounced, v_complaints
    from public.email_outbox where campaign_id = new.campaign_id;
  if v_complaints >= 2 then
    v_why := v_complaints || ' people marked the email as spam.';
  elsif v_sent >= 20 and v_bounced::numeric / v_sent > 0.05 then
    v_why := v_bounced || ' of ' || v_sent || ' emails came back (more than 5%).';
  end if;
  if v_why is not null then
    update public.email_campaigns set status = 'stopped', stop_reason = 'Stopped by itself: ' || v_why
     where id = new.campaign_id and status in ('approved', 'paused');
    if found then
      update public.email_outbox set status = 'skipped', skip_reason = 'the campaign stopped'
       where campaign_id = new.campaign_id and status = 'queued';
    end if;
  end if;
  return null;
end
$fn$;
drop trigger if exists email_outbox_after_result on public.email_outbox;
create trigger email_outbox_after_result after update on public.email_outbox
  for each row execute function public.email_outbox_after_result();

-- ---------------------------------------------------------------- the slow start
-- How many emails may go on a day: 20 a day in the first working week of sending,
-- then 40, 60, 80, and 100 from the fifth week. 0 on a weekend.
create or replace function public.email_daily_cap(p_day date) returns integer
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_first date; v_days integer;
begin
  if p_day is null or extract(isodow from p_day) >= 6 then return 0; end if;
  select min(send_on) into v_first from public.email_outbox where status in ('queued', 'sent', 'bounced', 'complaint');
  if v_first is null or v_first >= p_day then return 20; end if;
  select count(*) into v_days from generate_series(v_first, p_day - 1, interval '1 day') d where extract(isodow from d) < 6;
  return (array[20, 40, 60, 80, 100])[least(v_days / 5, 4) + 1];
end
$fn$;

-- ---------------------------------------------------------------- the owner or an administrator approves a wording
create or replace function public.approve_email_campaign(p_kind text, p_name text, p_subject text, p_body text, p_postal_address text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v public.email_campaigns%rowtype;
begin
  if coalesce(public.active_role(), '') not in ('owner', 'administrator') then
    raise exception 'Only the owner or an administrator approves an email campaign.' using errcode = '42501';
  end if;
  insert into public.email_campaigns (kind, name, subject, body, postal_address)
    values (coalesce(p_kind, ''), btrim(coalesce(p_name, '')), btrim(coalesce(p_subject, '')), btrim(coalesce(p_body, '')), btrim(coalesce(p_postal_address, '')))
    returning * into v;
  return jsonb_build_object('ok', true, 'id', v.id, 'status', v.status, 'approved_at', v.approved_at, 'sent', false);
end
$fn$;

-- ---------------------------------------------------------------- the owner or an administrator chooses who it goes to
-- p_recipients: [{ "email": "...", "name": "...", "fields": { ... } }], at most 500 at a time.
-- Each address is checked against the guard, and given the first working day that still has room.
create or replace function public.queue_campaign_emails(p_campaign uuid, p_recipients jsonb, p_start date default current_date) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_c public.email_campaigns%rowtype;
  v_r jsonb; v_email text; v_day date; v_used integer; v_tries integer;
  v_queued integer := 0; v_skipped jsonb := '[]'::jsonb; v_first date; v_last date;
begin
  if coalesce(public.active_role(), '') not in ('owner', 'administrator') then
    raise exception 'Only the owner or an administrator queues the emails of a campaign.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('health_endeavors_email_queue'));   -- two queues at once would both count the same room
  select * into v_c from public.email_campaigns where id = p_campaign for update;
  if not found then raise exception 'This campaign was not found.' using errcode = 'P0002'; end if;
  if v_c.status <> 'approved' then
    raise exception 'This campaign is %; emails can only be queued for a campaign that is approved and running.', v_c.status using errcode = '42501';
  end if;
  if p_recipients is null or jsonb_typeof(p_recipients) <> 'array' then
    raise exception 'Who it goes to must be a list.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_recipients) > 500 then
    raise exception 'At most 500 addresses at a time.' using errcode = '22023';
  end if;
  for v_r in select value from jsonb_array_elements(p_recipients) loop
    v_email := lower(btrim(coalesce(v_r ->> 'email', '')));
    if jsonb_typeof(v_r) <> 'object' or length(v_email) > 254 or v_email !~ '^[^[:space:]@<>(),;:"'']+@[^[:space:]@<>(),;:"'']+\.[a-z]{2,}$' then
      v_skipped := v_skipped || jsonb_build_object('email', left(v_email, 254), 'why', 'no usable email address'); continue;
    end if;
    if exists (select 1 from public.email_suppressions s where s.email = v_email) then
      v_skipped := v_skipped || jsonb_build_object('email', v_email, 'why', 'on the do-not-email list'); continue;
    end if;
    if exists (select 1 from public.email_outbox o where o.campaign_id = v_c.id and o.to_email = v_email) then
      v_skipped := v_skipped || jsonb_build_object('email', v_email, 'why', 'already in this campaign'); continue;
    end if;
    if v_c.kind = 'store' and exists (select 1 from public.email_outbox o join public.email_campaigns c on c.id = o.campaign_id
         where c.kind = 'store' and o.to_email = v_email and o.status in ('queued', 'sent') and o.send_on > current_date - 90) then
      v_skipped := v_skipped || jsonb_build_object('email', v_email, 'why', 'written to in the last 90 days'); continue;
    end if;
    -- the first working day, from the chosen start, that still has room under the slow start
    v_day := greatest(coalesce(p_start, current_date), current_date); v_tries := 0;
    loop
      v_tries := v_tries + 1;
      if v_tries > 800 then raise exception 'No free day was found within two years; queue fewer emails.' using errcode = '22023'; end if;
      if extract(isodow from v_day) < 6 then
        select count(*) into v_used from public.email_outbox where send_on = v_day and status in ('queued', 'sent', 'bounced', 'complaint');
        exit when v_used < public.email_daily_cap(v_day);
      end if;
      v_day := v_day + 1;
    end loop;
    insert into public.email_outbox (campaign_id, to_email, to_name, fields, send_on)
      values (v_c.id, v_email, nullif(left(btrim(coalesce(v_r ->> 'name', '')), 160), ''),
              case when jsonb_typeof(v_r -> 'fields') = 'object' and length((v_r -> 'fields')::text) <= 600 then v_r -> 'fields' else '{}'::jsonb end, v_day);
    v_queued := v_queued + 1;
    v_first := least(coalesce(v_first, v_day), v_day); v_last := greatest(coalesce(v_last, v_day), v_day);
  end loop;
  return jsonb_build_object('ok', true, 'queued', v_queued, 'skipped', v_skipped, 'first_day', v_first, 'last_day', v_last, 'sent', false);
end
$fn$;

-- ---------------------------------------------------------------- pause, resume, stop
create or replace function public.set_email_campaign_status(p_campaign uuid, p_status text, p_reason text default null) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v public.email_campaigns%rowtype; v_skipped bigint := 0;
begin
  if coalesce(public.active_role(), '') not in ('owner', 'administrator') then
    raise exception 'Only the owner or an administrator can pause or stop a campaign.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('approved', 'paused', 'stopped') then
    raise exception 'A campaign can be paused, resumed or stopped.' using errcode = '22023';
  end if;
  update public.email_campaigns set status = p_status,
         stop_reason = case when p_status = 'stopped' then 'Stopped by ' || case when coalesce(public.active_role(), '') = 'owner' then 'the owner' else 'an administrator' end || coalesce(': ' || nullif(left(btrim(p_reason), 400), ''), '.') else null end
   where id = p_campaign returning * into v;
  if not found then raise exception 'This campaign was not found.' using errcode = 'P0002'; end if;
  if p_status = 'stopped' then
    with s as (update public.email_outbox set status = 'skipped', skip_reason = 'the campaign stopped'
                where campaign_id = p_campaign and status = 'queued' returning 1)
    select count(*) into v_skipped from s;
  end if;
  return jsonb_build_object('ok', true, 'id', v.id, 'status', v.status, 'skipped', v_skipped);
end
$fn$;

-- ---------------------------------------------------------------- someone asks not to be emailed
create or replace function public.add_email_suppression(p_email text, p_reason text default 'unsubscribed', p_note text default null) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_new boolean; v_skipped bigint := 0;
begin
  if auth.uid() is not null and not public.is_owner_or_admin() then
    raise exception 'Only the owner and administrators can add to the do-not-email list.' using errcode = '42501';
  end if;
  insert into public.email_suppressions (email, reason, note)
    values (v_email, coalesce(p_reason, 'unsubscribed'), nullif(left(btrim(coalesce(p_note, '')), 500), ''))
    on conflict (email) do nothing;
  v_new := found;
  with s as (update public.email_outbox set status = 'skipped', skip_reason = 'on the do-not-email list'
              where to_email = v_email and status = 'queued' returning 1)
  select count(*) into v_skipped from s;
  return jsonb_build_object('ok', true, 'email', v_email, 'added', v_new, 'skipped', v_skipped);
end
$fn$;

-- ---------------------------------------------------------------- for the sending program only
-- Hands out the emails that may go today: queued, due, in a running campaign, not on the
-- do-not-email list, and never more than today's room. A person signed in to the dashboard
-- cannot call it.
create or replace function public.next_emails_to_send(p_limit integer default 50)
returns table (id uuid, campaign_id uuid, kind text, to_email text, to_name text, fields jsonb, subject text, body text, postal_address text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v_room integer;
begin
  if auth.uid() is not null then
    raise exception 'Only the sending program is handed emails to send.' using errcode = '42501';
  end if;
  select public.email_daily_cap(current_date) - count(*) into v_room
    from public.email_outbox o where o.status in ('sent', 'bounced', 'complaint') and o.sent_at >= current_date and o.sent_at < current_date + 1;
  return query
    select o.id, o.campaign_id, c.kind, o.to_email, o.to_name, o.fields, c.subject, c.body, c.postal_address
      from public.email_outbox o join public.email_campaigns c on c.id = o.campaign_id
     where o.status = 'queued' and o.send_on <= current_date and c.status = 'approved'
       and not exists (select 1 from public.email_suppressions s where s.email = o.to_email)
     order by o.send_on, o.queued_at, o.id
     limit greatest(0, least(coalesce(p_limit, 50), 100, coalesce(v_room, 0)));
end
$fn$;

create or replace function public.record_email_result(p_id uuid, p_status text, p_provider_id text default null, p_error text default null) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v public.email_outbox%rowtype;
begin
  if auth.uid() is not null then
    raise exception 'Only the sending program records what happened to an email.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('sent', 'failed', 'bounced', 'complaint') then
    raise exception 'What happened must be sent, failed, bounced or complaint.' using errcode = '22023';
  end if;
  update public.email_outbox set status = p_status,
         provider_id = coalesce(nullif(left(btrim(coalesce(p_provider_id, '')), 200), ''), provider_id),
         error = nullif(left(btrim(coalesce(p_error, '')), 500), '')
   where id = p_id returning * into v;
  if not found then raise exception 'This email was not found.' using errcode = 'P0002'; end if;
  return jsonb_build_object('ok', true, 'id', v.id, 'status', v.status);
end
$fn$;

-- ---------------------------------------------------------------- audit: production's own audit trigger
-- Dynamic only because the function's name is read from production at install time.
do $audit$
declare
  v_nsp text;
  v_fn  text;
  v_t   text;
begin
  select n.nspname, p.proname into v_nsp, v_fn
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  foreach v_t in array array['email_campaigns', 'email_outbox', 'email_suppressions'] loop
    execute format('drop trigger if exists %I on public.%I', v_t || '_audit', v_t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function %I.%I()',
                   v_t || '_audit', v_t, v_nsp, v_fn);
  end loop;
end $audit$;

-- ---------------------------------------------------------------- who can see and do what
alter table public.email_suppressions enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_outbox enable row level security;
revoke all on public.email_suppressions, public.email_campaigns, public.email_outbox from public, anon;
grant select, insert on public.email_suppressions to authenticated;
grant select, insert, update on public.email_campaigns to authenticated;
grant select, insert, update on public.email_outbox to authenticated;

drop policy if exists email_suppressions_read on public.email_suppressions;
create policy email_suppressions_read on public.email_suppressions for select to authenticated using (public.is_owner_or_admin());
drop policy if exists email_suppressions_add on public.email_suppressions;
create policy email_suppressions_add on public.email_suppressions for insert to authenticated with check (public.is_owner_or_admin());

drop policy if exists email_campaigns_read on public.email_campaigns;
create policy email_campaigns_read on public.email_campaigns for select to authenticated using (public.is_owner_or_admin());
drop policy if exists email_campaigns_owner_add on public.email_campaigns;
create policy email_campaigns_owner_add on public.email_campaigns for insert to authenticated with check (coalesce(public.active_role(), '') in ('owner', 'administrator'));
drop policy if exists email_campaigns_owner_change on public.email_campaigns;
create policy email_campaigns_owner_change on public.email_campaigns for update to authenticated
  using (coalesce(public.active_role(), '') in ('owner', 'administrator')) with check (coalesce(public.active_role(), '') in ('owner', 'administrator'));

drop policy if exists email_outbox_read on public.email_outbox;
create policy email_outbox_read on public.email_outbox for select to authenticated using (public.is_owner_or_admin());
drop policy if exists email_outbox_owner_add on public.email_outbox;
create policy email_outbox_owner_add on public.email_outbox for insert to authenticated with check (coalesce(public.active_role(), '') in ('owner', 'administrator'));
drop policy if exists email_outbox_skip on public.email_outbox;
create policy email_outbox_skip on public.email_outbox for update to authenticated
  using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());

revoke all on function public.email_suppressions_guard() from public, anon;
revoke all on function public.email_campaigns_guard() from public, anon;
revoke all on function public.email_outbox_guard() from public, anon;
revoke all on function public.email_outbox_after_result() from public, anon;
revoke all on function public.email_daily_cap(date) from public, anon;
revoke all on function public.approve_email_campaign(text, text, text, text, text) from public, anon;
revoke all on function public.queue_campaign_emails(uuid, jsonb, date) from public, anon;
revoke all on function public.set_email_campaign_status(uuid, text, text) from public, anon;
revoke all on function public.add_email_suppression(text, text, text) from public, anon;
revoke all on function public.next_emails_to_send(integer) from public, anon, authenticated;
revoke all on function public.record_email_result(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.email_daily_cap(date) to authenticated;
grant execute on function public.approve_email_campaign(text, text, text, text, text) to authenticated;
grant execute on function public.queue_campaign_emails(uuid, jsonb, date) to authenticated;
grant execute on function public.set_email_campaign_status(uuid, text, text) to authenticated;
grant execute on function public.add_email_suppression(text, text, text) to authenticated;

commit;
