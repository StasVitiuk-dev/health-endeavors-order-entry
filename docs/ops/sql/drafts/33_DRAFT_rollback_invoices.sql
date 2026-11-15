-- DRAFT (2026-11-15). NOT INSTALLED. Rollback of 32_DRAFT_invoices.sql. Needs
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   33   (ROLLBACK, rolls back 32)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, if any issued or void invoice exists (business records)
-- @effect:      drops the two functions, the guard and the two tables; drafts are removed with them
-- @postcheck:   to_regclass('public.invoices') is null
-- @rollback:    (this file is the rollback of drafts/32)
-- @@ end metadata @@
-- the owner's written approval. DO NOT RUN until then.
--
-- Removes the invoice functions, the guard, and the two tables. It changes no
-- other table.
--
-- STOPS, and removes nothing, if any invoice has already been issued or voided:
-- those rows are business records (the owner decided on Nov 14 that issued and
-- voided numbers stay on the record). To remove the tables then, export the
-- rows first and take that decision separately — this file will not do it.
-- Drafts alone do not stop it; they are listed in the notice and removed.
-- Safe to run twice (IF EXISTS everywhere).
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_invoices_install'));

do $guard$
declare
  v_kept bigint := 0;
  v_drafts bigint := 0;
begin
  if to_regclass('public.invoices') is not null then
    -- dynamic, so the statement is not planned where the table is missing
    execute format('select count(*) filter (where status <> %L), count(*) filter (where status = %L) from %I.%I', 'draft', 'draft', 'public', 'invoices') into v_kept, v_drafts;
    if v_kept > 0 then
      raise exception 'Not rolled back: % issued or void invoice(s) exist. They are business records. Export them and decide separately.', v_kept;
    end if;
    raise notice 'Removing the invoice tables. Drafts removed with them: %.', v_drafts;
  else
    raise notice 'Nothing to remove: the invoice tables are not installed.';
  end if;
end $guard$;

drop function if exists public.issue_invoice(uuid, text, boolean);
drop function if exists public.void_invoice(uuid, text);
drop table if exists public.invoices;
drop function if exists public.invoices_guard();
drop function if exists public.invoices_no_delete_after_issue();
drop table if exists public.invoice_counters;

commit;
