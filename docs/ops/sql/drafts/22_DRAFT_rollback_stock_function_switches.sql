-- DRAFT (2026-10-10, extension 9). NOT INSTALLED. Rollback of
-- 21_DRAFT_stock_function_switches.sql. Removes the five stock_fn_* switches.
-- Refuses (changes nothing) while any of them is still ON: turn them off on the
-- Feature Switches page first, so no button changes behaviour mid-rollback.
-- Leaves R1–R5 installed (their own rollback is drafts/11). Run this BEFORE
-- drafts/11 if both are rolled back.

begin;

do $$
begin
  if exists (select 1 from public.feature_flags where flag_key like 'stock_fn_%' and enabled is true) then
    raise exception 'Rollback stopped, nothing was changed: a stock_fn_* switch is still on. Turn it off on Feature Switches first.' using errcode = '55000';
  end if;
end $$;

delete from public.feature_flags
 where flag_key in ('stock_fn_receive_po', 'stock_fn_recall', 'stock_fn_return', 'stock_fn_adjust', 'stock_fn_delete_product');

commit;

-- Verification (read-only), expected: 0 rows.
-- select flag_key from public.feature_flags where flag_key like 'stock_fn_%';
