-- DRAFT (2026-11-25). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   62   (PRODUCTION-CHANGE-DRAFT, step optional (owner's decision of Nov 24: four levels of account, with a new level Manager between Administrator and Employee). Run before drafts/64)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if the list of roles public.app_role is missing or does not hold owner, administrator and employee
-- @effect:      adds the one word manager to the list of roles; gives nobody the role; changes no account, no rule and no permission
-- @postcheck:   the list of roles holds manager; no account has it; local-test/people_levels_test.sh passes on a throwaway copy
-- @rollback:    drafts/63
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 63_DRAFT_rollback_manager_role.sql.
-- Tested only on the local throwaway database (local-test/people_levels_test.sh).
--
-- Why (owner, Nov 24): four levels of account: Owner, Administrator ("like an
-- owner but a little lower"), Manager (new) and Employee. The list of roles in
-- the database has no "manager" yet. This file adds that one word to the list.
-- It gives nobody the role and changes no account, no rule and no permission:
-- a manager is treated exactly like an employee until drafts/64 is installed.
--
-- It is a file of its own because the database does not allow a new role word
-- to be used in the same step that adds it. Run this one first, then drafts/64.
--
-- Honest limits
--   * A role word cannot be taken out of the list again while the list is in
--     use (the database has no such command). The rollback therefore removes
--     nothing: an unused word in the list does nothing. See drafts/63.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_people_levels_install'));

do $pre$
begin
  if to_regtype('public.app_role') is null then
    raise exception 'Not installed: this database has no list of roles called public.app_role. Nothing was changed; show this message before going further.';
  end if;
  if not exists (select 1 from pg_enum e where e.enumtypid = to_regtype('public.app_role') and e.enumlabel = 'employee')
     or not exists (select 1 from pg_enum e where e.enumtypid = to_regtype('public.app_role') and e.enumlabel = 'administrator')
     or not exists (select 1 from pg_enum e where e.enumtypid = to_regtype('public.app_role') and e.enumlabel = 'owner') then
    raise exception 'Not installed: the list of roles does not hold owner, administrator and employee as expected. Nothing was changed; show this message before going further.';
  end if;
end
$pre$;

alter type public.app_role add value if not exists 'manager';

commit;
