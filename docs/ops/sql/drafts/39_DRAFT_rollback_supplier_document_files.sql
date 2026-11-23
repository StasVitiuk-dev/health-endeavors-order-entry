-- DRAFT (2026-11-21). NOT INSTALLED. Rollback of 38_DRAFT_supplier_document_files.sql.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   39   (ROLLBACK, rolls back 38)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, if any file is stored in the bucket
-- @effect:      drops the two storage rules and the upload check, and removes the empty bucket
-- @postcheck:   select count(*) from storage.buckets where id = 'supplier-documents' = 0
-- @rollback:    (this file is the rollback of drafts/38)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the two storage rules, the upload check and the empty bucket.
-- STOPS, and removes nothing, if any file is stored in the bucket: those files
-- are business records. Export them first and decide separately.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_supplier_document_files_install'));

do $guard$
declare
  v_files bigint := 0;
begin
  if to_regclass('storage.objects') is not null then
    execute format('select count(*) from %I.%I where bucket_id = %L', 'storage', 'objects', 'supplier-documents') into v_files;
    if v_files > 0 then
      raise exception 'Not rolled back: % file(s) are stored in the supplier-documents bucket. Export them and decide separately.', v_files;
    end if;
  end if;
end $guard$;

drop policy if exists supplier_document_files_owner_read on storage.objects;
drop policy if exists supplier_document_files_upload on storage.objects;
drop function if exists public.supplier_document_file_upload_allowed(text);
delete from storage.buckets where id = 'supplier-documents';

commit;
