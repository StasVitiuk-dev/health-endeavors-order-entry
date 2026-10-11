-- DRAFT (2026-10-10, extension 9). NOT INSTALLED. Rollback of
-- 27_DRAFT_request_keys_switch.sql: removes the request_keys switch. Refuses
-- (changes nothing) while it is ON: turn it off on Feature Switches first.
-- Run this BEFORE drafts/20 (which removes the columns) if both are rolled back.

begin;

do $$
begin
  if exists (select 1 from public.feature_flags where flag_key = 'request_keys' and enabled is true) then
    raise exception 'Rollback stopped, nothing was changed: the request_keys switch is still on. Turn it off on Feature Switches first.' using errcode = '55000';
  end if;
end $$;

delete from public.feature_flags where flag_key = 'request_keys';

commit;
