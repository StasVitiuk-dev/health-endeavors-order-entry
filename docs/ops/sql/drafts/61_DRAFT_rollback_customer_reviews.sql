-- DRAFT (2026-11-24). NOT INSTALLED. ROLLBACK of drafts/60 (reviews the owner typed in).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   61   (ROLLBACK, rolls back 60)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, while any review is saved, unless deleting them was authorized in the session; stops if the table was not created by drafts/60
-- @effect:      drops the two functions, the table, its guard and the key function
-- @postcheck:   to_regclass('public.customer_reviews') is null
-- @rollback:    (this file is the rollback of drafts/60)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the customer_reviews table and its functions. Changes no other table.
-- After it, the Reviews page keeps reviews in each browser again, as before.
-- STOPS, and removes nothing, while any review is saved, unless deleting them
-- is authorized in the same session:
--     set he.rollback_delete_customer_reviews = 'yes, delete the saved reviews';
-- It also refuses to touch a table called customer_reviews that drafts/60 did
-- not create. Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_customer_reviews_install'));

do $guard$
declare v_rows bigint := 0;
begin
  if to_regclass('public.customer_reviews') is not null then
    if coalesce(obj_description(to_regclass('public.customer_reviews'), 'pg_class'), '') <> 'Health Endeavors drafts/60: reviews the owner typed in' then
      raise exception 'Rollback stopped: the table public.customer_reviews was not created by drafts/60. Nothing was removed.';
    end if;
    execute format('lock table %I.%I in access exclusive mode', 'public', 'customer_reviews');
    execute format('select count(*) from %I.%I', 'public', 'customer_reviews') into v_rows;
  end if;
  if v_rows > 0 and coalesce(current_setting('he.rollback_delete_customer_reviews', true), '') <> 'yes, delete the saved reviews' then
    raise exception 'Rollback stopped: % review(s) are saved. Authorize deleting them in this session.', v_rows;
  end if;
end
$guard$;

-- the guard refuses deletes row by row; dropping the table removes the rows without it
drop function if exists public.set_customer_review_status(uuid, text);
drop function if exists public.add_customer_reviews(jsonb);
drop table if exists public.customer_reviews;
drop function if exists public.customer_reviews_guard();
drop function if exists public.customer_review_key(text, date, text);

commit;
