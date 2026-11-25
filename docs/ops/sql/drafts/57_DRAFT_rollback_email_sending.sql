-- DRAFT (2026-11-24). NOT INSTALLED. ROLLBACK of drafts/56 (email sending records).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   57   (ROLLBACK, rolls back 56)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        MEDIUM
-- @precheck:    stops, removing nothing, while any campaign, email or do-not-email address is saved, unless deleting them was authorized in the session; stops if a table of these names was not created by drafts/56
-- @effect:      drops the six functions, the three tables, their guards and the daily-cap function; no other table touched. The do-not-email list is lost with it: save it first
-- @postcheck:   to_regclass('public.email_outbox') is null
-- @rollback:    (this file is the rollback of drafts/56)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the email campaign, outbox and do-not-email tables and their functions.
-- Changes no other table. After it, nothing can be queued or handed to a sending
-- program.
-- STOPS, and removes nothing, while any campaign, email or do-not-email address
-- is on record: the do-not-email list in particular is a promise to people who
-- asked not to be written to. Save it first; deleting the records must be
-- authorized in the same session:
--     set he.rollback_delete_email_sending = 'yes, delete the email records';
-- It also refuses to touch tables of these names that drafts/56 did not create.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_email_sending_install'));

do $guard$
declare
  v_rows bigint := 0; v_n bigint; v_name text;
begin
  foreach v_name in array array['email_outbox', 'email_campaigns', 'email_suppressions'] loop
    if to_regclass('public.' || v_name) is not null then
      if coalesce(obj_description(to_regclass('public.' || v_name), 'pg_class'), '') not like 'Health Endeavors drafts/56:%' then
        raise exception 'Rollback stopped: the table public.% was not created by drafts/56. Nothing was removed.', v_name;
      end if;
      execute format('lock table %I.%I in access exclusive mode', 'public', v_name);
      execute format('select count(*) from %I.%I', 'public', v_name) into v_n;
      v_rows := v_rows + v_n;
    end if;
  end loop;
  if v_rows > 0 and coalesce(current_setting('he.rollback_delete_email_sending', true), '') <> 'yes, delete the email records' then
    raise exception 'Rollback stopped: % email record(s) are saved (campaigns, emails, do-not-email addresses). Save the do-not-email list, then authorize deleting them in this session.', v_rows;
  end if;
end
$guard$;

-- the guards refuse deletes row by row; dropping the tables removes the rows without them
drop function if exists public.record_email_result(uuid, text, text, text);
drop function if exists public.next_emails_to_send(integer);
drop function if exists public.add_email_suppression(text, text, text);
drop function if exists public.set_email_campaign_status(uuid, text, text);
drop function if exists public.queue_campaign_emails(uuid, jsonb, date);
drop function if exists public.approve_email_campaign(text, text, text, text, text);
drop table if exists public.email_outbox;
drop table if exists public.email_campaigns;
drop table if exists public.email_suppressions;
drop function if exists public.email_daily_cap(date);
drop function if exists public.email_outbox_after_result();
drop function if exists public.email_outbox_guard();
drop function if exists public.email_campaigns_guard();
drop function if exists public.email_suppressions_guard();

commit;
