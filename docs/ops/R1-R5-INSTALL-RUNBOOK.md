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
- **preflight (added 2026-10-06):** before creating anything, the file checks that every table, column, unique index and helper function the stock functions rely on exists. If anything is missing it stops, says exactly what is missing, and installs nothing. Without this, PostgreSQL would install the functions "successfully" and they would fail at the first button press
- **install package tests** (`docs/ops/sql/local-test/install_package_test.sh`, 34 checks, all pass, on a throwaway copy of the local database):
  - clean install
  - second install (identical result)
  - install over a leftover old draft
  - rollback, run twice
  - failure halfway, on a first install and on a re-install
  - refusal on a missing helper function, a missing column or a missing unique index
  - refusal for the public role and for employees
  - five re-installs while staff use the functions (no lost or doubled stock change)

## Before you start (5 minutes)

1. Make sure nobody is using the dashboard (stock actions especially).
2. Have the rollback file open in a second tab: `docs/ops/sql/drafts/11_DRAFT_rollback_stock_functions.sql`.

## Install (Supabase → SQL Editor)

1. Open Supabase → your Health Endeavors project → **SQL Editor** → **New query**.
2. Paste the **whole** of `10_DRAFT_stock_functions.sql` (from `-- ===` at the top to `commit;` at the bottom).
3. Click **Run**.
4. Expected result: "Success. No rows returned". A few "does not exist, skipping" notices are normal (they're about older draft versions that were never installed).
5. If you see a red **ERROR**: stop. Nothing was installed, because the file is one transaction. Copy the exact error text into the chat. An error starting "Install stopped, nothing was changed. This database is missing: …" comes from the preflight: the database is not shaped the way Query A reported, and the session needs to adjust the file first.

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

**Fingerprint check (proves the installed code is exactly the reviewed code).** New query, paste and run:

```sql
select md5(string_agg(p.proname || ':' || pg_get_function_identity_arguments(p.oid) || ':' || md5(p.prosrc), ',' order by p.proname)) as fingerprint
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('_he_apply_stock_change','adjust_inventory','receive_purchase_order',
                    'quarantine_recall','receive_return','delete_unused_product');
```

Expected for the version reviewed on 2026-10-06: `3df2bf7a07b451f12f9359ceca1c85df`. If the file changes later, the session recomputes this value locally and updates it here in the same pull request. A different value means a different version was pasted: roll back and ask.

## Roll back (if anything looks wrong)

1. **First**, if the dashboard has already been switched to the functions, revert that dashboard PR (otherwise its buttons would call missing functions).
2. SQL Editor → New query → paste the whole of `11_DRAFT_rollback_stock_functions.sql` → **Run**. It removes only these functions, in one transaction. No table and no data is touched.
3. Re-run the check above: expected 0 rows.

## After install

- **Optional second step, also needs your approval (EXT4):** `drafts/17_DRAFT_po_line_delete_guard.sql` stops a purchase-order line being removed, added or re-quantified while (or after) that order is being received (EXT5: now covers all three). The local tests showed each of those races leaving the order and the stock disagreeing, even with R1 (`PO_RECEIVE_RACE_REVIEW.md`). It adds one small check (a trigger) and changes no data. Install it after R1. Roll it back with `drafts/18_DRAFT_rollback_po_line_delete_guard.sql`.

- A separate dashboard PR switches the stock buttons to the functions. It gets reviewed, merged and checked live like any other.
- Later, and only with your approval: remove direct table write access on the stock tables (backlog INV-20), so the functions become the only path.
