# R1–R5: all-or-nothing stock functions — design (DRAFT)

> **EXT9 note (2026-10-10):** §4 "one dashboard PR per function, after the SQL is live" is **SUPERSEDED BY EXT9**: the dashboard side is built behind per-button switches (off by default), see `CURRENT_PLATFORM_STATE_EXT9.md` §4.

**Status:** design and SQL drafts only. Nothing has been run on Supabase. SQL: `docs/ops/sql/drafts/10_DRAFT_stock_functions.sql` (functions), `11_…rollback.sql`, `12_…tests.sql`. Written against a **guessed** schema. It must be reconciled with the owner's read-only Query A output before it becomes a real migration.

**Builds on:** PR #16 (inventory safety audit and atomic plan) and the owner decisions of 2026-09-29: a read-only schema check first; "already received" changes nothing; no partial deliveries.

## 1. The problem in one paragraph

Every stock-changing button does several separate requests from the browser: read the number, add in the browser, write it back, write history, change status. A dropped connection leaves half the work saved. A retry repeats the saved half. Two people or tabs overwrite each other. A below-zero check uses a stale number. PR #16 reproduced all of this with synthetic data.

## 2. The design

**One database function per button.** Postgres runs a function as one transaction, so every write happens or none do. Inside each function:

1. **Lock the source row** (`select … for update`): the purchase order, recall, return or stock row. A second call waits for the first to finish, then sees its result.
2. **Check the status, for idempotency.** Already received, quarantined or returned → return `{already_…: true}` and change nothing. This makes "saved, but the reply was lost" safe to retry.
3. **Do the arithmetic in the database** (`bucket = bucket + n`) through one shared helper, `_he_apply_stock_change`. The helper:
   - accepts only the eight known buckets
   - refuses zero changes
   - locks the stock row
   - refuses a result below zero (the whole call is rolled back)
   - writes the `inventory_adjustments` history row in the same transaction, so stock and history can never disagree
4. **Read quantities from the database, not the page.** Return quantity and SKU come from `order_items`. PO lines come from `purchase_order_items`.
5. **Return a small JSON result** that the dashboard turns into the toast message.

**Security:**
- `SECURITY INVOKER`: the functions run with the logged-in person's own rights. Row-level security and the existing audit triggers apply exactly as they do to today's direct writes. No service key, no elevated rights.
- `search_path` is pinned.
- `EXECUTE` is granted to `authenticated` only; `anon` and `PUBLIC` are revoked.

**Lock order:** receive processes lines in **product order**. Without this, two receives touching the same products in opposite orders deadlock. That was proven locally: 3–11 of 20 overlapping receives failed with the original order, and 0 fail with product order.

## 3. Functions

