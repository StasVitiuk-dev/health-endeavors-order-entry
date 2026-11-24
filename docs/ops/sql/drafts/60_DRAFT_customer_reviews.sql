-- DRAFT (2026-11-24). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   60   (PRODUCTION-CHANGE-DRAFT, step optional (owner rule of Nov 24: the same on every phone and computer; this one for the reviews the owner pastes or types in on the Reviews page). Records only: nothing in it posts or sends)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if a customer_reviews table exists that this file did not create (it checks its own mark); stops if auth.uid(), is_owner_or_admin(), gen_random_uuid(), the tasks or audit_log table, or the audit trigger on tasks is missing
-- @effect:      1 new table customer_reviews (one row per review: the site, the stars, the text, its date, a product, and whether it still needs a look); add_customer_reviews() adds up to 200 at a time and never keeps the same review twice (a removed one comes back as new); set_customer_review_status() marks one new, answered, no reply needed or removed; the owner and administrators only; a review is never deleted and only its status can change; production's audit trigger is attached; no existing table changes
-- @postcheck:   the table present and empty; anon cannot read it; local-test/customer_reviews_test.sh passes on a throwaway copy
-- @rollback:    drafts/61
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 61_DRAFT_rollback_customer_reviews.sql.
-- Tested only on the local throwaway database (local-test/customer_reviews_test.sh).
--
-- Why (owner rule of Nov 24: "everything the same on every phone and computer,
-- nothing kept in only one browser"): the Reviews page keeps the reviews the owner
-- pasted or typed in. Until this step they live in the one browser where they
-- were added. With it they are kept in the database, so every device of the
-- owner and the administrators shows the same reviews and the same "answered".
--   * customer_reviews   one row per review: where it was written, the stars,
--     the text, its date, and whether it still needs a look.
--   * add_customer_reviews(list)   adds up to 200 reviews; a review already
--     there is not added twice.
--   * set_customer_review_status(id, status)   'answered', 'noreply', 'new' or
--     'removed'.
--
-- NOTHING IS POSTED OR SENT. This file only keeps what the owner typed in. It
-- reads no site and writes to none.
--
-- Who can see and do what: the owner and administrators read, add and mark.
-- Staff, deactivated accounts and visitors: nothing. A review is never deleted:
-- "Remove" marks it removed, and it stays on the record. Only the status of a
-- review can change; its text, stars, site and date cannot.
-- SECURITY INVOKER throughout (project rule). Production's own audit trigger
-- (the one on `tasks`) is attached, so every change lands in audit_log.
--
-- Honest limits
--   * A review's text is what a customer wrote in public on a site. It can hold
--     a name or a phone number the customer typed; the dashboard hides such
--     details on screen, the stored text is unchanged.
--   * Another device sees a change when it next opens the Reviews page or Home.
--   * It refuses to install over a table called customer_reviews that it did
--     not create itself (it checks its own mark), and changes no existing table.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_customer_reviews_install'));

do $pre$
declare
  missing text[] := '{}';
  v_tg record;
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regprocedure('gen_random_uuid()') is null then missing := missing || 'function gen_random_uuid()'::text; end if;
  if to_regclass('public.tasks') is null then missing := missing || 'table public.tasks (its audit trigger is reused)'::text; end if;
  if to_regclass('public.audit_log') is null then missing := missing || 'table public.audit_log'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
  if to_regclass('public.customer_reviews') is not null
     and coalesce(obj_description(to_regclass('public.customer_reviews'), 'pg_class'), '') <> 'Health Endeavors drafts/60: reviews the owner typed in' then
    raise exception 'Not installed: a table public.customer_reviews already exists and was not created by this file. Nothing was changed; show this message before going further.';
  end if;
  select t.tgtype into v_tg from pg_trigger t
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  if not found then
    raise exception 'Not installed: the audit trigger on public.tasks was not found, so reviews could not be audited the same way.';
  end if;
  if (v_tg.tgtype & 1) = 0 or (v_tg.tgtype & 2) <> 0 or (v_tg.tgtype & 4) = 0 or (v_tg.tgtype & 8) = 0 or (v_tg.tgtype & 16) = 0 then
    raise exception 'Not installed: the audit trigger on public.tasks is not an AFTER INSERT OR UPDATE OR DELETE row trigger (type %); it cannot be reused as is.', v_tg.tgtype;
  end if;
end
$pre$;

create table if not exists public.customer_reviews (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null check (channel in ('website', 'amazon', 'etsy', 'tiktok', 'google', 'other')),
  stars       smallint not null check (stars between 1 and 5),
  review_text text not null check (length(review_text) between 3 and 2000),
  review_date date,
  product     text not null default '' check (length(product) <= 120),
  text_key    text not null unique,
  status      text not null default 'new' check (status in ('new', 'answered', 'noreply', 'removed')),
  status_at   timestamptz,
  status_by   uuid,
  added_by    uuid not null default auth.uid(),
  added_at    timestamptz not null default now()
);
comment on table public.customer_reviews is 'Health Endeavors drafts/60: reviews the owner typed in';

-- The same review is the same row: same site, same date, same words (capitals and
-- spacing do not count). The date is written out as YYYY-MM-DD so the key never
-- depends on a session's date style.
create or replace function public.customer_review_key(p_channel text, p_date date, p_text text) returns text
language sql
immutable
security invoker
set search_path = public, pg_temp
as $fn$
  select md5(coalesce(p_channel, '') || '|' || coalesce(to_char(p_date, 'YYYY-MM-DD'), '') || '|' || lower(regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g')));
$fn$;

-- Only the owner and administrators; a review is never deleted; only its status changes.
create or replace function public.customer_reviews_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'A review stays on the record; mark it removed instead.' using errcode = '42501';
  end if;
  if auth.uid() is null or not public.is_owner_or_admin() then
    raise exception 'Only the owner and administrators can keep reviews.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.review_text := btrim(new.review_text);
    new.product := btrim(coalesce(new.product, ''));
    new.text_key := public.customer_review_key(new.channel, new.review_date, new.review_text);
    new.status := 'new';
    new.status_at := null;
    new.status_by := null;
    new.added_by := auth.uid();          -- always the person who is signed in, whatever was typed
    new.added_at := now();
    return new;
  end if;
  if new.id is distinct from old.id or new.channel is distinct from old.channel or new.stars is distinct from old.stars
     or new.review_text is distinct from old.review_text or new.review_date is distinct from old.review_date
     or new.product is distinct from old.product or new.text_key is distinct from old.text_key
     or new.added_by is distinct from old.added_by or new.added_at is distinct from old.added_at then
    raise exception 'A review cannot be changed after it was added; only its status can.' using errcode = '42501';
  end if;
  new.status_at := now();
  new.status_by := auth.uid();
  return new;
end
$fn$;
drop trigger if exists customer_reviews_guard on public.customer_reviews;
create trigger customer_reviews_guard before insert or update or delete on public.customer_reviews
  for each row execute function public.customer_reviews_guard();

-- ---------------------------------------------------------------- adding reviews
-- p_reviews: a list of { channel, stars, text, date, product }. At most 200 at a
-- time. A line that is not a review is counted as refused, never guessed. A
-- review already there is not added twice; one that was removed comes back.
create or replace function public.add_customer_reviews(p_reviews jsonb) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  r jsonb;
  v_channel text; v_text text; v_product text; v_stars integer; v_date date; v_key text; v_status text;
  v_added integer := 0; v_dup integer := 0; v_refused integer := 0;
begin
  if auth.uid() is null or not public.is_owner_or_admin() then
    raise exception 'Only the owner and administrators can keep reviews.' using errcode = '42501';
  end if;
  if p_reviews is null or jsonb_typeof(p_reviews) <> 'array' then
    raise exception 'Give the reviews as a list.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_reviews) > 200 then
    raise exception 'At most 200 reviews at a time.' using errcode = '22023';
  end if;
  for r in select value from jsonb_array_elements(p_reviews) loop
    if jsonb_typeof(r) <> 'object' then v_refused := v_refused + 1; continue; end if;
    v_text := btrim(coalesce(r->>'text', ''));
    v_channel := lower(btrim(coalesce(r->>'channel', '')));
    if v_channel not in ('website', 'amazon', 'etsy', 'tiktok', 'google', 'other') then v_channel := 'other'; end if;
    v_product := left(btrim(coalesce(r->>'product', '')), 120);
    v_stars := case when coalesce(r->>'stars', '') ~ '^[1-5]$' then (r->>'stars')::integer else null end;
    if v_stars is null or length(v_text) < 3 or length(v_text) > 2000 then v_refused := v_refused + 1; continue; end if;
    v_date := null;
    if coalesce(r->>'date', '') <> '' then
      if (r->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then v_refused := v_refused + 1; continue; end if;
      begin
        v_date := to_date(r->>'date', 'YYYY-MM-DD');
      exception when others then
        v_refused := v_refused + 1; continue;
      end;
      if to_char(v_date, 'YYYY-MM-DD') <> (r->>'date') then v_refused := v_refused + 1; continue; end if;   -- "2026-02-31" is not a date
    end if;
    v_key := public.customer_review_key(v_channel, v_date, v_text);
    select status into v_status from public.customer_reviews where text_key = v_key for update;
    if not found then
      insert into public.customer_reviews (channel, stars, review_text, review_date, product, text_key)
        values (v_channel, v_stars, v_text, v_date, v_product, v_key);
      v_added := v_added + 1;
    elsif v_status = 'removed' then
      update public.customer_reviews set status = 'new' where text_key = v_key;
      v_added := v_added + 1;
    else
      v_dup := v_dup + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'added', v_added, 'duplicates', v_dup, 'refused', v_refused);
end
$fn$;

-- ---------------------------------------------------------------- marking a review
create or replace function public.set_customer_review_status(p_id uuid, p_status text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v public.customer_reviews%rowtype;
begin
  if auth.uid() is null or not public.is_owner_or_admin() then
    raise exception 'Only the owner and administrators can keep reviews.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('new', 'answered', 'noreply', 'removed') then
    raise exception 'A review is new, answered, needs no reply, or removed.' using errcode = '22023';
  end if;
  update public.customer_reviews set status = p_status where id = p_id returning * into v;
  if not found then
    raise exception 'That review is not on the list.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('ok', true, 'id', v.id, 'status', v.status, 'status_at', v.status_at);
end
$fn$;

-- ---------------------------------------------------------------- audit: production's own audit trigger
-- Dynamic only because the function's name is read from production at install time.
do $audit$
declare
  v_nsp text;
  v_fn  text;
begin
  select n.nspname, p.proname into v_nsp, v_fn
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  execute format('drop trigger if exists %I on public.%I', 'customer_reviews_audit', 'customer_reviews');
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function %I.%I()',
                 'customer_reviews_audit', 'customer_reviews', v_nsp, v_fn);
end $audit$;

-- ---------------------------------------------------------------- who can see and do what
alter table public.customer_reviews enable row level security;
revoke all on public.customer_reviews from public, anon;
grant select, insert, update on public.customer_reviews to authenticated;
drop policy if exists customer_reviews_read on public.customer_reviews;
create policy customer_reviews_read on public.customer_reviews for select to authenticated
  using (public.is_owner_or_admin());
drop policy if exists customer_reviews_add on public.customer_reviews;
create policy customer_reviews_add on public.customer_reviews for insert to authenticated
  with check (public.is_owner_or_admin());
drop policy if exists customer_reviews_change on public.customer_reviews;
create policy customer_reviews_change on public.customer_reviews for update to authenticated
  using (public.is_owner_or_admin())
  with check (public.is_owner_or_admin());

revoke all on function public.customer_review_key(text, date, text) from public, anon;
revoke all on function public.customer_reviews_guard() from public, anon;
revoke all on function public.add_customer_reviews(jsonb) from public, anon;
revoke all on function public.set_customer_review_status(uuid, text) from public, anon;
grant execute on function public.customer_review_key(text, date, text) to authenticated;
grant execute on function public.add_customer_reviews(jsonb) to authenticated;
grant execute on function public.set_customer_review_status(uuid, text) to authenticated;

commit;
