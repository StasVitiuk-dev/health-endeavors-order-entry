-- DRAFT ROLLBACK (2026-10-07, extension 6) for 19_DRAFT_request_keys.sql.
-- NOT RUN ANYWHERE BUT THE LOCAL TEST DATABASE.
--
-- Removes the client_request_id index and column from every table 19 touched.
-- Run the dashboard rollback FIRST (the dashboard version that does not send
-- client_request_id), otherwise every save would fail once the column is gone.
-- The keys themselves carry no business data, so dropping them loses nothing
-- but the duplicate protection. Safe to run twice; tables that do not exist
-- are skipped.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_request_keys_install'));

do $rollback$
declare
  v_tables text[] := array[
    'expenses', 'inventory_adjustments', 'inventory_lots', 'returns', 'recalls',
    'products', 'suppliers', 'documents', 'evidence_locker', 'adverse_event_reports',
    'legal_holds', 'quality_checks', 'incidents', 'sop_documents', 'feature_requests',
    'manual_attention_items', 'personal_calendar_events', 'tasks',
    'orders', 'order_items', 'purchase_orders', 'purchase_order_items'];
  v_t text;
begin
  foreach v_t in array v_tables loop
    if to_regclass(format('public.%I', v_t)) is null then continue; end if;
    execute format('drop index if exists public.%I', v_t || '_client_request_id_key');
    execute format('alter table public.%I drop column if exists client_request_id', v_t);
  end loop;
end $rollback$;

commit;
