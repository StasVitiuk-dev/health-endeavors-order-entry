# R1–R5 stock functions: install and rollback runbook (owner steps)

**Status:** PROPOSED. Do **not** run until:
1. Query C has been run and reviewed, and shows no agent, trigger or scheduled job writing stock directly (or each one has been dealt with).
2. You have approved this specific change in writing in a session.

Installing these functions changes nothing visible on the live dashboard by itself. The dashboard keeps its current behaviour until a separate, reviewed PR switches its buttons to call the functions.

## What gets installed

`docs/ops/sql/drafts/10_DRAFT_stock_functions.sql` creates six database functions:
- `_he_apply_stock_change` (internal helper)
- `adjust_inventory` (R4)
- `receive_purchase_order` (R1)
- `quarantine_recall` (R2)
- `receive_return` (R3)
- `delete_unused_product` (R5)

They run with the caller's own rights (security invoker), so the existing permission rules and audit triggers apply unchanged. Only signed-in users can call them (`authenticated`); the public `anon` key cannot.

**Evidence it works (local copy of the real table shapes, synthetic data):**
- `15_…` and `16_…` tests all pass
- every write was made to fail on purpose, and the database stayed exactly as before each time
- stress tests: 40 runs, 0 deadlocks
- the whole file installs in one transaction: a failure halfway installs nothing (tested)

## Before you start (5 minutes)

1. Make sure nobody is using the dashboard (stock actions especially).
2. Have the rollback file open in a second tab: `docs/ops/sql/drafts/11_DRAFT_rollback_stock_functions.sql`.

## Install (Supabase → SQL Editor)

1. Open Supabase → your Health Endeavors project → **SQL Editor** → **New query**.
2. Paste the **whole** of `10_DRAFT_stock_functions.sql` (from `-- ===` at the top to `commit;` at the bottom).
3. Click **Run**.
4. Expected result: "Success. No rows returned". A few "does not exist, skipping" notices are normal (they're about older draft versions that were never installed).
5. If you see a red **ERROR**: stop. Nothing was installed, because the file is one transaction. Copy the exact error text into the chat.

## Check it (read-only, 1 minute)

New query, paste and run:

```sql
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_run,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as staff_can_run,
       p.prosecdef as runs_with_owner_rights
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('_he_apply_stock_change','adjust_inventory','receive_purchase_order',
                    'quarantine_recall','receive_return','delete_unused_product')
order by 1;
```

Expected: 6 rows, each with `anon_can_run = false`, `staff_can_run = true` and `runs_with_owner_rights = false`. Send a screenshot.

## Roll back (if anything looks wrong)

1. **First**, if the dashboard has already been switched to the functions, revert that dashboard PR (otherwise its buttons would call missing functions).
2. SQL Editor → New query → paste the whole of `11_DRAFT_rollback_stock_functions.sql` → **Run**. It removes only these functions, in one transaction. No table and no data is touched.
3. Re-run the check above: expected 0 rows.

## After install

- A separate dashboard PR switches the stock buttons to the functions. It gets reviewed, merged and checked live like any other.
- Later, and only with your approval: remove direct table write access on the stock tables (backlog INV-20), so the functions become the only path.
