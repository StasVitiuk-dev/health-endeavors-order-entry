# Database reliability (EXT17)

Status: **SQL drafts TESTED LOCALLY, NOT INSTALLED.** Nothing here ran against production. Throwaway PostgreSQL 16 only.

## 1. In plain English

Three things were wrong in the draft stock functions (drafts/10, "R1–R5"). All three are fixed, and each is now checked by an automatic test:

1. **"Delete product" could deadlock with a delivery being received at the same moment** (INT-4, seen once on GitHub). The database cancelled one of the two calls; no data was damaged.
2. **Receiving an order with no lines failed with "division by zero".**
3. **Going below zero in Damaged, Sample and the other buckets gave a raw database rule error** instead of the plain "that would leave … at -3" message. The plain message never appeared with the real table rules.

A new **inventory property model** found the third one on its first run: random operator sequences, each result compared with an independent model.

## 2. The fixes

| # | Problem | Cause | Fix | Proof |
|---|---|---|---|---|
| 1 | INT-4 deadlock | `delete_unused_product` checked "in use?" before locking the product; a line saved in that instant was missed, and its foreign-key check then waited for a receive that was waiting for the product | repeat the in-use checks right after the product lock | `local-test/s29_lock_cycle_repro.sh`: fixed 5/5 no deadlock, old 2/2 deadlock; now a DB-suite step |
| 2 | empty order | the landed-cost formula divided by the line count; the error only appears when PostgreSQL plans with the actual values (the first calls in a session) | `nullif(v_line_count, 0)`: nothing stocked, shipping recorded as the expense (as on the page) | test 16 forces the revealing plan mode; old draft fails, fixed passes |
| 3 | raw rule error below zero | every bucket column has a `>= 0` rule, so the update failed before the friendly check after it could run (dead code) | refuse below zero before the update (the "changed since the page loaded" check keeps precedence) | property model: old draft disagrees on the first seeds, fixed agrees on 1,800 operations; SQL mutant caught |

The reviewed fingerprint is now **`f6d9c2c8be690710eeb721041f6779d9`** (was `3df2bf7a07b451f12f9359ceca1c85df`). It is updated in the runbook, Query H, MANIFEST, the deploy simulator, the check cards and the test fixtures. Historical reports keep the old value as history.

## 3. Inventory property model (`tests/db/inventory-model.js`)

- Each seed is a random sequence of 60 operator actions: adjustments, deliveries with and without lots, receiving an order twice, recalls, quarantining twice, deleting products. The sequence runs through the real functions.
- After **every** call, each product's buckets are compared with an independent reference model, written from the rules, not from the SQL. At the end, all data-integrity rules (`invariants.sql`) must hold.
- A failing sequence is shrunk to the smallest one that still fails, replayed on a fresh database each time.
- **Self-test:** a deliberately wrong rule planted in the model must be found and shrunk to at most 6 operations. Measured: 3. This is a DB-suite step, so a harness that cannot fail cannot pass.
- It is also a detector in the SQL mutation runner, which loads each mutated draft.
- While it was built, the model itself had a bug: a delivery for a deleted product was counted. It was found by shrinking: all 13 disagreements had the same 3-step shape. Fixed before use.

## 4. Lock order (canonical)

Product (key share or update) → order (PO) → its lines → lot → stock row → history. `receive_purchase_order`, `quarantine_recall`, `_he_apply_stock_change` and now `delete_unused_product` follow it. The delete's foreign-key check can no longer meet a line it did not see, because it re-checks under the product lock.

## 5. Results (local)

| Check | Result |
|---|---|
| Full DB suite (CI-like cluster, default connection limit) | all steps PASS after the fixes (first run: install package failed on a runbook wording I changed, fixed) |
| Stress 5 runs × 98 checks | PASS, 0 deadlocks |
| S29 forced interleaving | no deadlock (both calls verified complete) |
| Inventory model | 30 seeds × 60 = 1,800 operations, 0 disagreements; self-test OK |
| SQL mutants | 15/15 caught (new: "below zero refused only after the update") |
| Install package | 61/61 |

## 6. Test-evidence problems found and fixed

- The S29 reproducer printed "no deadlock" when the database was not running at all. It now reports INCONCLUSIVE (exit 2) unless both calls returned results.
