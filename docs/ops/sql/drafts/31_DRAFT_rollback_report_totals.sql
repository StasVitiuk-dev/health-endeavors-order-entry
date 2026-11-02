-- =============================================================================
-- DRAFT ROLLBACK — NOT INSTALLED. PRODUCTION CHANGE: needs the owner's approval.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   31   (ROLLBACK, rolls back 13)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    reports whether 13 is installed
-- @effect:      drops the function
-- @postcheck:   to_regprocedure(...) is null
-- @rollback:    (this file is the rollback of drafts/13)
-- @@ end metadata @@
-- Re-install: run 13 again (safe; create or replace).
-- Written EXT14 (2026-10-11). A true rollback exists because 13 only creates a
-- function and its grants; nothing else depends on it and it keeps no data.
-- Safe to run twice; running it before 13 changes nothing.
-- Tested: local-test/report_totals_rollback_test.sh (install, rollback,
-- reinstall, rollback twice, rollback before install, failed install leaves nothing).
-- =============================================================================
begin;

do $$
begin
  if to_regprocedure('public.report_totals(timestamptz, timestamptz, date, date, text)') is null then
    raise notice 'report_totals is not installed: nothing to roll back (nothing was changed).';
  else
    raise notice 'Removing report_totals (13). The dashboard does not call it, so nothing visible changes.';
  end if;
end $$;

drop function if exists public.report_totals(timestamptz, timestamptz, date, date, text);

commit;

-- Postcheck (read-only): expect NULL
-- select to_regprocedure('public.report_totals(timestamptz, timestamptz, date, date, text)');
