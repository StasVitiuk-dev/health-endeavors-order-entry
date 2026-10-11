-- DRAFT (2026-10-10, extension 9). NOT INSTALLED. PRODUCTION CHANGE: needs the
-- owner's approval. Rollback: 22_DRAFT_rollback_stock_function_switches.sql.
-- Tested only on the local throwaway database (local-test/stock_switches_test.sh).
--
-- What it is: five on/off switches (rows in feature_flags), ALL OFF. The
-- dashboard (EXT9) reads them at every stock button press:
--   stock_fn_receive_po      Purchase orders → Receive    → receive_purchase_order (R1)
--   stock_fn_recall          Recalls → Quarantine          → quarantine_recall      (R2)
--   stock_fn_return          Returns → Mark Received       → receive_return         (R3)
--   stock_fn_adjust          Inventory → Save adjustment   → adjust_inventory       (R4)
--   stock_fn_delete_product  Inventory → Delete product    → delete_unused_product  (R5)
-- Off, missing or unreadable = the button works exactly as today. On = the
-- button calls the database function (all-or-nothing, retry-safe).
--
-- ORDER (see docs/ops/PRODUCTION_CHANGE_PACKAGE_EXT9.md):
--   1. drafts/10 (R1–R5) installed and its checks passed.
--   2. THIS file (switches, all off). Nothing changes for anyone.
--   3. Owner turns ONE switch on (Feature Switches page), tests that button
--      once on real data, then the next (suggested R1 → R4 → R2 → R3 → R5).
--   Rollback of a single button: turn its switch off (instant, no deploy).
--
-- It changes no table, column, policy, function or existing row. It only
-- inserts the five rows that are missing; running it twice changes nothing.
-- Only the columns the dashboard already reads are used (id, flag_key, label,
-- description, enabled); id must fill itself in (a default). If not, it stops
-- and changes nothing.

begin;

do $$
declare missing text[] := '{}';
begin
  if to_regclass('public.feature_flags') is null then
    raise exception 'Install stopped, nothing was changed: table public.feature_flags is missing.' using errcode = '42P01';
  end if;
  select array_agg(c) into missing from unnest(array['id','flag_key','label','description','enabled']) c
   where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'feature_flags' and column_name = c);
  if missing is not null then
    raise exception 'Install stopped, nothing was changed: feature_flags is missing column(s) %.', array_to_string(missing, ', ') using errcode = '42703';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'feature_flags'
                  and column_name = 'id' and (column_default is not null or is_identity = 'YES')) then
    raise exception 'Install stopped, nothing was changed: feature_flags.id does not fill itself in. Send this message to the session.' using errcode = '23502';
  end if;
  -- R1–R5 must already be installed, so no switch can ever point at a missing function.
  if to_regprocedure('public.receive_purchase_order(uuid, jsonb, date)') is null
     or to_regprocedure('public.adjust_inventory(uuid, text, integer, text, integer)') is null
     or to_regprocedure('public.quarantine_recall(uuid)') is null
     or to_regprocedure('public.receive_return(uuid, text, integer)') is null
     or to_regprocedure('public.delete_unused_product(uuid)') is null then
    raise exception 'Install stopped, nothing was changed: install drafts/10 (R1–R5) first.' using errcode = '42883';
  end if;
end $$;

insert into public.feature_flags (flag_key, label, description, enabled)
select v.flag_key, v.label, v.description, false
  from (values
    ('stock_fn_receive_po',     'Stock: all-or-nothing receive',     'Purchase orders → Receive uses the receive_purchase_order database function (R1). Off = the older step-by-step receive.'),
    ('stock_fn_recall',         'Stock: all-or-nothing recall',      'Recalls → Quarantine uses the quarantine_recall database function (R2). Off = the older step-by-step quarantine.'),
    ('stock_fn_return',         'Stock: all-or-nothing return',      'Returns → Mark Received uses the receive_return database function (R3). Off = the older step-by-step restock.'),
    ('stock_fn_adjust',         'Stock: all-or-nothing adjustment',  'Inventory → Save adjustment uses the adjust_inventory database function (R4). Off = the older step-by-step adjustment.'),
    ('stock_fn_delete_product', 'Stock: all-or-nothing delete',      'Inventory → Delete product uses the delete_unused_product database function (R5). Off = the older step-by-step delete.')
  ) as v(flag_key, label, description)
 where not exists (select 1 from public.feature_flags f where f.flag_key = v.flag_key);

commit;

-- Verification (read-only), expected: 5 rows, enabled = false for each.
-- select flag_key, enabled from public.feature_flags where flag_key like 'stock_fn_%' order by flag_key;
