# Mutation testing report

**Status:** CURRENT (2026-10-06, extension 3). A mutation test breaks **one** safety rule on purpose, in a throwaway copy, and checks that the tests then fail. If they still pass, the tests are not really protecting that rule. Mutations are never committed: only the harnesses are.

| Harness | What it breaks | Result |
|---|---|---|
| `tests/mutation/run-page-mutations.js` | Page and helper safety rules, one at a time, in a scratch git worktree; runs the tests aimed at each | **31 of 31 caught** |
| `tests/mutation/run-sql-mutations.sh` | Rules inside the R1–R5 draft, one at a time, installed into a throwaway copy of the local real-shape database; runs SQL tests 15 and 16 (and the install package tests for the preflight) | **8 of 8 caught** |

Both harnesses exit with an error if any mutation is missed **or cannot be applied** (for example, when the code it targets has moved). Before this rule, two page entries had gone stale silently.

## What the runs found (and what was fixed)

- **SQL: 3 rules were not tested** (first run 5 of 8; X3-24):
  1. The below-zero refusal: the database's own `>= 0` rules hid it for most buckets, but **Recalled** has no such rule.
  2. Skipping lines already fully received.
  3. Refusing to receive a return that was never approved.

  All three now have tests in `16_…`; the second run caught 8 of 8.
- **Page: 2 harness entries had gone stale:**
  1. The escaping mutation, after the SE-09 change to `esc()`.
  2. The refund-cap mutation, whose test filter matched no test.

  Both fixed; 31 of 31.

## Rules covered

**Page:**
- stale guards: the generic helper, return decisions, task buttons, purchase-order buttons, the product edit form, order restore, business rules
- silent refusals; paging (Accounting / Tax / Expenses / Returns)
- permission pre-checks (stock actions, threshold)
- second-press confirmations; refund cap
- upload cleanup and dropped-reply handling; safe file names
- HTML escaping; CSV formula guard; typed-number checks
- dropped-connection wording; signed-out-elsewhere handling
- manual order retry (no second order, no doubled items)
- sold-product delete; search Enter
- Emergency follow-ups and the column fallback; document categories

**SQL (R1–R5 draft):**
- owner/admin check; below-zero refusal; unknown bucket
- receive once; skip fully received lines
- return restock only from approved; sold-product delete
- install preflight

**Not covered by mutation (by design):** lock ordering. A wrong lock order only shows up as an occasional deadlock under load, so it is covered by the stress test (S4, S8, S15, S20, S25: 0 deadlocks in 10 runs; a control run with the old order deadlocked in 2 of 3 runs).

## How to run

```bash
node tests/mutation/run-page-mutations.js            # about 20 minutes
tests/mutation/run-sql-mutations.sh -h <socket> -p <port> -U postgres   # local PostgreSQL only
```

## Extension 7 (2026-10-07)

Page mutations: **82 / 82 caught** on the frozen EXT7 code (`1bbaa3f`). New: open-items caps (3), Reopen from cancelled, Reopen without the still-done condition, Business Health blanking, unsaved typing (3), unknown service status, SOP re-read, supplier same-name, user switch (3), figure effect changes the number, thousands commas. Two EXT3/EXT6 sign-out mutants retargeted to the rewritten handlers. SQL mutations: 13 / 13 caught.
