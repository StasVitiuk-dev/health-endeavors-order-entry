-- DRAFT (2026-11-21). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   38   (PRODUCTION-CHANGE-DRAFT, step optional (after drafts/36; needed before supplier document files are stored))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  36
-- @risk:        LOW
-- @precheck:    stops if storage.objects, storage.buckets, supplier_documents or supplier_documents_is_owner() is missing
-- @effect:      a private storage bucket supplier-documents (PDF/JPEG/PNG, 10 MB); two rules on storage.objects for that bucket only: the owner, an administrator or a manager reads (opens, downloads, signs links) (owner decisions of Nov 24 and 25); the person who recorded a waiting document (or the owner or an administrator) uploads into its folder; no replace or delete rule
-- @postcheck:   bucket public = false; two new storage rules; local-test/supplier_document_files_test.sh passes on a throwaway copy
-- @rollback:    drafts/39
-- @@ end metadata @@
-- written approval. DO NOT RUN until then, and only after drafts/36.
-- Rollback: 39_DRAFT_rollback_supplier_document_files.sql.
-- Tested only on the local throwaway database, against a minimal stand-in of
-- Supabase's storage schema (local-test/supplier_document_files_test.sh).
--
-- Why: the owner's decision of Nov 21 on supplier document files: "start with
-- owner-only file viewing and approval; keep administrator approval off; a
-- staff member or ordinary administrator must not be able to open files through
-- a direct link".
-- Changed Nov 24 (owner decision, administrator "almost like owner"): files are
-- opened by the owner OR an administrator. Nothing in this file changed for it:
-- the rules below ask supplier_documents_is_owner() (drafts/36), which now
-- answers yes for an active administrator too.
-- Changed Nov 25 (owner decision: a manager approves supplier documents too): a
-- manager may open files as well, because approving means looking at the file.
-- Employees still cannot open a file, even with a direct link.
--
-- What it adds
--   * a PRIVATE storage bucket `supplier-documents` (no public links), PDF,
--     JPEG or PNG only, at most 10 MB a file
--   * three rules on storage.objects for that bucket only:
--       read (which is what opening, downloading and signing a link need):
--         the OWNER, an ADMINISTRATOR or a MANAGER only
--       upload: the person who recorded the document, the owner or an
--         administrator, into that
--         document's own folder, while it waits for review and has no file yet
--       replace or delete: nobody (no rule = refused)
--   * supplier_document_file_upload_allowed(name): the upload check
--
-- How a file is opened: the page asks the storage service for a link that works
-- for 60 seconds; the storage service creates one only if the signed-in person
-- may read the file under the rule above. For anyone but the owner or an
-- administrator the file
-- does not exist as far as the storage service is concerned. (Supabase storage
-- applies these database rules to every download, link and upload.)
--
-- Honest limits
--   * A 60-second link, once the owner or an administrator has it, works for whoever holds it until
--     it expires. Do not forward it.
--   * Files are not in the database backups; backing up the bucket is a
--     separate decision.
--   * The rules on other buckets (receipts, evidence, documents) are untouched.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_supplier_document_files_install'));

do $pre$
declare missing text[] := '{}';
begin
  if to_regclass('storage.objects') is null then missing := missing || 'table storage.objects'::text; end if;
  if to_regclass('storage.buckets') is null then missing := missing || 'table storage.buckets'::text; end if;
  if to_regclass('public.supplier_documents') is null then missing := missing || 'table public.supplier_documents (install drafts/36 first)'::text; end if;
  if to_regprocedure('public.supplier_documents_is_owner()') is null then missing := missing || 'function public.supplier_documents_is_owner() (drafts/36)'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
end $pre$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('supplier-documents', 'supplier-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
  on conflict (id) do nothing;

-- May the signed-in person upload this object name? "<document id>/<file name>":
-- a document waiting for review, with no file yet, recorded by this person
-- (or the owner).
create or replace function public.supplier_document_file_upload_allowed(p_name text) returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select coalesce(p_name ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$', false)
     and exists (select 1 from public.supplier_documents d
                  where d.id::text = split_part(p_name, '/', 1)
                    and d.status = 'received' and d.file_path is null
                    and (d.recorded_by = auth.uid() or public.supplier_documents_is_owner()))
$fn$;
revoke all on function public.supplier_document_file_upload_allowed(text) from public, anon;
grant execute on function public.supplier_document_file_upload_allowed(text) to authenticated;

drop policy if exists supplier_document_files_owner_read on storage.objects;
create policy supplier_document_files_owner_read on storage.objects for select to authenticated using (bucket_id = 'supplier-documents' and coalesce(public.supplier_documents_is_owner() or public.active_role() = 'manager', false));
drop policy if exists supplier_document_files_upload on storage.objects;
create policy supplier_document_files_upload on storage.objects for insert to authenticated with check (bucket_id = 'supplier-documents' and public.supplier_document_file_upload_allowed(name));

commit;
