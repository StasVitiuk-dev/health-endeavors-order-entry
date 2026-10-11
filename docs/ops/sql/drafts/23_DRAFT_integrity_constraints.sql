-- DRAFT (2026-10-10, extension 9). NOT INSTALLED. PRODUCTION CHANGE: needs the
-- owner's approval. Rollback: 24_DRAFT_rollback_integrity_constraints.sql.
-- Tested only on the local throwaway database (local-test/integrity_constraints_test.sh).
--
-- What it is: four database rules (CHECK constraints) for facts that are
-- already supposed to be true (local-test/invariants.sql, Query F), so the
-- database itself refuses a value that cannot be right, whatever wrote it
-- (dashboard, agent, script, or a bug):
--   inventory.recalled >= 0                       (the other 7 buckets already have this rule)
--   inventory_lots: 0 <= quantity_remaining <= quantity_received
--   purchase_order_items: 0 <= quantity_received <= quantity
--   returns.refund_amount is empty or >= 0
-- It changes no existing value. If ANY existing row already breaks a rule,
-- it stops before changing anything and says how many rows (fix those first;
-- Query E / Query F list them).
--
-- Order: independent of R1–R5 and the switches; best after Query E/F show 0.
-- Locking: adding a CHECK reads each table once while holding a lock that
-- blocks writes to it; the tables are small (no real orders yet), so this is
-- well under a second. Install outside working hours.

begin;

do $$
declare n_rec bigint; n_lot bigint; n_line bigint; n_ref bigint;
begin
  select count(*) into n_rec from public.inventory where recalled < 0;
  select count(*) into n_lot from public.inventory_lots where quantity_remaining < 0 or quantity_remaining > quantity_received;
  select count(*) into n_line from public.purchase_order_items where quantity_received < 0 or quantity_received > quantity;
  select count(*) into n_ref from public.returns where refund_amount < 0;
  if n_rec + n_lot + n_line + n_ref > 0 then
    raise exception 'Install stopped, nothing was changed: existing rows already break a rule (recalled below 0: %, lots out of range: %, PO lines out of range: %, negative refunds: %). Fix them first, then run this again.',
      n_rec, n_lot, n_line, n_ref using errcode = '23514';
  end if;
end $$;

alter table public.inventory add constraint inventory_recalled_check check (recalled >= 0);
alter table public.inventory_lots add constraint inventory_lots_remaining_range_check
  check (quantity_remaining >= 0 and quantity_remaining <= quantity_received);
alter table public.purchase_order_items add constraint purchase_order_items_received_range_check
  check (quantity_received >= 0 and quantity_received <= quantity);
alter table public.returns add constraint returns_refund_amount_check
  check (refund_amount is null or refund_amount >= 0);

commit;

-- Verification (read-only), expected: 4 rows.
-- select conrelid::regclass, conname from pg_constraint
--  where conname in ('inventory_recalled_check', 'inventory_lots_remaining_range_check',
--                    'purchase_order_items_received_range_check', 'returns_refund_amount_check');
