-- =============================================================================
-- Health Endeavors — READ-ONLY follow-up to Query G2 (Query G3)
-- ONE SELECT statement. Changes NOTHING. Returns NO customer rows.
--
-- Status: PREPARED (2026-10-18, after the owner's Query G2 result), NOT RUN on
-- production yet. Tested read-only on the local throwaway database
-- (local-test/timeline_profile_triggers_test.sh).
--
-- Why: G2 reported (1) the view activity_timeline runs with its owner's rights
-- and can be read by not-signed-in visitors, and (2) signed-in users hold the
-- UPDATE right on profiles.role. Two facts decide whether either is a real hole:
--   T1  the view's own SQL text: if it filters by who is asking (auth.uid(),
--       current_role(), is_owner_or_admin()) visitors get nothing; if not, they
--       get every row. Plus its columns, and how many rows it holds (a NUMBER
--       only — never the rows themselves).
--   T2  the source of every trigger function on profiles, so it can be read
--       whether one refuses a change of "role" by a non-owner. Any line that
--       mentions key / secret / token / password / bearer / authorization is
--       replaced by '-- [line removed]' before it is shown.
-- Glance at the output before sending: it should hold SQL code and names only.
--
-- HOW TO RUN (Supabase dashboard → SQL Editor → New query): paste the whole
-- file, Run, Export → Download CSV, send the CSV. It only reads.
-- =============================================================================
with v as (
  select c.oid, c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'activity_timeline' and c.relkind in ('v', 'm')
),
redact as (
  select '(?im)^.*(key|secret|token|password|bearer|authorization).*$' as rx
)
select 'T1 view filters by caller' as check_id, v.relname as object,
       case when pg_get_viewdef(v.oid) ~* '(auth\.uid\(\)|auth\.jwt\(\)|auth\.role\(\)|current_role\(\)|is_owner_or_admin\(\)|request\.jwt)'
            then 'YES: the view text checks who is asking (visitors may get no rows; read T1 definition to confirm)'
            else 'NO: the view text does not check who is asking, so whoever can read it sees every row it returns' end as detail
  from v
union all
select 'T1 view columns', v.relname,
       string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), ', ' order by a.attnum)
  from v join pg_attribute a on a.attrelid = v.oid and a.attnum > 0 and not a.attisdropped
 group by v.relname
union all
select 'T1 view row count', 'activity_timeline',
       (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.activity_timeline', false, true, '')))[1]::text
         || ' rows in total (a number only; no row is shown)'
 where exists (select 1 from v)
union all
select 'T1 view definition', v.relname, regexp_replace(pg_get_viewdef(v.oid, true), (select rx from redact), '-- [line removed]', 'g')
  from v
union all
select 'T2 profiles trigger source', t.tgname || ' → ' || p.proname,
       regexp_replace(pg_get_functiondef(p.oid), (select rx from redact), '-- [line removed]', 'g')
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
 where n.nspname = 'public' and c.relname = 'profiles' and not t.tgisinternal
union all
select 'T2 profiles update policies', policyname,
       permissive || ' ' || cmd || ' for ' || roles::text || ' · using: ' || coalesce(qual, '') || ' · check: ' || coalesce(with_check, '')
  from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd in ('UPDATE', 'ALL')
order by 1, 2;
