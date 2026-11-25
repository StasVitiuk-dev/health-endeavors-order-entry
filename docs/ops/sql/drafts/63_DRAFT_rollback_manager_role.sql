-- DRAFT (2026-11-25). NOT INSTALLED. ROLLBACK of drafts/62 (the Manager role word).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   63   (ROLLBACK, rolls back 62)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops with a message while any account still has the role manager
-- @effect:      removes nothing (the database cannot take a word out of the list of roles; an unused word does nothing); it only checks that no account is a manager
-- @postcheck:   it says that no account is a manager
-- @rollback:    (this file is the rollback of drafts/62)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- What it does: nothing is removed. The database has no command to take a word
-- out of the list of roles, and an unused word in the list does nothing. This
-- file only CHECKS, and says so, that no account has the role "manager", which
-- is the real state "as before": with nobody a manager and drafts/64 rolled
-- back (drafts/65), the dashboard and the database behave exactly as before
-- drafts/62.
-- It STOPS with a message while any account is still a manager: change those
-- accounts to another role first (the owner, on the dashboard), then run it
-- again. Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_people_levels_install'));

do $guard$
declare v_managers bigint := 0;
begin
  if to_regclass('public.profiles') is not null then
    execute format('select count(*) from %I.%I where role::text = %L', 'public', 'profiles', 'manager') into v_managers;
  end if;
  if v_managers > 0 then
    raise exception 'Rollback stopped: % account(s) still have the role manager. Give them another role first. Nothing was changed.', v_managers;
  end if;
  raise notice 'No account is a manager. The word stays in the list of roles and does nothing.';
end
$guard$;

commit;
