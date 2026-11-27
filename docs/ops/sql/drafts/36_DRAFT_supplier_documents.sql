-- DRAFT (2026-11-16). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   36   (PRODUCTION-CHANGE-DRAFT, step optional (not in the plan; needed before supplier documents are stored for real))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops if auth.uid(), current_role(), is_active_staff(), is_owner_or_admin() or the suppliers / purchase_orders / profiles tables are missing
-- @effect:      7 new tables (the checklist, its profiles by supplier type and per supplier, subjects, documents with one file each, review history, hand-offs to the owner); guards (review by the owner, an administrator, or a manager for a document someone else recorded (owner decisions of Nov 24 and 25); correction, hand-off resolution and checklist changes by the owner or an administrator only; purchase documents only for orders the person can already see; a file attached once; no deletes; history written by the database only); record / review / withdraw / correct / attach-file / hand-off functions and checklist functions for the owner or an administrator (security invoker); the starting checklist of Nov 16
-- @postcheck:   9 document types, no documents; anon cannot read them or run the functions; an administrator cannot approve; local-test/supplier_documents_test.sh passes on a throwaway copy
-- @rollback:    drafts/37
-- @@ end metadata @@
-- written approval. DO NOT RUN until then. Rollback: 37_DRAFT_rollback_supplier_documents.sql.
-- Tested only on the local throwaway database (local-test/supplier_documents_test.sh
-- and local-test/supplier_docs_store_adapter_test.js).
--
-- Why: the owner's decisions of Nov 16 (a configurable checklist of supplier
-- documents by supplier type) and later on Nov 16 (store them; owner-only changes and
-- approvals, enforced here, in the database).
--
-- What it adds (all new, all empty except the starting checklist)
--   * supplier_document_types              the checklist itself: one row per kind of document,
--                                          grouped into profiles ("purchase" = every purchase order)
--   * supplier_type_document_profiles      which profiles each supplier type gets
--   * supplier_document_supplier_profiles  a supplier's own list, when it differs from its type
--   * supplier_document_subjects           the formulas, batches, components and artworks a
--                                          supplier's documents belong to
--   * supplier_documents                   one row per document received, with its review
--   * supplier_document_events             the review history: append-only, written by the database
--   * record / review / withdraw / correct functions, and owner-only checklist setters
--
-- Who may do what (enforced by the guard triggers below, whoever writes)
--   * Active staff, administrators and the owner may RECORD that a document has
--     arrived. It then waits for review; recording approves nothing. A purchase
--     document (quote, supplier invoice, packing slip) can be recorded only for a
--     purchase order the person can already see under the existing row rules;
--     those rules are NOT widened. Staff who cannot see the order HAND THE
--     DOCUMENT OFF to the owner instead (supplier_document_handoffs): they write
--     down the order number as printed on the paper, and the owner links it to
--     the right order, which records it.
--   * Files (owner decision of Nov 21): a document may carry one file, attached
--     once by the person who recorded it or by the owner, while it waits for
--     review. The owner, an administrator or a manager can open files (drafts/38 holds the
--     storage rules); approving records the fingerprint of the exact file that was approved.
--   * The owner or an administrator (Nov 24) may approve or reject any document; a
--     manager (Nov 25) may approve or reject a document someone else recorded.
--   * Only the owner or an administrator may correct a document, withdraw an approved
--     one, resolve a hand-off, or change the checklist.
--   * The person who recorded a document may withdraw it while it still waits
--     for review (a mistake), with a reason.
--   * Nothing is ever deleted. An approved, rejected or withdrawn document can
--     no longer change; a replacement is recorded as a new document.
--   * Every recording, correction, decision, withdrawal and checklist change is
--     written to supplier_document_events by the database itself. Nobody can
--     write, edit or delete a history row directly.
--
-- Retries and double clicks
--   * Every recording carries a request key chosen by the page. Sending the same
--     request again (a retry after a lost reply, a double click) returns the
--     document already recorded and adds nothing. Two simultaneous sends of the
--     same request: one records, the other gets the same document back.
--   * Only one copy of the same document for the same subject can wait for
--     review at a time.
--   * Approving or rejecting twice decides once.
--
-- What it deliberately does NOT do
--   * No files. A document row holds facts (supplier, type, reference, dates,
--     status, review). Storing the scanned file privately is a separate,
--     later change (docs/ops/SUPPLIER_DOCUMENT_STORAGE_2026-11-16.md explains
--     how access to those files would work).
--   * It changes no existing table, row, permission or screen.
--
-- Honest limits
--   * SECURITY INVOKER throughout (project rule). The owner check uses the
--     existing public.current_role() helper.
--   * No production audit trigger is attached (its name is not in this
--     repository); supplier_document_events is this feature's own history.
--   * Locking: creates new tables only. Nothing existing is locked.
-- Safe to run twice: a second run changes nothing (IF NOT EXISTS / OR REPLACE /
-- ON CONFLICT DO NOTHING).
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_supplier_documents_install'));

do $pre$
declare missing text[] := '{}';
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.current_role()') is null then missing := missing || 'function public.current_role()'::text; end if;
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regclass('public.suppliers') is null then missing := missing || 'table public.suppliers'::text; end if;
  if to_regclass('public.purchase_orders') is null then missing := missing || 'table public.purchase_orders'::text; end if;
  if to_regclass('public.profiles') is null then missing := missing || 'table public.profiles'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
end $pre$;

-- ---------------------------------------------------------------- the checklist
create table if not exists public.supplier_document_types (
  key            text primary key check (key ~ '^[a-z][a-z0-9_]{1,59}$'),
  label          text not null check (length(btrim(label)) between 2 and 120),
  subject_kind   text not null check (subject_kind in ('purchase', 'formula', 'batch', 'component', 'artwork', 'supplier')),
  profile        text not null check (profile ~ '^[a-z][a-z0-9_]{1,59}$'),
  profile_label  text not null check (length(btrim(profile_label)) between 2 and 120),
  stages         text[] check (stages is null or stages <@ array['ordered', 'shipped', 'received']::text[]),
  also_when_paid boolean not null default false,
  is_active      boolean not null default true,
  sort_order     integer not null default 100,
  updated_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  -- purchase documents belong to purchase orders and say at which stages they apply
  constraint supplier_document_types_purchase_shape check (
    (profile = 'purchase') = (subject_kind = 'purchase') and (profile <> 'purchase' or stages is not null))
);

