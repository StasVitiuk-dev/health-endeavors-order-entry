-- =============================================================================
-- Health Endeavors — READ-ONLY check of elevated functions (Query D)
-- PREPARED 2026-10-05 — NOT YET TO BE RUN (owner runs it only when asked).
--
-- Why: SECURITY DEFINER functions run with the owner's rights, not the
-- caller's. Whether one is safe to expose through the API depends on who may
-- execute it and whether it checks WHO is calling. This routine review
-- answers that per function with yes/no flags only.
--
-- ONE SELECT statement. It reads the system catalog and changes NOTHING.
-- It returns NO function source code: only names, settings and true/false
-- answers computed from the code, so no secret inside a function can leak.
--
-- Columns (all named, so the CSV export keeps every field):
--   function_name       schema.name(arguments)
--   kind                'trigger function' (cannot be called through the API)
--                       or 'callable'
--   anon_can_execute    true = callable with the public anon key
--   authenticated_can_execute
--   checks_identity     mentions auth.uid() / auth.jwt() / auth.role() /
--                       current_role() / is_owner_or_admin()
--   gate_pattern        has an IF … THEN … RAISE (or RETURN) close to one of
--                       those identity checks — a likely "refuse strangers" gate
--   writes_data         contains INSERT / UPDATE / DELETE
--   returns_rows        returns a table or set (could expose data)
--   search_path_pinned  has SET search_path (protects definer functions)
--   source_lines        size only
-- Flags are pattern matches, not proof: a "false" means "look closer", and a
-- "true" gate still has to be read by a person before deciding anything.
-- =============================================================================
select
  n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as function_name,
  case when p.prorettype = 'trigger'::regtype then 'trigger function' else 'callable' end as kind,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  (p.prosrc ~* '(auth\.uid\(\)|auth\.jwt\(\)|auth\.role\(\)|current_role\(\)|is_owner_or_admin\(\))') as checks_identity,
  (p.prosrc ~* 'if[\s\S]{0,200}(auth\.uid\(\)|auth\.jwt\(\)|auth\.role\(\)|current_role\(\)|is_owner_or_admin\(\))[\s\S]{0,200}then[\s\S]{0,250}(raise|return)'
   or p.prosrc ~* 'where[\s\S]{0,120}(auth\.uid\(\)|is_owner_or_admin\(\)|current_role\(\))') as gate_pattern,
  (p.prosrc ~* '\m(insert\s+into|update\s+\S+\s+set|delete\s+from)\M') as writes_data,
  p.proretset as returns_rows,
  coalesce(array_to_string(p.proconfig, ',') ~* 'search_path', false) as search_path_pinned,
  array_length(regexp_split_to_array(p.prosrc, E'\n'), 1) as source_lines
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef                                   -- SECURITY DEFINER only
  and p.prokind = 'f'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')  -- skip extension functions
order by anon_can_execute desc, kind, function_name;