| Fixes | Function | Inputs | Output | Idempotency / refusals |
|---|---|---|---|---|
| R1 | `receive_purchase_order(p_po_id uuid, p_lots jsonb default '[]', p_expense_date date default null)` | `p_lots = [{"line_id", "lot_number"}]`; `p_expense_date` = the business date shown in the browser | `{already_received, po_number, stocked, skipped, expense_id, expense_total}` | `received` → `already_received: true`, no change. Not `ordered`/`shipped` → error 55000. Lot over 100 characters → 22001. Missing PO → P0002. |
| R4 | `adjust_inventory(p_product_id uuid, p_bucket text, p_change int, p_reason text)` | as the form today | `{product_id, bucket, change, new_value}` | Below zero → 23514 with today's wording. Unknown bucket or zero → 22023. Missing product → P0002. |
| R2 | `quarantine_recall(p_recall_id uuid)` | recall id | `{already_done, quantity_quarantined}` | Not `initiated` → `already_done`. Nothing in Available → 55000 with today's wording. The lot's `quantity_remaining` is unchanged (by design). |
| R3 (needs N13 fixed too) | `receive_return(p_return_id uuid, p_disposition text, p_quantity int default null)` | disposition; optional returned quantity | `{already_done, restocked, quantity, note, sku}` | Not `approved` → `already_done`. Already received once (`received_at` set) → `already_done`, `reason: received_before` (guards N13). Quantity outside 1…line quantity → 22023. Unknown SKU → marked received, `note = no_product_with_sku` (today's behaviour). |
| R5 | `delete_unused_product(p_product_id uuid)` | product id | `{deleted, reason}` (`has_stock`, `in_use`, `not_found`) | Product with stock → refused. In use (foreign key) → refused, **and the stock row is kept** (it is rolled back with the failed delete). |

**R1 behaviour kept exactly as today:**
- the landed-cost formula (including the $0-lines edge case), rounded to 4 decimals
- the expense amount (lines + shipping + tax)
- the expense note `Purchase order <number>`
- the history reason `Delivery received (<number>)`
- every line marked fully received (no partial deliveries)

**R1 behaviour changed deliberately:**
- Lot numbers now match exactly (case-insensitive). The page's `ilike` treated `_` and `%` as wildcards, so `A_1` could match an existing lot `AB1`.
- The lot's counts are updated with database arithmetic (no lost update).
- The expense date is the business date, not the UTC date. See decision D-ops-3.

## 4. Dashboard side (one small PR per function, after the SQL is live)

- Replace each button's chain of requests with `supabase.rpc('<function>', {...})`.
- On **any** error, reload the data instead of re-enabling a button that holds stale data.
- Show `already_…` results as information ("Already received — nothing changed"), not as errors.
- Add each function to the test mock, and flip PR #16's `test.fail()` "wanted behaviour" tests to normal tests.
- **Rollback:** revert the dashboard PR. The old code path still works because no table changes. Only then, if wanted, run `11_DRAFT_rollback_stock_functions.sql`.

## 5. Tests (local PostgreSQL 16, synthetic data, guessed schema)

**`12_DRAFT_tests_stock_functions.sql`** runs inside `BEGIN … ROLLBACK` as `authenticated`, and checks:
- receive totals, landed cost, expense count, amount and date
- the wildcard lot fix
- idempotent retry
- a cancelled order is refused
- a failing receive leaves nothing behind
- below-zero refusal; unknown bucket and zero changes refused
- recall amount, idempotency, and that the lot's remaining count is unchanged
- return quantity bounds, restock, idempotency, unknown SKU
- delete: refused with stock, refused in use without losing stock, succeeds when unused

**Result:** passed, 5 of 5 runs.

**`local-test/concurrency_test.sh`** uses real parallel database sessions and checks:
- 50 simultaneous adjustments, none lost
- a below-zero race with 12 at once on 5 units: exactly 5 succeed and stock ends at 0
- 12 simultaneous receives of one PO: stock added once, one expense
- 10 simultaneous recalls and 10 simultaneous returns: applied once
- no negative bucket, and the history adds up
- 20 overlapping receives without deadlock

**Result:** all PASS, 3 of 3 runs.

## 6. What must happen before this is real

1. **Owner runs Query A and Query B** (`docs/ops/sql/00_…`, `01_…`) and sends the output.
2. Claude reconciles the drafts with the real columns, statuses, constraints, triggers and policies. Specific things to confirm:
   - the bucket column names
   - the PO, recall and return status values
   - whether `inventory` has a unique key on `product_id`
   - what audit triggers exist
   - whether RLS allows these writes for each role
   - whether any agent writes `inventory` directly
3. Claude publishes the reconciled SQL as a reviewed PR (files only).
4. The owner runs the SQL in Supabase. The functions sit unused, so nothing changes for anyone yet.
5. One dashboard PR per function, merged one at a time with a live check after each.
6. **Optional, once the data is clean** (Query B shows no negatives): add `CHECK (bucket >= 0)` constraints as a safety net, and a read-only look for past damage (duplicate PO expenses, which Query B already counts).

## 7. Decisions needed from the owner

| ID | Decision | Recommendation |
|---|---|---|
| D-ops-1 | Rollout order R1 → R4 → R2 → R3 → R5 | Yes. R1 has money impact; R4 is the most frequent; R2 is compliance. |
| D-ops-2 | R5: database function vs a quick dashboard-only stop-gap | The function: it is the only version that can't lose the stock row. |
| D-ops-3 | Expense date for a received PO: today it is the UTC date (wrong in US evenings) | Use the business date the browser shows (Central time); the function accepts it. |
| D-ops-4 | Should a second active recall on the same lot be refused? | Yes (one active recall per lot). Needs a status check, or a partial unique index after Query A. |
| D-ops-5 | Returns: allow "units actually returned" (partial-line returns)? Today the whole line is restocked. | Yes: an optional quantity field that defaults to the whole line. |
| D-ops-6 | Do any agents or automations write `inventory` directly? | Owner to confirm. If yes, move them onto the same function. |

## 8. Reconciled with the real schema (Query A, 2026-10-05)

The owner's read-only Query A confirmed most assumptions. These changes were made in `10_DRAFT_stock_functions.sql`:

| Assumption in the first draft | Reality (Query A) | Change |
|---|---|---|
| Anyone logged in may change stock (RLS decides) | Stock, lots, purchasing and recalls are **Owner/Administrator only**; returns are open to all staff | Every stock change checks `public.is_owner_or_admin()` first (42501, clear message). `receive_return` checks before anything is locked or written, so a refused restock never leaves a return "received". `discard` stays open to staff. |
| Purchase orders are never deleted | `purchase_orders.deleted_at` exists | A deleted order is refused (55000) |
| Quantities are whole numbers | PO quantities and lot counts are `numeric`; stock buckets are `integer` | A fractional catalogue line or lot count is refused (22023) before anything changes, instead of rounding silently. Non-catalogue lines (freight) may be fractional. |
| SKU match is exact | Unique index on `lower(sku)` | Return restock matches `lower(sku) = lower(…)` |
| Disposition is free text | CHECK: `restock_available`, `restock_damaged`, `discard` | Validated up front (22023) |
| Lock order only mattered between receives | The history row's foreign key share-locks the product, so a product delete racing a stock change could deadlock | The helper locks the product (`FOR KEY SHARE`) before the stock row; `delete_unused_product` uses the same order |

**Confirmed and unchanged:**
- the bucket names and the `inventory` unique key on `product_id`
- the column lists for history, lots, expenses and returns
- the status values
- expense categories = PO categories
- every one of these tables has an audit trigger recording `auth.uid()`
- the stock-row and history foreign keys still make `delete_unused_product` refuse a product that is in use

**Tests on a local copy of the real table shapes:**
- `drafts/15_DRAFT_tests_stock_functions_real_shape.sql`: all pass
- **mutation check:** removing any one of the deleted-order, whole-unit, case-insensitive SKU, fractional-lot or disposition checks makes a test fail
- `local-test/stress_test.sh`, real shape: 30 runs, 0 failed checks, 0 deadlocks
- deadlock control (old lock order): 19 and 26 deadlocks out of 30, so the check works

**Still needed before this becomes production SQL:** see section 9.

## 9. Hardening round (2026-10-06)

Query B ran clean; no existing data repair is required before installing these functions.

| Problem found by re-reading / stress testing | Change in `10_DRAFT_stock_functions.sql` | Proof |
|---|---|---|
| Quarantine locked the lot and stock row **before** the product; a product delete at the same moment could deadlock | Product locked (`FOR KEY SHARE`) first, then lot, then stock row | Stress S15 (30 quarantine + 30 delete pairs at once): 0 deadlocks; control with the old order: deadlocks in 2 of 3 runs, each cancelling a quarantine or receive |
| Receive could lock a lot before the product (same cycle) | Product locked at the start of each line | S15 (30 receive + 30 delete pairs) |
| Delete held the product while its foreign-key check waited on a delivery being received (a lock cycle) | `delete_unused_product` first checks, without locking, whether anything refers to the product (all references are plain foreign keys, so such a product can never be deleted anyway) | S15 |
| Two deliveries bringing the same **new** lot at the same moment: the second failed on the unique index | One `INSERT … ON CONFLICT (product_id, lower(lot_number)) DO UPDATE` adds them up | Stress S14 (10 at once, mixed case): one lot row of 30, 0 duplicate-key errors; file 16 sequential check |
| A manual adjustment resent after a lost reply, or saved from a stale tab, applied twice / overwrote | Optional `p_expected` (the value the page showed): refused with hint `stale_value` if the bucket changed | S10 (60 stale-checked saves at once: exactly 1 applied), S16 (two stale tabs), file 16 |
| `delete_unused_product` run by an employee: row-level security made the delete affect nothing, yet it returned `deleted: true` | Owner/Administrator check up front; a delete that removed nothing raises 42501 | file 16 (and the mutation test catches its removal) |
| Stock check used the sum of buckets; `recalled` has no ≥ 0 rule, so +5 / −5 summed to "no stock" | Any non-zero bucket counts as stock | file 16 (mutation caught) |
| Rollback script didn't list the new signatures | `11_DRAFT_rollback…` drops the new and old signatures in one transaction | installed → rolled back → re-installed locally |

**All-or-nothing proof (`drafts/16_DRAFT_tests_hardening_and_failures.sql`):** a test-only trigger makes one write fail part-way, and a fingerprint of every business table is compared before and after. Covered:
- R1 receive, a failure at each of 7 writes: line update, lot insert, stock update, history insert, audit row, expense insert, order update. Plus a permission refusal part-way (simulated row-level-security refusal on the expense).
- R2, R3 and R4, a failure at each of their writes (stock, history, audit, recall/return update).

Every case left the database byte-for-byte unchanged, and each order or return still went through cleanly on retry. Malformed inputs (zero, negative, decimal 2.5, unknown or injection-looking bucket, unknown or null IDs, lots not a list, 101-character lot, number as lot) are all refused with nothing changed.

**Mutation check:** removing the expected-value check, the delete permission check or the any-bucket stock check, or swallowing an expense failure, each makes file 16 fail. Removing the quarantine product lock is invisible to sequential tests and caught only by stress S15 (control above).

**Stress (`local-test/stress_test.sh`, 19 scenarios, 46 checks per run):** results in `docs/ops/stress-test-results.md`.

**Still needed before this becomes production SQL:**
1. Query C results (whether any agent, trigger, scheduled job or other function writes stock directly; such a path would bypass these checks)
2. A dashboard change to call these functions instead of writing tables directly (separate PR, after the functions are installed)
3. Owner review and approval; installation is a production change the owner runs