create table if not exists public.supplier_type_document_profiles (
  supplier_type text primary key check (supplier_type in ('supplier', 'manufacturer', 'lab', 'packaging', 'freight', 'other')),
  profiles      text[] not null default '{}',
  updated_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.supplier_document_supplier_profiles (
  supplier_id uuid primary key references public.suppliers(id),
  profiles    text[] not null default '{}',
  updated_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.supplier_document_subjects (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.suppliers(id),
  subject_kind text not null check (subject_kind in ('formula', 'batch', 'component', 'artwork')),
  subject_ref  text not null check (length(btrim(subject_ref)) between 1 and 120),
  label        text not null check (length(btrim(label)) between 1 and 200),
  is_active    boolean not null default true,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  constraint supplier_document_subjects_once unique (supplier_id, subject_kind, subject_ref)
);

-- ---------------------------------------------------------------- the documents
create table if not exists public.supplier_documents (
  id            uuid primary key default gen_random_uuid(),
  request_key   uuid not null,
  supplier_id   uuid not null references public.suppliers(id),
  kind          text not null references public.supplier_document_types(key),
  subject_kind  text not null check (subject_kind in ('purchase', 'formula', 'batch', 'component', 'artwork', 'supplier')),
  subject_ref   text not null check (length(btrim(subject_ref)) between 1 and 120),
  subject_label text check (subject_label is null or length(subject_label) <= 200),
  reference     text check (reference is null or length(btrim(reference)) between 1 and 120),
  received_on   date not null,
  document_date date,
  expires_on    date,
  status        text not null default 'received' check (status in ('received', 'approved', 'rejected', 'withdrawn')),
  recorded_by   uuid not null default auth.uid(),
  recorded_at   timestamptz not null default now(),
  record_note   text check (record_note is null or length(record_note) <= 500),
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  review_note   text check (review_note is null or length(review_note) <= 500),
  withdrawn_by  uuid,
  withdrawn_at  timestamptz,
  withdraw_note text check (withdraw_note is null or length(withdraw_note) <= 500),
  -- the one file of this document (stored privately; drafts/38), and the
  -- fingerprint of the file the owner approved
  file_path     text check (file_path is null or file_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  file_sha256   text check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$'),
  file_bytes    integer check (file_bytes is null or file_bytes between 1 and 10485760),
  file_type     text check (file_type is null or file_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_attached_by uuid,
  file_attached_at timestamptz,
  approved_file_sha256 text,
  constraint supplier_documents_request_key unique (request_key),
  constraint supplier_documents_file_complete check (
    (file_path is null) = (file_sha256 is null) and (file_path is null) = (file_bytes is null)
    and (file_path is null) = (file_type is null) and (file_path is null) = (file_attached_at is null)),
  constraint supplier_documents_file_is_this_document check (file_path is null or split_part(file_path, '/', 1) = id::text),
  constraint supplier_documents_expiry_after_date check (expires_on is null or document_date is null or expires_on >= document_date),
  constraint supplier_documents_review_recorded check (
    (status = 'received' and reviewed_by is null and reviewed_at is null)
    or (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
    or status = 'withdrawn'),
  constraint supplier_documents_rejection_says_why check (status <> 'rejected' or (review_note is not null and length(btrim(review_note)) >= 5)),
  constraint supplier_documents_withdrawal_recorded check (
    (status <> 'withdrawn' and withdrawn_by is null and withdrawn_at is null)
    or (status = 'withdrawn' and withdrawn_by is not null and withdrawn_at is not null and withdraw_note is not null and length(btrim(withdraw_note)) >= 5))
);
-- one copy of the same document for the same subject waiting for review at a time
create unique index if not exists supplier_documents_one_awaiting
  on public.supplier_documents (supplier_id, kind, subject_kind, subject_ref) where status = 'received';
create index if not exists supplier_documents_by_supplier on public.supplier_documents (supplier_id, status);

create table if not exists public.supplier_document_events (
  id          bigint generated always as identity primary key,
  document_id uuid references public.supplier_documents(id),
  area        text not null check (area in ('document', 'checklist')),
  event       text not null check (event in ('recorded', 'corrected', 'approved', 'rejected', 'withdrawn', 'checklist_changed',
                                             'file_attached', 'handed_off', 'handoff_recorded', 'handoff_dismissed')),
  by_user     uuid,
  at          timestamptz not null default now(),
  note        text,
  detail      jsonb not null default '{}'::jsonb
);
create index if not exists supplier_document_events_by_document on public.supplier_document_events (document_id, id);

-- ---------------------------------------------------------------- helpers
create or replace function public.supplier_documents_is_owner() returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  -- The owner or an administrator (owner decision of Nov 24: an administrator is
  -- "almost like owner"; supplier documents are approved, opened and set up by
  -- both). The name is kept so the undo file (drafts/37) still matches.
  select coalesce(public.current_role()::text in ('owner', 'administrator'), false)
$fn$;

-- Who may approve or reject a document waiting for review (owner decision of Nov 25:
-- a manager approves supplier documents too). The owner and an administrator review
-- any document; a manager reviews a document someone ELSE recorded, so a second person
-- always looks at it. Everything else about supplier documents stays with the owner
-- and administrators (withdrawing an approved document, corrections, hand-offs, the
-- checklist). p_recorded_by is the person who recorded the document.
create or replace function public.supplier_documents_can_review(p_recorded_by uuid) returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select coalesce(public.current_role()::text in ('owner', 'administrator')
               or (public.current_role()::text = 'manager' and p_recorded_by is distinct from auth.uid()), false)
$fn$;

-- Every profile named must be a profile of the checklist (not "purchase").
create or replace function public.supplier_document_profiles_known(p_profiles text[]) returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select coalesce(bool_and(exists (select 1 from public.supplier_document_types t where t.profile = p and t.profile <> 'purchase')), true)
  from unnest(coalesce(p_profiles, '{}'::text[])) as p
$fn$;

-- ---------------------------------------------------------------- the history
-- Written only from inside this feature's own triggers; never by hand.
create or replace function public.supplier_document_events_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op <> 'INSERT' then
    raise exception 'The supplier document history cannot be changed or deleted.' using errcode = '42501';
  end if;
  if pg_trigger_depth() < 2 then
    raise exception 'The supplier document history is written by the database only.' using errcode = '42501';
  end if;
  new.by_user := auth.uid();
  new.at := now();
  return new;
end
$fn$;

drop trigger if exists supplier_document_events_guard on public.supplier_document_events;
create trigger supplier_document_events_guard before insert or update or delete on public.supplier_document_events
  for each row execute function public.supplier_document_events_guard();

-- ---------------------------------------------------------------- document guard
create or replace function public.supplier_documents_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_type public.supplier_document_types%rowtype;
  v_owner boolean := public.supplier_documents_is_owner();
begin
  if tg_op = 'DELETE' then
    raise exception 'A supplier document stays on the record and cannot be deleted. Withdraw it instead.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'received' then
      raise exception 'A supplier document is recorded as received; only the owner or an administrator can then approve it.' using errcode = '42501';
    end if;
    select * into v_type from public.supplier_document_types where key = new.kind;
    if not found then
      raise exception 'Unknown document type %.', new.kind using errcode = '22023';
    end if;
    if not v_type.is_active then
      raise exception 'The document type % is no longer on the checklist.', new.kind using errcode = '22023';
    end if;
    if v_type.subject_kind <> new.subject_kind then
      raise exception 'A % belongs to a % (not a %).', v_type.label, v_type.subject_kind, new.subject_kind using errcode = '22023';
    end if;
    if not exists (select 1 from public.suppliers s where s.id = new.supplier_id and s.is_active) then
      raise exception 'No active supplier with that id.' using errcode = 'P0002';
    end if;
    if new.subject_kind = 'purchase' then
      -- Runs with the caller's own rights, so this sees only the purchase orders
      -- the caller may already see. The row rules on purchase orders are not
      -- widened: staff who cannot see the order hand the document to the owner.
      if not exists (select 1 from public.purchase_orders po where po.id::text = new.subject_ref and po.supplier_id = new.supplier_id) then
        raise exception 'That purchase order is not one you can see for this supplier. Hand the document to the owner instead.' using errcode = '22023';
      end if;
    elsif new.subject_kind = 'supplier' then
      if new.subject_ref <> new.supplier_id::text then
        raise exception 'A supplier-level document must name the same supplier.' using errcode = '22023';
      end if;
    elsif not exists (select 1 from public.supplier_document_subjects sub where sub.supplier_id = new.supplier_id
                      and sub.subject_kind = new.subject_kind and sub.subject_ref = new.subject_ref and sub.is_active) then
      raise exception 'Unknown % % for this supplier.', new.subject_kind, new.subject_ref using errcode = '22023';
    end if;
    if new.received_on > current_date + 1 then
      raise exception 'The date received cannot be in the future.' using errcode = '22023';
    end if;
    new.recorded_by := auth.uid(); new.recorded_at := now();
    new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
    new.withdrawn_by := null; new.withdrawn_at := null; new.withdraw_note := null;
    new.file_path := null; new.file_sha256 := null; new.file_bytes := null; new.file_type := null;
    new.file_attached_by := null; new.file_attached_at := null; new.approved_file_sha256 := null;
    return new;
  end if;

  -- UPDATE
  if old.status in ('rejected', 'withdrawn') then
    raise exception 'This document was % and can no longer change. Record a new one.', old.status using errcode = '42501';
  end if;
  if new.request_key is distinct from old.request_key or new.supplier_id is distinct from old.supplier_id
     or new.kind is distinct from old.kind or new.subject_kind is distinct from old.subject_kind
     or new.subject_ref is distinct from old.subject_ref or new.recorded_by is distinct from old.recorded_by
     or new.recorded_at is distinct from old.recorded_at then
    raise exception 'What a document is and who recorded it cannot change. Withdraw it and record it again.' using errcode = '42501';
  end if;
  if new.reference is distinct from old.reference or new.subject_label is distinct from old.subject_label
     or new.received_on is distinct from old.received_on or new.document_date is distinct from old.document_date
     or new.expires_on is distinct from old.expires_on or new.record_note is distinct from old.record_note then
    if not v_owner then
      raise exception 'Only the owner or an administrator can correct a supplier document.' using errcode = '42501';
    end if;
    if old.status <> 'received' or new.status <> 'received' then
      raise exception 'Only a document waiting for review can be corrected.' using errcode = '42501';
    end if;
  end if;

  -- The file: attached once, while waiting for review, by the person who
  -- recorded the document or by the owner. Never replaced or removed.
  if old.file_path is null and new.file_path is not null then
    if old.status <> 'received' or new.status <> 'received' then
      raise exception 'A file can be attached only while the document waits for review.' using errcode = '42501';
    end if;
    if not (v_owner or old.recorded_by = auth.uid()) then
      raise exception 'Only the person who recorded the document, the owner or an administrator can attach its file.' using errcode = '42501';
    end if;
    new.file_attached_by := auth.uid(); new.file_attached_at := now();
  elsif new.file_path is distinct from old.file_path or new.file_sha256 is distinct from old.file_sha256
     or new.file_bytes is distinct from old.file_bytes or new.file_type is distinct from old.file_type
     or new.file_attached_by is distinct from old.file_attached_by or new.file_attached_at is distinct from old.file_attached_at then
    raise exception 'A file, once attached, cannot be replaced or removed. Withdraw the document and record it again.' using errcode = '42501';
  end if;

  if new.status = old.status then
    -- nothing about the review may be typed in
    new.approved_file_sha256 := old.approved_file_sha256;
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.review_note := old.review_note;
    new.withdrawn_by := old.withdrawn_by; new.withdrawn_at := old.withdrawn_at; new.withdraw_note := old.withdraw_note;
    return new;
  end if;

  if old.status = 'received' and new.status in ('approved', 'rejected') then
    if not public.supplier_documents_can_review(old.recorded_by) then
      raise exception 'Only the owner, an administrator or a manager (not for a document they recorded) can approve or reject a supplier document.' using errcode = '42501';
    end if;
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
    new.withdrawn_by := null; new.withdrawn_at := null; new.withdraw_note := null;
    -- the exact file that was approved (if any): its fingerprint at this moment
    new.approved_file_sha256 := case when new.status = 'approved' then old.file_sha256 else null end;
    return new;
  end if;

  if new.status = 'withdrawn' then
    if old.status = 'approved' and not v_owner then
      raise exception 'Only the owner or an administrator can withdraw an approved supplier document.' using errcode = '42501';
    end if;
    if old.status = 'received' and not (v_owner or old.recorded_by = auth.uid()) then
      raise exception 'Only the person who recorded it, the owner or an administrator can withdraw a document waiting for review.' using errcode = '42501';
    end if;
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.review_note := old.review_note;
    new.approved_file_sha256 := old.approved_file_sha256;
    new.withdrawn_by := auth.uid(); new.withdrawn_at := now();
    return new;
  end if;

  raise exception 'A % document cannot become %.', old.status, new.status using errcode = '42501';
end
$fn$;

drop trigger if exists supplier_documents_guard on public.supplier_documents;
create trigger supplier_documents_guard before insert or update or delete on public.supplier_documents
  for each row execute function public.supplier_documents_guard();

-- The history of each document, written after every change.
create or replace function public.supplier_documents_history() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_changed jsonb := '{}'::jsonb;
  k text;
begin
  if tg_op = 'INSERT' then
    insert into public.supplier_document_events (document_id, area, event, note, detail)
      values (new.id, 'document', 'recorded', new.record_note,
              jsonb_build_object('kind', new.kind, 'subject_kind', new.subject_kind, 'subject_ref', new.subject_ref,
                                 'reference', new.reference, 'received_on', new.received_on, 'document_date', new.document_date, 'expires_on', new.expires_on));
    return null;
  end if;
  if new.status <> old.status then
    insert into public.supplier_document_events (document_id, area, event, note, detail)
      values (new.id, 'document', new.status,
              case when new.status = 'withdrawn' then new.withdraw_note else new.review_note end,
              jsonb_build_object('from', old.status, 'to', new.status, 'approved_file_sha256', new.approved_file_sha256));
    return null;
  end if;
  if old.file_path is null and new.file_path is not null then
    insert into public.supplier_document_events (document_id, area, event, detail)
      values (new.id, 'document', 'file_attached', jsonb_build_object('file_sha256', new.file_sha256, 'file_bytes', new.file_bytes, 'file_type', new.file_type));
  end if;
  foreach k in array array['reference', 'subject_label', 'received_on', 'document_date', 'expires_on', 'record_note'] loop
    if (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k) then
      v_changed := v_changed || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(old) -> k, 'to', to_jsonb(new) -> k));
    end if;
  end loop;
  if v_changed <> '{}'::jsonb then
    insert into public.supplier_document_events (document_id, area, event, detail) values (new.id, 'document', 'corrected', v_changed);
  end if;
  return null;
end
$fn$;

drop trigger if exists supplier_documents_history on public.supplier_documents;
create trigger supplier_documents_history after insert or update on public.supplier_documents
  for each row execute function public.supplier_documents_history();


-- ---------------------------------------------------------------- hand-off to the owner
-- A purchase document that arrived for an order the person cannot see (staff,
-- under the existing row rules). They write down what is printed on the paper;
-- the owner links it to the right purchase order, which records the document.
create table if not exists public.supplier_document_handoffs (
  id            uuid primary key default gen_random_uuid(),
  request_key   uuid not null,
  supplier_id   uuid not null references public.suppliers(id),
  kind          text not null references public.supplier_document_types(key),
  po_text       text not null check (length(btrim(po_text)) between 1 and 120),   -- the order number as printed
  reference     text check (reference is null or length(btrim(reference)) between 1 and 120),
  received_on   date not null,
  note          text check (note is null or length(note) <= 500),
  status        text not null default 'waiting' check (status in ('waiting', 'recorded', 'dismissed')),
  handed_by     uuid not null default auth.uid(),
  handed_at     timestamptz not null default now(),
  resolved_by   uuid,
  resolved_at   timestamptz,
  resolve_note  text check (resolve_note is null or length(resolve_note) <= 500),
  document_id   uuid references public.supplier_documents(id),
  constraint supplier_document_handoffs_request_key unique (request_key),
  constraint supplier_document_handoffs_resolved check (
    (status = 'waiting' and resolved_by is null and resolved_at is null and document_id is null)
    or (status = 'recorded' and resolved_by is not null and resolved_at is not null and document_id is not null)
    or (status = 'dismissed' and resolved_by is not null and resolved_at is not null and document_id is null
        and resolve_note is not null and length(btrim(resolve_note)) >= 5))
);

create or replace function public.supplier_document_handoffs_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_type public.supplier_document_types%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'A hand-off stays on the record and cannot be deleted.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    select * into v_type from public.supplier_document_types where key = new.kind;
    if not found or v_type.subject_kind <> 'purchase' or not v_type.is_active then
      raise exception 'Only a purchase document (quote, supplier invoice, packing slip) is handed off.' using errcode = '22023';
    end if;
    if new.received_on > current_date + 1 then
      raise exception 'The date received cannot be in the future.' using errcode = '22023';
    end if;
    new.status := 'waiting'; new.handed_by := auth.uid(); new.handed_at := now();
    new.resolved_by := null; new.resolved_at := null; new.resolve_note := null; new.document_id := null;
    return new;
  end if;
  if not public.supplier_documents_is_owner() then
    raise exception 'Only the owner or an administrator can link or dismiss a handed-off document.' using errcode = '42501';
  end if;
  if old.status <> 'waiting' then
    raise exception 'This hand-off was already %.', old.status using errcode = '42501';
  end if;
  if new.request_key is distinct from old.request_key or new.supplier_id is distinct from old.supplier_id
     or new.kind is distinct from old.kind or new.po_text is distinct from old.po_text or new.reference is distinct from old.reference
     or new.received_on is distinct from old.received_on or new.note is distinct from old.note
     or new.handed_by is distinct from old.handed_by or new.handed_at is distinct from old.handed_at then
    raise exception 'What was handed off cannot change.' using errcode = '42501';
  end if;
  if new.status = 'waiting' then
    raise exception 'A hand-off is resolved by linking it to an order or dismissing it.' using errcode = '22023';
  end if;
  new.resolved_by := auth.uid(); new.resolved_at := now();
  return new;
end
$fn$;

drop trigger if exists supplier_document_handoffs_guard on public.supplier_document_handoffs;
create trigger supplier_document_handoffs_guard before insert or update or delete on public.supplier_document_handoffs
  for each row execute function public.supplier_document_handoffs_guard();

create or replace function public.supplier_document_handoffs_history() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  insert into public.supplier_document_events (document_id, area, event, note, detail)
    values (new.document_id, 'document',
            case when tg_op = 'INSERT' then 'handed_off' when new.status = 'recorded' then 'handoff_recorded' else 'handoff_dismissed' end,
            case when tg_op = 'INSERT' then new.note else new.resolve_note end,
            jsonb_build_object('handoff_id', new.id, 'kind', new.kind, 'po_text', new.po_text, 'reference', new.reference));
  return null;
end
$fn$;

drop trigger if exists supplier_document_handoffs_history on public.supplier_document_handoffs;
create trigger supplier_document_handoffs_history after insert or update on public.supplier_document_handoffs
  for each row execute function public.supplier_document_handoffs_history();

-- ---------------------------------------------------------------- checklist guard + history
create or replace function public.supplier_document_checklist_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_profiles text[];
begin
  if tg_op = 'DELETE' and tg_table_name = 'supplier_document_types' then
    raise exception 'A document type is never deleted; switch it off instead.' using errcode = '42501';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if tg_table_name in ('supplier_type_document_profiles', 'supplier_document_supplier_profiles') then
      -- read through jsonb: the document-type table has no profiles column
      v_profiles := array(select jsonb_array_elements_text(coalesce(to_jsonb(new) -> 'profiles', '[]'::jsonb)));
      if not public.supplier_document_profiles_known(v_profiles) then
        raise exception 'Unknown checklist profile in %.', array_to_string(v_profiles, ', ') using errcode = '22023';
      end if;
    end if;
    new.updated_by := auth.uid();
    new.updated_at := now();
    return new;
  end if;
  return old;
end
$fn$;

create or replace function public.supplier_document_checklist_history() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  insert into public.supplier_document_events (area, event, detail)
    values ('checklist', 'checklist_changed', jsonb_build_object('table', tg_table_name, 'change', lower(tg_op),
      'before', case when tg_op = 'INSERT' then null else to_jsonb(old) - 'updated_by' - 'updated_at' end,
      'after', case when tg_op = 'DELETE' then null else to_jsonb(new) - 'updated_by' - 'updated_at' end));
  return null;
end
$fn$;

drop trigger if exists supplier_document_types_guard on public.supplier_document_types;
create trigger supplier_document_types_guard before insert or update or delete on public.supplier_document_types
  for each row execute function public.supplier_document_checklist_guard();
drop trigger if exists supplier_type_document_profiles_guard on public.supplier_type_document_profiles;
create trigger supplier_type_document_profiles_guard before insert or update or delete on public.supplier_type_document_profiles
  for each row execute function public.supplier_document_checklist_guard();
drop trigger if exists supplier_document_supplier_profiles_guard on public.supplier_document_supplier_profiles;
create trigger supplier_document_supplier_profiles_guard before insert or update or delete on public.supplier_document_supplier_profiles
  for each row execute function public.supplier_document_checklist_guard();
drop trigger if exists supplier_document_types_history on public.supplier_document_types;
create trigger supplier_document_types_history after insert or update or delete on public.supplier_document_types
  for each row execute function public.supplier_document_checklist_history();
drop trigger if exists supplier_type_document_profiles_history on public.supplier_type_document_profiles;
create trigger supplier_type_document_profiles_history after insert or update or delete on public.supplier_type_document_profiles
  for each row execute function public.supplier_document_checklist_history();
drop trigger if exists supplier_document_supplier_profiles_history on public.supplier_document_supplier_profiles;
create trigger supplier_document_supplier_profiles_history after insert or update or delete on public.supplier_document_supplier_profiles
  for each row execute function public.supplier_document_checklist_history();

-- ---------------------------------------------------------------- functions
-- Record that a document has arrived. Any active staff member. Safe to repeat
-- with the same request key.
create or replace function public.record_supplier_document(
  p_request_key   uuid,
  p_supplier_id   uuid,
  p_kind          text,
  p_subject_kind  text,
  p_subject_ref   text,
  p_subject_label text,
  p_reference     text,
  p_received_on   date,
  p_document_date date,
  p_expires_on    date,
  p_note          text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.supplier_documents%rowtype;
  v_con text;
begin
  if not public.is_active_staff() then
    raise exception 'Only active staff can record a supplier document.' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'A request key is required, so that a retry cannot record the document twice.' using errcode = '22023';
  end if;
  if p_subject_ref is null or length(btrim(p_subject_ref)) = 0 then
    raise exception 'Say what the document is for (the purchase order, formula, batch, component or artwork).' using errcode = '22023';
  end if;
  select * into v from public.supplier_documents where request_key = p_request_key;
  if found then
    if v.supplier_id <> p_supplier_id or v.kind <> p_kind or v.subject_kind <> p_subject_kind or v.subject_ref <> btrim(p_subject_ref) then
      raise exception 'This request key was already used for a different document.' using errcode = '22023';
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', v.id, 'status', v.status, 'recorded_by', v.recorded_by, 'recorded_at', v.recorded_at);
  end if;
  if p_subject_kind in ('formula', 'batch', 'component', 'artwork') then
    insert into public.supplier_document_subjects (supplier_id, subject_kind, subject_ref, label)
      values (p_supplier_id, p_subject_kind, btrim(p_subject_ref), coalesce(nullif(btrim(p_subject_label), ''), btrim(p_subject_ref)))
      on conflict on constraint supplier_document_subjects_once do nothing;
  end if;
  begin
    insert into public.supplier_documents (request_key, supplier_id, kind, subject_kind, subject_ref, subject_label, reference,
                                           received_on, document_date, expires_on, record_note)
      values (p_request_key, p_supplier_id, p_kind, p_subject_kind, btrim(p_subject_ref), nullif(btrim(p_subject_label), ''),
              nullif(btrim(p_reference), ''), coalesce(p_received_on, current_date), p_document_date, p_expires_on, nullif(btrim(p_note), ''))
      returning * into v;
  exception when unique_violation then
    get stacked diagnostics v_con = constraint_name;
    if v_con = 'supplier_documents_request_key' then
      -- the same request, sent twice at the same moment: the other one recorded it
      select * into v from public.supplier_documents where request_key = p_request_key;
      return jsonb_build_object('ok', true, 'duplicate', true, 'id', v.id, 'status', v.status, 'recorded_by', v.recorded_by, 'recorded_at', v.recorded_at);
    end if;
    raise exception 'A copy of this document is already waiting for review. Review or withdraw that one first.' using errcode = '22023';
  end;
  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v.id, 'status', v.status, 'recorded_by', v.recorded_by, 'recorded_at', v.recorded_at);
end
$fn$;

-- Approve or reject: the owner, an administrator, or a manager for a document someone
-- else recorded (owner decision of Nov 25). Decides once.
create or replace function public.review_supplier_document(p_id uuid, p_decision text, p_note text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.supplier_documents%rowtype;
begin
  if not coalesce(public.supplier_documents_is_owner() or public.current_role()::text = 'manager', false) then
    raise exception 'Only the owner, an administrator or a manager can approve or reject a supplier document.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'A review is either approved or rejected.' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and (p_note is null or length(btrim(p_note)) < 5) then
    raise exception 'Say why the document is rejected.' using errcode = '22023';
  end if;
  select * into v from public.supplier_documents where id = p_id for update;
  if not found then
    raise exception 'No such supplier document.' using errcode = 'P0002';
  end if;
  if v.status <> 'received' then
    return jsonb_build_object('ok', v.status = p_decision, 'already_decided', true, 'status', v.status,
      'reviewed_by', v.reviewed_by, 'reviewed_at', v.reviewed_at);
  end if;
  update public.supplier_documents set status = p_decision, review_note = nullif(btrim(p_note), '') where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'already_decided', false, 'status', v.status, 'reviewed_by', v.reviewed_by, 'reviewed_at', v.reviewed_at);
end
$fn$;

-- Withdraw: the recorder while it waits for review, or the owner at any time before it is final.
create or replace function public.withdraw_supplier_document(p_id uuid, p_note text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.supplier_documents%rowtype;
begin
  if p_note is null or length(btrim(p_note)) < 5 then
    raise exception 'Say why the document is withdrawn.' using errcode = '22023';
  end if;
  select * into v from public.supplier_documents where id = p_id for update;
  if not found then
    raise exception 'No such supplier document.' using errcode = 'P0002';
  end if;
  if v.status = 'withdrawn' then
    return jsonb_build_object('ok', true, 'already_withdrawn', true, 'status', v.status, 'withdrawn_by', v.withdrawn_by, 'withdrawn_at', v.withdrawn_at);
  end if;
  if v.status = 'rejected' then
    return jsonb_build_object('ok', false, 'status', v.status, 'reason', 'A rejected document is already off the checklist.');
  end if;
  update public.supplier_documents set status = 'withdrawn', withdraw_note = btrim(p_note) where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'already_withdrawn', false, 'status', v.status, 'withdrawn_by', v.withdrawn_by, 'withdrawn_at', v.withdrawn_at);
end
$fn$;

-- Correct the facts of a document still waiting for review. Owner only.
create or replace function public.correct_supplier_document(
  p_id uuid, p_reference text, p_received_on date, p_document_date date, p_expires_on date
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.supplier_documents%rowtype;
begin
  if not public.supplier_documents_is_owner() then
    raise exception 'Only the owner or an administrator can correct a supplier document.' using errcode = '42501';
  end if;
  update public.supplier_documents
     set reference = nullif(btrim(p_reference), ''), received_on = coalesce(p_received_on, received_on),
         document_date = p_document_date, expires_on = p_expires_on
   where id = p_id returning * into v;
  if not found then
    raise exception 'No such supplier document.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('ok', true, 'id', v.id, 'status', v.status);
end
$fn$;


-- Attach the one file of a document (after it was uploaded to the private
-- storage, drafts/38). Safe to repeat with the same file.
create or replace function public.attach_supplier_document_file(
  p_id uuid, p_path text, p_sha256 text, p_bytes integer, p_type text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.supplier_documents%rowtype;
begin
  select * into v from public.supplier_documents where id = p_id for update;
  if not found then
    raise exception 'No such supplier document.' using errcode = 'P0002';
  end if;
  if v.file_path is not null then
    if v.file_path = p_path and v.file_sha256 = lower(p_sha256) then
      return jsonb_build_object('ok', true, 'already_attached', true, 'id', v.id);
    end if;
    raise exception 'A file, once attached, cannot be replaced or removed. Withdraw the document and record it again.' using errcode = '42501';
  end if;
  update public.supplier_documents set file_path = p_path, file_sha256 = lower(p_sha256), file_bytes = p_bytes, file_type = p_type
   where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'already_attached', false, 'id', v.id, 'file_sha256', v.file_sha256);
end
$fn$;

-- Hand a purchase document to the owner (any active staff). Safe to repeat.
create or replace function public.hand_off_supplier_document(
  p_request_key uuid, p_supplier_id uuid, p_kind text, p_po_text text, p_reference text, p_received_on date, p_note text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.supplier_document_handoffs%rowtype;
begin
  if not public.is_active_staff() then
    raise exception 'Only active staff can hand a document to the owner.' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'A request key is required, so that a retry cannot hand it off twice.' using errcode = '22023';
  end if;
  select * into v from public.supplier_document_handoffs where request_key = p_request_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', v.id, 'status', v.status);
  end if;
  begin
    insert into public.supplier_document_handoffs (request_key, supplier_id, kind, po_text, reference, received_on, note)
      values (p_request_key, p_supplier_id, p_kind, btrim(p_po_text), nullif(btrim(p_reference), ''), coalesce(p_received_on, current_date), nullif(btrim(p_note), ''))
      returning * into v;
  exception when unique_violation then
    select * into v from public.supplier_document_handoffs where request_key = p_request_key;
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', v.id, 'status', v.status);
  end;
  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v.id, 'status', v.status);
end
$fn$;

-- The owner links a hand-off to the right purchase order: the document is
-- recorded (as the owner) and the hand-off closed. Decides once.
create or replace function public.resolve_supplier_document_handoff(p_id uuid, p_po_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  h public.supplier_document_handoffs%rowtype;
  r jsonb;
begin
  if not public.supplier_documents_is_owner() then
    raise exception 'Only the owner or an administrator can link a handed-off document.' using errcode = '42501';
  end if;
  select * into h from public.supplier_document_handoffs where id = p_id for update;
  if not found then
    raise exception 'No such hand-off.' using errcode = 'P0002';
  end if;
  if h.status <> 'waiting' then
    return jsonb_build_object('ok', h.status = 'recorded', 'already_resolved', true, 'status', h.status, 'document_id', h.document_id);
  end if;
  r := public.record_supplier_document(h.request_key, h.supplier_id, h.kind, 'purchase', p_po_id::text, null, h.reference, h.received_on, null, null,
         'Handed off: printed order number ' || h.po_text || coalesce(' — ' || h.note, ''));
  update public.supplier_document_handoffs set status = 'recorded', document_id = (r ->> 'id')::uuid where id = p_id;
  return jsonb_build_object('ok', true, 'already_resolved', false, 'status', 'recorded', 'document_id', r ->> 'id');
end
$fn$;

create or replace function public.dismiss_supplier_document_handoff(p_id uuid, p_note text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  h public.supplier_document_handoffs%rowtype;
begin
  if not public.supplier_documents_is_owner() then
    raise exception 'Only the owner or an administrator can dismiss a handed-off document.' using errcode = '42501';
  end if;
  if p_note is null or length(btrim(p_note)) < 5 then
    raise exception 'Say why the hand-off is dismissed.' using errcode = '22023';
  end if;
  select * into h from public.supplier_document_handoffs where id = p_id for update;
  if not found then
    raise exception 'No such hand-off.' using errcode = 'P0002';
  end if;
  if h.status <> 'waiting' then
    return jsonb_build_object('ok', h.status = 'dismissed', 'already_resolved', true, 'status', h.status);
  end if;
  update public.supplier_document_handoffs set status = 'dismissed', resolve_note = btrim(p_note) where id = p_id;
  return jsonb_build_object('ok', true, 'already_resolved', false, 'status', 'dismissed');
end
$fn$;

-- Checklist setters. Owner only (the row rules say the same).
create or replace function public.set_supplier_type_document_profiles(p_supplier_type text, p_profiles text[]) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if not public.supplier_documents_is_owner() then
    raise exception 'Only the owner or an administrator can change the supplier document checklist.' using errcode = '42501';
  end if;
  insert into public.supplier_type_document_profiles (supplier_type, profiles) values (p_supplier_type, coalesce(p_profiles, '{}'))
    on conflict (supplier_type) do update set profiles = excluded.profiles;
  return jsonb_build_object('ok', true, 'supplier_type', p_supplier_type, 'profiles', coalesce(p_profiles, '{}'));
end
$fn$;

create or replace function public.set_supplier_document_profiles(p_supplier_id uuid, p_profiles text[]) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if not public.supplier_documents_is_owner() then
    raise exception 'Only the owner or an administrator can change the supplier document checklist.' using errcode = '42501';
  end if;
  if p_profiles is null then
    -- back to the supplier type's list
    delete from public.supplier_document_supplier_profiles where supplier_id = p_supplier_id;
    return jsonb_build_object('ok', true, 'supplier_id', p_supplier_id, 'profiles', null);
  end if;
  insert into public.supplier_document_supplier_profiles (supplier_id, profiles) values (p_supplier_id, p_profiles)
    on conflict (supplier_id) do update set profiles = excluded.profiles;
  return jsonb_build_object('ok', true, 'supplier_id', p_supplier_id, 'profiles', p_profiles);
end
$fn$;

create or replace function public.set_supplier_document_type_active(p_key text, p_active boolean) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if not public.supplier_documents_is_owner() then
    raise exception 'Only the owner or an administrator can change the supplier document checklist.' using errcode = '42501';
  end if;
  update public.supplier_document_types set is_active = coalesce(p_active, true) where key = p_key;
  if not found then
    raise exception 'Unknown document type %.', p_key using errcode = 'P0002';
  end if;
  return jsonb_build_object('ok', true, 'key', p_key, 'is_active', coalesce(p_active, true));
end
$fn$;

-- ---------------------------------------------------------------- permissions
alter table public.supplier_document_types enable row level security;
alter table public.supplier_type_document_profiles enable row level security;
alter table public.supplier_document_supplier_profiles enable row level security;
alter table public.supplier_document_subjects enable row level security;
alter table public.supplier_documents enable row level security;
alter table public.supplier_document_events enable row level security;
alter table public.supplier_document_handoffs enable row level security;
revoke all on public.supplier_document_types, public.supplier_type_document_profiles, public.supplier_document_supplier_profiles,
  public.supplier_document_subjects, public.supplier_documents, public.supplier_document_events, public.supplier_document_handoffs from public, anon;
grant select, insert, update on public.supplier_document_types to authenticated;
grant select, insert, update, delete on public.supplier_type_document_profiles to authenticated;
grant select, insert, update, delete on public.supplier_document_supplier_profiles to authenticated;
grant select, insert, update on public.supplier_document_subjects to authenticated;
grant select, insert, update on public.supplier_documents to authenticated;
grant select, insert on public.supplier_document_events to authenticated;
grant select, insert, update on public.supplier_document_handoffs to authenticated;

drop policy if exists supplier_document_types_staff_read on public.supplier_document_types;
create policy supplier_document_types_staff_read on public.supplier_document_types for select to authenticated using (public.is_active_staff());
drop policy if exists supplier_document_types_owner_write on public.supplier_document_types;
create policy supplier_document_types_owner_write on public.supplier_document_types for all to authenticated using (public.current_role()::text in ('owner', 'administrator')) with check (public.current_role()::text in ('owner', 'administrator'));
drop policy if exists supplier_type_document_profiles_staff_read on public.supplier_type_document_profiles;
create policy supplier_type_document_profiles_staff_read on public.supplier_type_document_profiles for select to authenticated using (public.is_active_staff());
drop policy if exists supplier_type_document_profiles_owner_write on public.supplier_type_document_profiles;
create policy supplier_type_document_profiles_owner_write on public.supplier_type_document_profiles for all to authenticated using (public.current_role()::text in ('owner', 'administrator')) with check (public.current_role()::text in ('owner', 'administrator'));
drop policy if exists supplier_document_supplier_profiles_staff_read on public.supplier_document_supplier_profiles;
create policy supplier_document_supplier_profiles_staff_read on public.supplier_document_supplier_profiles for select to authenticated using (public.is_active_staff());
drop policy if exists supplier_document_supplier_profiles_owner_write on public.supplier_document_supplier_profiles;
create policy supplier_document_supplier_profiles_owner_write on public.supplier_document_supplier_profiles for all to authenticated using (public.current_role()::text in ('owner', 'administrator')) with check (public.current_role()::text in ('owner', 'administrator'));
drop policy if exists supplier_document_subjects_staff_read on public.supplier_document_subjects;
create policy supplier_document_subjects_staff_read on public.supplier_document_subjects for select to authenticated using (public.is_active_staff());
drop policy if exists supplier_document_subjects_staff_add on public.supplier_document_subjects;
create policy supplier_document_subjects_staff_add on public.supplier_document_subjects for insert to authenticated with check (public.is_active_staff() and is_active);
drop policy if exists supplier_document_subjects_owner_update on public.supplier_document_subjects;
create policy supplier_document_subjects_owner_update on public.supplier_document_subjects for update to authenticated using (public.current_role()::text in ('owner', 'administrator')) with check (public.current_role()::text in ('owner', 'administrator'));
drop policy if exists supplier_documents_staff_read on public.supplier_documents;
create policy supplier_documents_staff_read on public.supplier_documents for select to authenticated using (public.is_active_staff());
drop policy if exists supplier_documents_staff_record on public.supplier_documents;
create policy supplier_documents_staff_record on public.supplier_documents for insert to authenticated with check (public.is_active_staff() and status = 'received');
-- who may change what is the guard's job; the row rule only keeps outsiders away
drop policy if exists supplier_documents_staff_update on public.supplier_documents;
create policy supplier_documents_staff_update on public.supplier_documents for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
drop policy if exists supplier_document_events_staff_read on public.supplier_document_events;
create policy supplier_document_events_staff_read on public.supplier_document_events for select to authenticated using (public.is_active_staff());
-- hand-offs: the person who handed it off, the owner and administrators see it;
-- any active staff may hand one off; only the owner or an administrator resolves (the guard says so too)
drop policy if exists supplier_document_handoffs_read on public.supplier_document_handoffs;
create policy supplier_document_handoffs_read on public.supplier_document_handoffs for select to authenticated using (handed_by = auth.uid() or public.is_owner_or_admin());
drop policy if exists supplier_document_handoffs_staff_add on public.supplier_document_handoffs;
create policy supplier_document_handoffs_staff_add on public.supplier_document_handoffs for insert to authenticated with check (public.is_active_staff() and status = 'waiting');
drop policy if exists supplier_document_handoffs_owner_resolve on public.supplier_document_handoffs;
create policy supplier_document_handoffs_owner_resolve on public.supplier_document_handoffs for update to authenticated using (public.current_role()::text in ('owner', 'administrator')) with check (public.current_role()::text in ('owner', 'administrator'));
-- inserts come only from this feature's triggers (the history guard refuses any other)
drop policy if exists supplier_document_events_trigger_insert on public.supplier_document_events;
create policy supplier_document_events_trigger_insert on public.supplier_document_events for insert to authenticated with check (public.is_active_staff());

revoke all on function public.supplier_documents_is_owner() from public, anon;
revoke all on function public.supplier_documents_can_review(uuid) from public, anon;
revoke all on function public.supplier_document_profiles_known(text[]) from public, anon;
revoke all on function public.supplier_document_events_guard() from public, anon;
revoke all on function public.supplier_documents_guard() from public, anon;
revoke all on function public.supplier_documents_history() from public, anon;
revoke all on function public.supplier_document_checklist_guard() from public, anon;
revoke all on function public.supplier_document_checklist_history() from public, anon;
revoke all on function public.record_supplier_document(uuid, uuid, text, text, text, text, text, date, date, date, text) from public, anon;
revoke all on function public.review_supplier_document(uuid, text, text) from public, anon;
revoke all on function public.withdraw_supplier_document(uuid, text) from public, anon;
revoke all on function public.correct_supplier_document(uuid, text, date, date, date) from public, anon;
revoke all on function public.set_supplier_type_document_profiles(text, text[]) from public, anon;
revoke all on function public.set_supplier_document_profiles(uuid, text[]) from public, anon;
revoke all on function public.set_supplier_document_type_active(text, boolean) from public, anon;
revoke all on function public.supplier_document_handoffs_guard() from public, anon;
revoke all on function public.supplier_document_handoffs_history() from public, anon;
revoke all on function public.attach_supplier_document_file(uuid, text, text, integer, text) from public, anon;
revoke all on function public.hand_off_supplier_document(uuid, uuid, text, text, text, date, text) from public, anon;
revoke all on function public.resolve_supplier_document_handoff(uuid, uuid) from public, anon;
revoke all on function public.dismiss_supplier_document_handoff(uuid, text) from public, anon;
grant execute on function public.supplier_documents_is_owner() to authenticated;
grant execute on function public.supplier_documents_can_review(uuid) to authenticated;
grant execute on function public.supplier_document_profiles_known(text[]) to authenticated;
grant execute on function public.record_supplier_document(uuid, uuid, text, text, text, text, text, date, date, date, text) to authenticated;
grant execute on function public.review_supplier_document(uuid, text, text) to authenticated;
grant execute on function public.withdraw_supplier_document(uuid, text) to authenticated;
grant execute on function public.correct_supplier_document(uuid, text, date, date, date) to authenticated;
grant execute on function public.set_supplier_type_document_profiles(text, text[]) to authenticated;
grant execute on function public.set_supplier_document_profiles(uuid, text[]) to authenticated;
grant execute on function public.set_supplier_document_type_active(text, boolean) to authenticated;
grant execute on function public.attach_supplier_document_file(uuid, text, text, integer, text) to authenticated;
grant execute on function public.hand_off_supplier_document(uuid, uuid, text, text, text, date, text) to authenticated;
grant execute on function public.resolve_supplier_document_handoff(uuid, uuid) to authenticated;
grant execute on function public.dismiss_supplier_document_handoff(uuid, text) to authenticated;

-- ---------------------------------------------------------------- the starting checklist
-- The owner's checklist of Nov 16. Changed later only by the owner, from the page
-- or with the setters above; a second run of this file leaves changes alone.
insert into public.supplier_document_types (key, label, subject_kind, profile, profile_label, stages, also_when_paid, sort_order) values
  ('quote_or_order_confirmation', 'Quote or order confirmation', 'purchase', 'purchase', 'Purchases', array['ordered', 'shipped', 'received'], false, 10),
  ('supplier_invoice', 'Supplier invoice', 'purchase', 'purchase', 'Purchases', array['shipped', 'received'], true, 20),
  ('packing_slip', 'Packing slip', 'purchase', 'purchase', 'Purchases', array['received'], false, 30),
  ('approved_ingredient_list', 'Approved ingredient list', 'formula', 'lotion_lab', 'Lotion lab', null, false, 40),
  ('batch_record', 'Batch or lot record', 'batch', 'lotion_lab', 'Lotion lab', null, false, 50),
  ('certificate_of_analysis', 'Certificate of analysis', 'batch', 'lotion_lab', 'Lotion lab', null, false, 60),
  ('component_specification', 'Component specification', 'component', 'bottles_pumps', 'Bottles and pumps', null, false, 70),
  ('approved_artwork', 'Approved artwork', 'artwork', 'labels_printing', 'Printed labels or direct bottle printing', null, false, 80),
  ('printer_proof', 'Printer proof', 'artwork', 'labels_printing', 'Printed labels or direct bottle printing', null, false, 90)
  on conflict (key) do nothing;
insert into public.supplier_type_document_profiles (supplier_type, profiles) values
  ('lab', array['lotion_lab']), ('packaging', array['bottles_pumps'])
  on conflict (supplier_type) do nothing;

commit;
