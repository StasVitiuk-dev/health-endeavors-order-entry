-- READ-ONLY QUERY H: production drift check (2026-10-11, extension 10).
-- READ-ONLY: one SELECT. It changes nothing. Safe to run any time, as often
-- as wanted (Supabase -> SQL Editor -> New query -> paste -> Run -> Export CSV).
-- What it answers: does production match what was reviewed?
--   * are the R1-R5 stock functions there, and are they EXACTLY the reviewed
--     version (fingerprint)?  * can anonymous visitors run them?
--   * which high-risk switches exist, and is any switch ON while the thing it
--     needs is missing or not the reviewed version (an impossible combination)?
--   * request-key columns, nightly check, PO line guard, integrity rules present?
-- Each row: ITEM, EXPECTED, OBSERVED, STATUS (PASS / NOT INSTALLED / WARN /
-- FAIL) and ACTION in plain words. NOT INSTALLED is normal before a step is
-- done. No customer data, function code, keys or tokens are printed.
-- Interpret with: node tests/tools/interpret-query-results.js H <file.csv>
-- Local test: docs/ops/sql/local-test/drift_check_test.sh
with fn as (
  select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('_he_apply_stock_change', 'adjust_inventory', 'receive_purchase_order', 'quarantine_recall', 'receive_return', 'delete_unused_product')
), fp as (
  select count(*) as n,
         md5(string_agg(p.proname || ':' || pg_get_function_identity_arguments(p.oid) || ':' || md5(p.prosrc), ',' order by p.proname)) as v,
         count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE')) as anon_n
    from pg_proc p join fn on fn.oid = p.oid
), fnok as (
  select (n = 6 and v = 'f6d9c2c8be690710eeb721041f6779d9') as ok, n from fp
), sw(flag_key, needs, ord) as (
  values ('stock_fn_receive_po', 'receive_purchase_order', 3), ('stock_fn_recall', 'quarantine_recall', 4), ('stock_fn_return', 'receive_return', 5),
         ('stock_fn_adjust', 'adjust_inventory', 6), ('stock_fn_delete_product', 'delete_unused_product', 7)
), swstate as (
  select sw.flag_key, sw.ord, f.enabled, (f.flag_key is not null) as present
    from sw left join public.feature_flags f on f.flag_key = sw.flag_key
), rk as (
  select (select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'client_request_id') as cols,
         (select enabled from public.feature_flags where flag_key = 'request_keys' limit 1) as enabled,
         exists (select 1 from public.feature_flags where flag_key = 'request_keys') as present
), ih as (
  select (to_regclass('public.integrity_check_results') is not null) as t25,
         (to_regclass('public.integrity_check_runs') is not null) as t29,
         (to_regprocedure('public.run_integrity_check()') is not null) as fn25,
         (select enabled from public.feature_flags where flag_key = 'integrity_results_home' limit 1) as enabled,
         exists (select 1 from public.feature_flags where flag_key = 'integrity_results_home') as present
)
select id, item, expected, observed, status, action from (
  select 'H01' as id, 'R1-R5 stock functions (drafts/10)' as item,
         '6 functions, fingerprint f6d9c2c8be690710eeb721041f6779d9' as expected,
         fp.n || ' present' || case when fp.n > 0 then ', fingerprint ' || fp.v else '' end as observed,
         case when fp.n = 0 then 'NOT INSTALLED' when fnok.ok then 'PASS' else 'FAIL' end as status,
         case when fp.n = 0 then 'Normal before step P2.' when fnok.ok then 'Nothing to do.'
              else 'STOP: the installed functions are not the reviewed version. Turn every stock switch off; do not install anything else; send this CSV.' end as action
    from fp, fnok
  union all
  select 'H02', 'Anonymous visitors cannot run the stock functions', '0 functions runnable by anon',
         fp.anon_n || ' runnable by anon',
         case when fp.n = 0 then 'NOT INSTALLED' when fp.anon_n = 0 then 'PASS' else 'FAIL' end,
         case when fp.anon_n = 0 then 'Nothing to do.' else 'STOP: anonymous visitors can call a stock function. Send this CSV; Claude prepares the exact revoke.' end
    from fp
  union all
  select 'H0' || s.ord, 'Switch ' || s.flag_key || ' (drafts/21)',
         'absent before P3; OFF after P3; ON only after its function passes H01',
         case when not s.present then 'no switch row' when s.enabled then 'ON' else 'OFF' end,
         case when not s.present then 'NOT INSTALLED'
              when s.enabled and not fnok.ok then 'FAIL'
              when s.enabled then 'WARN'
              else 'PASS' end,
         case when not s.present then 'Normal before step P3.'
              when s.enabled and not fnok.ok then 'STOP: this switch is ON but its function is missing or not the reviewed version. Turn it OFF now (Feature Switches).'
              when s.enabled then 'ON: confirm it was turned on deliberately (P4) and its first real use was checked.'
              else 'Nothing to do.' end
    from swstate s, fnok
  union all
  select 'H08', 'Request keys (drafts/19 columns, drafts/27 switch)',
         'columns before switch; switch OFF until V11',
         rk.cols || ' tables with the column; switch ' || case when not rk.present then 'absent' when rk.enabled then 'ON' else 'OFF' end,
         case when rk.enabled and rk.cols = 0 then 'FAIL'
              when rk.cols = 0 and not rk.present then 'NOT INSTALLED'
              when rk.present and rk.cols = 0 then 'WARN'
              when rk.enabled then 'WARN'
              else 'PASS' end,
         case when rk.enabled and rk.cols = 0 then 'STOP: request keys are ON but the columns are missing, so saves fail. Turn the switch OFF now.'
              when rk.present and rk.cols = 0 then 'The switch row exists without the columns (wrong order). Leave it OFF; install drafts/19.'
              when rk.enabled then 'ON: confirm it was turned on deliberately (P7b).'
              when rk.cols = 0 then 'Normal before step P7.' else 'Nothing to do.' end
    from rk
  union all
  select 'H09', 'Nightly integrity check (drafts/25 + 29) and its Home switch',
         'tables and function before the switch; switch OFF until V12',
         case when ih.t25 then 'results table present' else 'results table absent' end || ', ' ||
         case when ih.t29 then 'run log present' else 'run log absent' end || ', switch ' ||
         case when not ih.present then 'absent' when ih.enabled then 'ON' else 'OFF' end,
         case when ih.enabled and not ih.t29 then 'FAIL'
              when not ih.t25 and not ih.t29 and not ih.present then 'NOT INSTALLED'
              when ih.t29 and not ih.t25 then 'FAIL'
              when ih.enabled then 'WARN'
              else 'PASS' end,
         case when ih.enabled and not ih.t29 then 'The Home switch is ON without the tables: turn it OFF (the card then says "not set up").'
              when ih.t29 and not ih.t25 then 'STOP: drafts/29 parts exist without drafts/25. Send this CSV.'
              when ih.enabled then 'ON: Home shows the nightly result.'
              when not ih.t25 then 'Normal before step P9.' else 'Nothing to do.' end
    from ih
  union all
  select 'H10', 'PO line guard trigger (drafts/17)', 'trigger he_po_line_delete_guard present after P5',
         case when exists (select 1 from pg_trigger where tgname = 'he_po_line_delete_guard' and not tgisinternal) then 'present' else 'absent' end,
         case when exists (select 1 from pg_trigger where tgname = 'he_po_line_delete_guard' and not tgisinternal) then 'PASS' else 'NOT INSTALLED' end,
         case when exists (select 1 from pg_trigger where tgname = 'he_po_line_delete_guard' and not tgisinternal) then 'Nothing to do.' else 'Normal before step P5.' end
  union all
  select 'H11', 'Integrity rules (drafts/23)', '4 rules after P6, or 0 before',
         (select count(*) from pg_constraint where conname in ('inventory_recalled_check', 'inventory_lots_remaining_range_check', 'purchase_order_items_received_range_check', 'returns_refund_amount_check')) || ' of 4',
         case (select count(*) from pg_constraint where conname in ('inventory_recalled_check', 'inventory_lots_remaining_range_check', 'purchase_order_items_received_range_check', 'returns_refund_amount_check'))
              when 4 then 'PASS' when 0 then 'NOT INSTALLED' else 'WARN' end,
         case (select count(*) from pg_constraint where conname in ('inventory_recalled_check', 'inventory_lots_remaining_range_check', 'purchase_order_items_received_range_check', 'returns_refund_amount_check'))
              when 4 then 'Nothing to do.' when 0 then 'Normal before step P6.' else 'Only some rules exist (the file is all-or-nothing, so something else changed them). Send this CSV.' end
) t
order by id;
