-- DRAFT (2026-11-15, revised 2026-11-22). NOT INSTALLED. Rollback of 32_DRAFT_invoices.sql. Needs
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   33   (ROLLBACK, rolls back 32)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, if any issued, paid or void invoice exists, or if any draft exists and its deletion was not separately authorized in the session; locks the invoices table first so nothing is issued meanwhile
-- @effect:      drops the four functions the page calls, the guards, the audit triggers and the four tables (authorized drafts and their history go with them)
-- @postcheck:   to_regclass('public.invoices') is null
-- @rollback:    (this file is the rollback of drafts/32)
-- @@ end metadata @@
-- the owner's written approval. DO NOT RUN until then.
--
-- Removes everything drafts/32 added: the payment, history and invoice tables,
-- their functions and guards, and the audit triggers it attached. It changes no
-- other table. Rows already copied into audit_log stay there.
--
-- What it refuses to do (Nov 22, owner review):
--   * it STOPS, and removes nothing, if any issued, paid or void invoice exists:
--     those rows are business records. Export them and decide separately.
--   * it STOPS, and removes nothing, if any DRAFT invoice exists, unless deleting
--     those drafts was separately authorized in the same session, by running
--     this line first:
--         set he.rollback_delete_draft_invoices = 'yes, delete the drafts';
--     Drafts are deleted together with their history (invoice_events); the
--     message says how many.
--   * an invoice cannot be issued while this runs: it first takes the strongest
--     lock on the invoices table, so an issue in progress finishes first (and is
--     then seen, and refused above), and a new one waits until this has finished.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_invoices_install'));

do $guard$
declare
  v_kept bigint := 0;
  v_drafts bigint := 0;
begin
  if to_regclass('public.invoices') is null then
    raise notice 'Nothing to remove: the invoice tables are not installed.';
    return;
  end if;
  -- dynamic, so the statements are not planned where the table is missing
  execute format('lock table %I.%I in access exclusive mode', 'public', 'invoices');
  execute format('select count(*) filter (where status <> %L), count(*) filter (where status = %L) from %I.%I', 'draft', 'draft', 'public', 'invoices') into v_kept, v_drafts;
  if v_kept > 0 then
    raise exception 'Not rolled back: % issued, paid or void invoice(s) exist. They are business records. Export them and decide separately.', v_kept;
  end if;
  if v_drafts > 0 and coalesce(current_setting('he.rollback_delete_draft_invoices', true), '') <> 'yes, delete the drafts' then
    raise exception 'Not rolled back: % draft invoice(s) exist and would be deleted with their history. To allow that, run first in the same session: set he.rollback_delete_draft_invoices = ''yes, delete the drafts'';', v_drafts;
  end if;
  raise notice 'Removing the invoice tables. Draft invoices deleted with them: %.', v_drafts;
end $guard$;

drop function if exists public.record_invoice_payment(uuid, uuid, numeric, date, text, text, text);
drop function if exists public.reverse_invoice_payment(uuid, uuid, text);
drop function if exists public.issue_invoice(uuid, text, boolean);
drop function if exists public.void_invoice(uuid, text);
drop table if exists public.invoice_payments;
drop table if exists public.invoice_events;
drop table if exists public.invoices;
drop table if exists public.invoice_counters;
drop function if exists public.invoice_payments_guard();
drop function if exists public.invoice_payments_apply();
drop function if exists public.invoices_history();
drop function if exists public.invoice_events_guard();
drop function if exists public.invoices_guard();
drop function if exists public.invoices_no_delete_after_issue();
drop function if exists public.invoice_lines_problem(jsonb);
drop function if exists public.invoice_lines_sum(jsonb);
drop function if exists public.invoice_bill_to_complete(jsonb);
drop function if exists public.invoice_number_text(integer, integer);
drop function if exists public.invoice_status_for(numeric, numeric);

commit;
