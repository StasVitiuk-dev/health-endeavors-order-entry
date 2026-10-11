-- DRAFT (2026-10-07, extension 6). NOT INSTALLED. PRODUCTION CHANGE: needs
-- the owner's approval. Rollback: 20_DRAFT_rollback_request_keys.sql.
-- Tested only on the local throwaway database (local-test/request_keys_test.sh).
--
-- Problem (backlog X5-11): when the database saves a new record but the reply
-- never reaches the browser (dropped connection, timeout, closed laptop), the
-- person cannot know it was saved. If they press Save again, a second,
-- identical record is created: a duplicate expense (money), a duplicate stock
-- adjustment (inventory), a second return, recall, product, document, order...
-- The dashboard today makes this unlikely (one save at a time; "cannot tell
-- whether this was saved, check the list first") but cannot prevent it.
--
-- Fix: every create carries a "request key", a random id made in the browser
-- for that one attempt and kept if the same attempt is retried. This file adds
-- a nullable column client_request_id (uuid) to each table the dashboard
-- creates records in, with a unique index that ignores empty values. A retry
-- of an attempt that was in fact saved then hits the index ("already exists")
-- instead of creating a second record, and the dashboard can show the record
-- that was saved.
--
-- What it changes: one new EMPTY column + one index per table. No existing
-- row, value, permission, policy or trigger changes. Existing rows keep NULL
-- (never conflicts). Nothing uses the column until the dashboard is changed
-- to send it — and that dashboard change must ship AFTER this file is
-- installed (sending an unknown column makes every save fail).
--
-- Locking: CREATE INDEX (not CONCURRENTLY, which cannot run inside the
-- transaction that keeps this all-or-nothing) blocks writes to each table
-- while its index is built. The store has no real orders yet and the tables
-- are small, so this is a fraction of a second; install outside working hours
-- anyway.
--
-- Safe to run twice (IF NOT EXISTS everywhere; a second run changes nothing).
-- A table that does not exist is reported and skipped, not created.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_request_keys_install'));

do $install$
declare
  -- The tables the dashboard creates records in (docs/ops/write-paths.classification.json,
  -- "not idempotent" paths, plus the manual-order tables).
  v_tables text[] := array[
    'expenses', 'inventory_adjustments', 'inventory_lots', 'returns', 'recalls',
    'products', 'suppliers', 'documents', 'evidence_locker', 'adverse_event_reports',
    'legal_holds', 'quality_checks', 'incidents', 'sop_documents', 'feature_requests',
    'manual_attention_items', 'personal_calendar_events', 'tasks',
    'orders', 'order_items', 'purchase_orders', 'purchase_order_items'];
  v_t text;
  v_done int := 0;
  v_skipped text := '';
begin
  foreach v_t in array v_tables loop
    if to_regclass(format('public.%I', v_t)) is null then
      v_skipped := v_skipped || ' ' || v_t;
      continue;
    end if;
    execute format('alter table public.%I add column if not exists client_request_id uuid', v_t);
    execute format('create unique index if not exists %I on public.%I (client_request_id) where client_request_id is not null',
                   v_t || '_client_request_id_key', v_t);
    -- The dashboard writes as "authenticated". Tables with column-level
    -- grants would not extend them to a new column: stop rather than install
    -- a column the dashboard could not write.
    if exists (select 1 from pg_roles where rolname = 'authenticated')
       and not has_column_privilege('authenticated', format('public.%I', v_t), 'client_request_id', 'INSERT') then
      raise exception 'Install stopped, nothing was changed: the dashboard role cannot write client_request_id on %. Ask before installing.', v_t;
    end if;
    v_done := v_done + 1;
  end loop;
  raise notice 'Request keys installed on % tables.%', v_done,
    case when v_skipped = '' then '' else ' Not found (skipped):' || v_skipped end;
end $install$;

commit;
