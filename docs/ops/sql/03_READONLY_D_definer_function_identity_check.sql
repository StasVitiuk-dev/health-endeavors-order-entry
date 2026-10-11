-- =============================================================================
-- Health Endeavors — READ-ONLY check of elevated functions (Query D)
-- PREPARED 2026-10-05, refined 2026-10-06 — NOT YET TO BE RUN (owner runs it
-- only when asked).
--
-- Why: SECURITY DEFINER functions run with the owner's rights, not the
-- caller's. Whether one is safe to expose through the API depends on who may
-- execute it and whether it checks WHO is calling. This routine review
-- answers that per function with yes/no flags only. It does not decide
-- anything: a person reads each flagged function before any change.
--
-- ONE SELECT statement. It reads the system catalog and changes NOTHING.
-- It returns NO function source code: only names, settings and true/false
-- answers computed from the code, so no secret inside a function can leak.
-- Named columns, so the CSV export keeps every field.
--
-- Columns, and what each answer means:
--   function_name       schema.name(argument types) — no argument values
--   kind                'trigger function' = runs only from a table trigger;
--                       it cannot be called through the API at all
--                       'callable' = can be called as /rest/v1/rpc/<name>
--   anon_can_execute    true = callable with the PUBLIC anon key (anyone who
--                       has the website's public key, signed in or not)
--   authenticated_can_execute  true = callable by any signed-in user
--   checks_identity     the code mentions a "who is calling" check:
--                       auth.uid() / auth.jwt() / auth.role() / request.jwt
--                       claims / current_role() / is_owner_or_admin()
--   gate_pattern        an IF … THEN … RAISE/RETURN close to such a check, or a
--                       WHERE that filters by it — a likely "refuse strangers"
--                       gate. A strong sign, not proof.
--   writes_data         contains INSERT / UPDATE / DELETE
--   returns_rows        returns a table or set (could expose data)
--   search_path_pinned  has SET search_path (protects definer functions from
--                       being tricked by look-alike objects)
--   source_lines        size only
--   classification      the suggested reading of the flags above:
--     A trigger only            — not reachable through the API; fine
--     B not callable by anon    — anon can't run it (signed-in users may)
--     C anon + gate             — anon can run it, but it checks the caller
--                                 first; read it to confirm the gate is right
--     D anon + no gate, read    — anon can run it, no caller check, only
--                                 reads: may expose data; read it next
--     E anon + no gate, WRITES  — anon can run it, no caller check, and it
--                                 changes data: look at these first
-- =============================================================================
select
  n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as function_name,
  case when p.prorettype = 'trigger'::regtype then 'trigger function' else 'callable' end as kind,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  (p.prosrc ~* '(auth\.uid\(\)|auth\.jwt\(\)|auth\.role\(\)|request\.jwt|current_role\(\)|is_owner_or_admin\(\))') as checks_identity,
  (p.prosrc ~* 'if[\s\S]{0,200}(auth\.uid\(\)|auth\.jwt\(\)|auth\.role\(\)|request\.jwt|current_role\(\)|is_owner_or_admin\(\))[\s\S]{0,200}then[\s\S]{0,250}(raise|return)'
   or p.prosrc ~* 'where[\s\S]{0,120}(auth\.uid\(\)|is_owner_or_admin\(\)|current_role\(\))') as gate_pattern,
  (p.prosrc ~* '\m(insert\s+into|update\s+\S+\s+set|delete\s+from)\M') as writes_data,
  p.proretset as returns_rows,
  coalesce(array_to_string(p.proconfig, ',') ~* 'search_path', false) as search_path_pinned,
  array_length(regexp_split_to_array(p.prosrc, E'\n'), 1) as source_lines,
  case
    when p.prorettype = 'trigger'::regtype then 'A trigger only'
    when not has_function_privilege('anon', p.oid, 'EXECUTE') then 'B not callable by anon'
    when p.prosrc ~* 'if[\s\S]{0,200}(auth\.uid\(\)|auth\.jwt\(\)|auth\.role\(\)|request\.jwt|current_role\(\)|is_owner_or_admin\(\))[\s\S]{0,200}then[\s\S]{0,250}(raise|return)'
      or p.prosrc ~* 'where[\s\S]{0,120}(auth\.uid\(\)|is_owner_or_admin\(\)|current_role\(\))' then 'C anon + gate'
    when p.prosrc ~* '\m(insert\s+into|update\s+\S+\s+set|delete\s+from)\M' then 'E anon + no gate, WRITES'
    else 'D anon + no gate, read'
  end as classification
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef                                   -- SECURITY DEFINER only
  and p.prokind = 'f'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')  -- skip extension functions
order by classification desc, function_name;
