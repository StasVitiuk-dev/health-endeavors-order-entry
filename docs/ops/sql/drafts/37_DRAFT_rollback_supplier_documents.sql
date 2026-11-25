-- DRAFT (2026-11-16). NOT INSTALLED. Rollback of 36_DRAFT_supplier_documents.sql.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   37   (ROLLBACK, rolls back 36)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, if any approved or rejected supplier document exists (the record of the reviews)
-- @effect:      drops the functions, the guards and the seven tables; documents waiting for review or withdrawn, and hand-offs, are removed with them
-- @postcheck:   to_regclass('public.supplier_documents') is null
-- @rollback:    (this file is the rollback of drafts/36)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the supplier document functions, guards and the seven tables. It
-- changes no other table (suppliers and purchase orders are untouched).
--
-- STOPS, and removes nothing, if any document has been approved or rejected:
-- those rows and their history are the record of the owner's reviews. To remove
-- the tables then, export the rows first and take that decision separately —
-- this file will not do it. Documents still waiting for review, or withdrawn,
-- do not stop it; they are counted in the notice and removed.
-- Safe to run twice (IF EXISTS everywhere).
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_supplier_documents_install'));

do $guard$
declare
  v_kept bigint := 0;
  v_other bigint := 0;
begin
  if to_regclass('public.supplier_documents') is not null then
    -- dynamic, so the statement is not planned where the table is missing
    execute format('select count(*) filter (where status in (%L, %L)), count(*) filter (where status not in (%L, %L)) from %I.%I',
      'approved', 'rejected', 'approved', 'rejected', 'public', 'supplier_documents') into v_kept, v_other;
    if v_kept > 0 then
      raise exception 'Not rolled back: % approved or rejected supplier document(s) exist. They are the record of the reviews. Export them and decide separately.', v_kept;
    end if;
    raise notice 'Removing the supplier document tables. Documents waiting for review or withdrawn, removed: %.', v_other;
  else
    raise notice 'Nothing to remove: the supplier document tables are not installed.';
  end if;
end $guard$;

drop function if exists public.record_supplier_document(uuid, uuid, text, text, text, text, text, date, date, date, text);
drop function if exists public.review_supplier_document(uuid, text, text);
drop function if exists public.withdraw_supplier_document(uuid, text);
drop function if exists public.correct_supplier_document(uuid, text, date, date, date);
drop function if exists public.set_supplier_type_document_profiles(text, text[]);
drop function if exists public.set_supplier_document_profiles(uuid, text[]);
drop function if exists public.set_supplier_document_type_active(text, boolean);
drop function if exists public.attach_supplier_document_file(uuid, text, text, integer, text);
drop function if exists public.hand_off_supplier_document(uuid, uuid, text, text, text, date, text);
drop function if exists public.resolve_supplier_document_handoff(uuid, uuid);
drop function if exists public.dismiss_supplier_document_handoff(uuid, text);
drop table if exists public.supplier_document_events;
drop table if exists public.supplier_document_handoffs;
drop table if exists public.supplier_documents;
drop table if exists public.supplier_document_subjects;
drop table if exists public.supplier_document_supplier_profiles;
drop table if exists public.supplier_type_document_profiles;
drop table if exists public.supplier_document_types;
drop function if exists public.supplier_document_handoffs_guard();
drop function if exists public.supplier_document_handoffs_history();
drop function if exists public.supplier_documents_guard();
drop function if exists public.supplier_documents_history();
drop function if exists public.supplier_document_events_guard();
drop function if exists public.supplier_document_checklist_guard();
drop function if exists public.supplier_document_checklist_history();
drop function if exists public.supplier_document_profiles_known(text[]);
drop function if exists public.supplier_documents_can_review(uuid);
drop function if exists public.supplier_documents_is_owner();

commit;
