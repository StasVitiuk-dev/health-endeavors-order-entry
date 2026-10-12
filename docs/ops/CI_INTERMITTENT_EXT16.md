# CI and intermittent failures (EXT16)

Status: **CURRENT on the feature branch only.** The machine-readable register is `tests/forensics/intermittent-register.json` (never delete an entry; nothing is marked FIXED without a reproduced cause).

## 1. In plain English

"Intermittent" means a test that sometimes fails for no obvious reason. The rule here: never just re-run until green. Each one is recorded, investigated, and closed only when its cause is reproduced and fixed. After the EXT16 head's GitHub run: INT-1, INT-2 and INT-5 are fixed; INT-4 (a real draft-database lock cycle) is explained and reproduced on demand but not fixed yet (EXT17); INT-3 stays open and unexplained.

## 2. Register

| ID | Test | First seen | Classification | Status |
|---|---|---|---|---|
| INT-1 | DB stress S21 (200 operators) | GitHub DB job, `2d90113` | HARNESS | **FIXED** (EXT15): refused connections were silently dropped; reproduced with a 30-connection limit |
| INT-2 | offline bar must not cover the menu (desktop) | GitHub shard 2, `079f378` | HARNESS | **FIXED** (EXT16), see §3 |
| INT-3 | one replay inside the chaos shrinker self-test | local | UNEXPLAINED | **OPEN INTERMITTENT**: one `networkidle` wait did not settle in 30 s; not seen in any full chaos run |
| INT-4 | DB stress S29 "no deadlock" (delete product vs delivery) | GitHub DB job, `0722ae6` (run 3 of 5: 8 deadlocks) | PRODUCT (draft SQL, not installed) | **EXPLAINED, NOT FIXED**, see §4 |
| INT-5 | mutation runner: Ctrl-C during a mutant | GitHub shard 3, `0722ae6` | HARNESS | **FIXED** (EXT16), see §5 |

## 3. INT-2 forensics (the EXT15 open item)

Probe: `tests/forensics/offline-bar.probe.spec.js` (not part of `npm test`; run with `npx playwright test -c tests/forensics/probe.config.js`). At the first instant after going offline it records what is under the centre of each header button, the geometry, viewport, running animations and timing.

| Variant (25 repeats × desktop + phone) | Covered at the first instant |
|---|---|
| plain (resize 1100 → 760, no wait) | 25 / 50 |
| resize from 1280 first | 22 / 50 |
| stylesheet delayed 400 ms | 17 / 50 |
| plain, CPU load (4 busy cores) + 4 workers | 3 / 50 |
| **after waiting for running animations** | **0 / 50** |
| **after waiting for running animations, CPU load + 4 workers** | **0 / 50** |

Every covered case was on **desktop**, and the cover was the **sidebar** (its search box), never the offline bar. Cause: crossing the 820 px breakpoint makes the sidebar slide away (`transform .22s`); a check inside the slide sees the sidebar over the menu button. Not a product bug (the drawer is meant to slide away when the window narrows). Fix: the test waits for running animations after the resize, then checks strictly at the first instant (EXT15's 5-second re-check removed). The mutant "offline bar covers the header" is still caught.

## 4. INT-4: a real lock cycle in a draft database function

**What failed:** stress scenario S29 races "delete this product" against "add a delivery line for it, then receive the order" (10 of each). In one of five runs on GitHub, PostgreSQL reported 8 deadlocks. The consistency check in the same scenario passed: no data was damaged.

**Cause (reproduced on demand):** the draft function `delete_unused_product` (drafts/10, R5) checks "is this product used anywhere?" *before* it locks the product. A delivery line saved in that instant is missed. Then:

1. the receive locks the order and its line, and waits for the product;
2. the delete holds the product, and its foreign-key check waits for the line.

Each waits for the other. PostgreSQL cancels one call, which is rolled back. `docs/ops/sql/local-test/s29_lock_cycle_repro.sh` forces this order step by step and prints `RESULT: DEADLOCK` every time (local throwaway database only). The server log confirms it: the receive waits for the product (`for key share`), and the delete waits for the receive's transaction.

**Who could see it:** only someone deleting a product at the same moment another person adds it to an order and receives that order. They would see a plain error, and nothing would be half-saved. The function is a draft and is not installed in production.

**Fix (EXT17, not applied here):** repeat the "in use?" checks right after locking the product. Once the product is locked no new line can point at it, and any line saved just before is visible to the second check. On a throwaway database the reproduction then runs 3 of 3 without a deadlock (the delete answers "in use", the receive succeeds). It is not applied in EXT16 because it changes the reviewed R1–R5 fingerprint used in about 25 files, including read-only Query H, and needs its own review. Until then S29 can fail rarely on GitHub; it is recorded, never retried until green.

**Found alongside it:** receiving a purchase order with **no lines** fails in the same draft (`receive_purchase_order`) with a raw "division by zero" error. Nothing is changed, but the message is wrong. Also EXT17.

## 5. INT-5: a stale planted bug, not a timing problem

The Ctrl-C test interrupts one named mutant. EXT16 replaced that mutant's text (the PO receive state machine), so the mutant no longer applied, its worktree existed for only milliseconds, and the test's wait for it ran out. A new `--check` mode of the mutation runner then found **17 of 187 mutants no longer applicable**:

- 14 manual-order mutants, after EXT16 moved that page's script into `assets/manual-order-entry.js`;
- 2 PO receive mutants;
- 1 agents mutant, stale since EXT15.

Nothing failed loudly because only subsets of mutants had been run. Fix: the mutants were retargeted (all 18 matching mutants CAUGHT on a real run). A test now checks that every mutant's text is in its file exactly once, and the order pages' `?v=` fingerprints are refreshed inside mutant worktrees.

## 6. CI changes in EXT16

None to the workflow file. Pins, shards and the jobs are as in `CI_GUIDE_EXT15.md`. GitHub CI results for the EXT16 head are in `RELEASE_REVIEW_EXT16.md`.
