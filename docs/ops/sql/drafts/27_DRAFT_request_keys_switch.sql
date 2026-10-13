-- DRAFT (2026-10-10, extension 9). NOT INSTALLED. PRODUCTION CHANGE: needs the
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   27   (PRODUCTION-CHANGE-DRAFT, step P7)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  19
-- @risk:        LOW
-- @precheck:    refuses without drafts/19 or feature_flags
-- @effect:      request_keys switch row, OFF
-- @postcheck:   1 row, enabled = false
-- @rollback:    drafts/28
-- @@ end metadata @@
-- owner's approval. Rollback: 28_DRAFT_rollback_request_keys_switch.sql.
-- Tested only on the local throwaway database (local-test/request_keys_switch_test.sh).
--
-- What it is: one on/off switch, request_keys, OFF. When the owner turns it on
-- (Feature Switches page; the page first checks the columns exist), the
-- dashboard sends a request key with every new record it creates (EXT9: expenses,
-- products, suppliers, purchase orders, recalls; EXT10: all other create forms
-- and incident escalation), so a repeat after a lost reply is refused instead
-- of saved twice. Off = no key is sent (today).
-- ORDER: drafts/19 (the columns) first; this file stops if they are missing.
-- It changes no table, column, policy or existing row; running it twice
-- changes nothing.

begin;

do $$
begin
  if to_regclass('public.feature_flags') is null then
    raise exception 'Install stopped, nothing was changed: table public.feature_flags is missing.' using errcode = '42P01';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'feature_flags'
                  and column_name = 'id' and (column_default is not null or is_identity = 'YES')) then
    raise exception 'Install stopped, nothing was changed: feature_flags.id does not fill itself in.' using errcode = '23502';
  end if;
  if exists (select 1 from unnest(array['expenses','products','suppliers','purchase_orders','recalls']) t
              where not exists (select 1 from information_schema.columns c
                                 where c.table_schema = 'public' and c.table_name = t and c.column_name = 'client_request_id')) then
    raise exception 'Install stopped, nothing was changed: install drafts/19 (request keys) first.' using errcode = '42703';
  end if;
end $$;

insert into public.feature_flags (flag_key, label, description, enabled)
select 'request_keys', 'Request keys on new records',
       'Every new record the dashboard creates carries a key, so a repeat after a lost reply is refused instead of saved twice. Needs drafts/19.', false
 where not exists (select 1 from public.feature_flags where flag_key = 'request_keys');

commit;

-- Verification (read-only), expected: 1 row, enabled = false.
-- select flag_key, enabled from public.feature_flags where flag_key = 'request_keys';
