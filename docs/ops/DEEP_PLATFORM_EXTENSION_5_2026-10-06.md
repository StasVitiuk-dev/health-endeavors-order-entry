# Deep platform readiness, extension 5 (2026-10-06)

## 1. Starting point, verified before any change

| Check | Result |
|---|---|
| Working tree | clean |
| Branch / SHA | `claude/platform-deep-readiness-extension-4` at `82c2582`; the remote matched |
| Earlier branches | extension 3 `3d5f1cc`, overnight implementation `37050c6`, CI copy `claude/tests-only-ci-v2` `33395f9`: unchanged |
| `main` | `d3db7bc`, unchanged |
| Open PRs | all 20 PR heads unchanged (same SHAs as recorded in `pr-merge-order.md`) |
| Unexpected commits | none: all 19 extension-4 commits carry this session's trailer; no stray git identity; no extra worktrees |
| Previous test counts | confirmed from the saved logs (1,173 passed full; 1,185 ×3; 47/47 page mutations) |
| Production touched? | no evidence of any production access (the test mock blocks every outside host; the safety specs passed) |

**Discrepancies:** none. (Some files showed as "changed on disk" because the last session edited them with scripts; the clean tree confirms they match what was committed.)

- **New branch:** `claude/platform-deep-readiness-extension-5`, created from `82c2582`. Extension 4's history is not rewritten.
- **Ending SHA:** the last commit on the branch (given in the chat summary).
- **Not merged, not deployed, no PR opened.**

## 2. Plain-English summary

This round attacked the places where real life is messiest: two people at once, slow or lost connections, and pages left open for a long time. **12 real bugs were found and fixed on the branch**, each with tests that fail on the old code. One more needs a small database change only you can approve.

Most important:

- **Receiving a delivery used the page's old copy of the order.**
  - Open a purchase order, let someone else remove a line or change the shipping, then press Receive: the removed line was stocked and charged, and the old shipping was used.
  - Now the saved order is received, and the page says it had changed.
  - A change landing *during* the receive is reported to both people, never shown as a clean success.
  - **This bug is live on `main` today.**
- **Money totals could count an order twice.**
  - Accounting, Tax Records and the dashboard tiles read orders in pages. An order created between two pages shifted the pages, so one order was counted twice and another missed, with no error.
  - Totals now read "after the last one seen".
  - **Live on `main`.**
- **Manual orders:**
  - A retry could attach itself to a different order that happened to get the same number (numbers are not unique in the database).
  - An order whose items failed and whose tab was then closed was forgotten.
  - Both fixed: such orders are now listed when you sign in, on any device.
- **Smaller fixes:**
  - Two people editing the same customer reply draft overwrote each other; now the second is told and keeps their text.
  - The activity export could list the same change twice.
  - "$12.50" typed into a number box said "is empty"; it now says to type plain digits.
  - The low-stock alert level could be silently undone from a second tab.
  - The manual-order page no longer keeps the customer's name and e-mail in the browser.
- **Database drafts (not installed):**
  - The PO line guard now also stops a line being **added** or **re-quantified** during a receive. Locally each of those broke the order-vs-stock match 5–6 times in 20 races, even with R1.
  - The install no longer shows a frightening error if Run is pressed twice.

## 3. Commits (oldest first)

| SHA | What |
|---|---|
| `2e1bda4` | PO receive vs line changes: receive the saved order, report in-flight edits; guard extended |
| `b4fcbf1` | Manual orders: retry never adopts a same-number order; orders without items listed on sign-in |
| `b9cb86c` | Install package: adversarial tests (61 checks); a double Run waits instead of failing |
| `e3c32fb` | Runbook note |
| `2aa78b5` | Failure matrix 14 × 14; inquiry draft no longer overwritten |
| `55c0cd3` | State machines from one fixture; idempotency and retry policy |
| `d15fb48` | Unreadable number text gets a clear message |
| `d27c9ed` | Palette edge tests |
| `feff19b` | Money totals and activity lists: no double counting mid-read |
| `3fd1cb8` | Manual order: no customer details in browser storage |
| `86447d0`, `1609a07` | Mutation harness: 57 page mutations |
| `5f99649`, `d2496a2` | Readiness gate, owner decisions, backlog, Query D check, status docs |
| `fc653db` | Low-stock alert level guarded |
| `f1e8d4e` | Totals paging stops at a short page (URL-length fix); test helper re-clicks a lost click |
| `5900eeb` | Owner reporting preference recorded in the current-state doc |
| `ce9152b` | This report (evidence pending) |
| `3feeb2d`, `6161964` | Test helper: wait 5 s before a re-click; always make the first click (closes the phone menu) |
| `314eb9c` | Test: wait for the expense before reading it |
| (final) | This report, final evidence |

Files changed: about 47 (pages, helpers, tests, SQL drafts and local tests, docs).

## 4. Bugs found and fixed (12 on the branch, 1 drafted)

| ID | P | Bug | Live on `main`? | Status |
|---|---|---|---|---|
| X5-01 | P1 | Receive used the page's old lines, shipping and tax | yes | fixed |
| X5-02 | P1 | A line change during a receive showed a clean success; the editor was not warned | yes | fixed (reported on both sides) |
| X5-09 | P1 | Money totals double-counted a record created mid-read | yes | fixed (keyset paging + repeated-id skip) |
| X5-04 | P1 | Manual-order retry could adopt a same-number order | partly (EXT4 code) | fixed |
| X5-05 | P2 | Order saved without items forgotten after closing the tab | yes | fixed (listed on sign-in) |
| X5-08 | P2 | Inquiry reply drafts overwrote each other | yes | fixed |
| X5-10 | P2 | Activity "Load more" / export repeated rows | yes | fixed |
| X5-06 | P2 | Install double Run: catalog duplicate-key error | draft only | fixed in the drafts |
| X5-12 | P3 | Unreadable number text said "is empty" | yes | fixed |
| X5-13 | P3 | Customer name / e-mail kept in browser storage (manual order attempt) | EXT4 code | fixed (hash only) |
| X5-16 | P3 | Low-stock alert level last-write-wins | yes | fixed |
| (URL) | P2 | Keyset paging's extra request made a long id list exceed URL limits (caught by the suite during this extension) | no (found before merge) | fixed |
| X5-03 | P1 | PO line add / quantity change during a receive (database level, even with R1) | — | **draft guard extended; needs approval** |

## 5. Tests added

New or extended spec files:
- **`po-receive`:** +7 (stale tab, in-flight change, final re-check)
- **`purchase-orders`:** +2 (editor warning)
- **`manual-order-entry`:** +16
- **`fault-injection` / `fault-injection-2`:** +5 actions and +3 failure kinds, which takes the matrix to 210 cases (`fault-workflows` fixture)
- **`guarded-toggles`:** +3 (inquiry drafts)
- **`state-machine`:** +6 (fixture checks)
- **`numeric-contract`:** +3
- **`search-palette`:** +2
- **`activity-page`:** +2
- **`report-totals`:** +1
- **`pages-data`:** +2
- **`sql-readonly`:** +1 (Query D)

Database:
- `install_package_test.sh`: 42 → 61 checks
- `po_race_interleavings.sh`: new, 12 forced orderings
- `stress_test.sh` S27: 3 races and guard checks (98 checks per run)
- `run-sql-mutations.sh`: 11 mutations

Exact totals: see section 6.

## 6. Final evidence

All runs below are on this machine. The mock blocks every outside host, so no test reached production.

| Check | Result |
|---|---|
| **Full suite** (desktop 1100 px + iPhone 390 px), final run on `6161964` | **1,990 tests: 1,329 passed, 1 failed, 660 skipped by design**, 25.7 min. The single failure was a timing mistake in a new EXT5 test (see "Verification history" below), fixed in `314eb9c` |
| **High-risk specs ×3** (17 specs: fault injection ×2, state transitions ×2, manual order, session failures and expiry, PO receive, purchase orders, report totals, activity, guarded toggles, role matrix, storage, safety, write-path inventory, admin pages) | **3,054 runs: 1,884 passed, 3 failed (the same test), 1,167 skipped by design** |
| **After the fix (`314eb9c`)** | that test ×20: **40/40 passed**; the whole `po-receive` spec ×5: **150/150 passed** |
| **Page mutations** (on `314eb9c`) | **57/57 caught** |
| **SQL tests** (14, 15, 16) | all PASSED |
| **Install package** | **61 passed, 0 failed** |
| **PO line race orderings** | with the guard: **0 failures**; without it, "receive first, edit second" fails, as expected |
| **Stress ×3** | **3 × 98 checks passed, 0 failed, 0 deadlocks.** Unguarded S27 races broke the order-vs-stock match: delete 4/6/7, add 5/9/10, quantity 1/3/4 out of 20 per run (the reason for the guard draft) |
| **Query C / Query D mocks** | C: 122 rows; C without pg_cron: 119 rows; D: 10 rows. 0 errors, 0 secrets in any of them |
| **SQL mutations** | **11 caught, 0 missed** |
| **Secret scan** of the branch diff (47 files) | clean: no keys, tokens, real e-mails or model identifiers (only the required commit trailer) |
| **`main`** | `d3db7bc`, unchanged |
| **Extension 4 branch** | `82c2582`, unchanged |
| **New tests** | **+288 test cases** (1,702 → 1,990, counting both screen sizes); **+156 that run** (1,173 → 1,329 passed; the rest are by-design skips). Database: install checks 42 → 61, a new race-ordering script with 12 orderings, stress S27 |
| **Bugs fixed** | **12** dashboard / draft bugs (section 4), plus **3 test-harness defects** found and fixed during verification (below). 1 more bug (X5-03) needs the database guard (owner approval) |

### Verification history (nothing hidden)

1. **First full run** (on `f1e8d4e`): 1 failure, the 10,000-record palette speed test. Cause: the `gotoPage` helper re-click, added that same day, waited only 2 s, which is shorter than a 10,000-row page takes to draw. Fixed in `3feeb2d`.
2. **Second full run** (on `3feeb2d`): 20 failures, all from that fix. It skipped the click when the page was already open, but on a phone that click is what closes the menu, so the open menu covered the next button. Fixed in `6161964` (the first click always happens). The specs that had failed then passed 348/348 over 2 runs.
3. **Third run**: lost to a container restart and run again.
4. **Final run** (on `6161964`): 1 test failed intermittently (4 of 8 runs). Cause: "a line added elsewhere is received too" read the expense before the page had written it (the page writes stock first, then the expense). Test-only; fixed in `314eb9c` and proven over 20 + 5 repeats.

**What this means:** none of the 4 rounds found a dashboard defect. All three causes were in test code written this session. The full suite was not run a fifth time after `314eb9c`, because that commit changes one wait in one test; the affected spec was repeated instead.

## 7. Concurrency and local database results

- **PO line races:**
  - Without the guard: delete 4–7, add 5, quantity change 6 failures in 20 races.
  - With the guard: 0, with no deadlock.
  - Forced orderings: without the guard, "receive first, edit second" fails every time; with it, all agree. Details in `PO_RECEIVE_RACE_REVIEW.md`.
- **Install:** two simultaneous installs both finish cleanly (advisory lock). A wrong function body is caught by the fingerprint and repaired by re-installing. Rollback works over a partial install.
- **Honest limit:** the local database is PostgreSQL 16 on this machine, not Supabase. Lock behaviour is the same in principle, but timings differ.

## 8. Known limitations (not hidden)

- The dashboard can **detect** but not **prevent** a line edit landing during a receive. Prevention is the database guard (needs approval).
- Record-creating writes (25 paths) can still create a duplicate after a lost reply plus a retry. This is mitigated by the one-at-a-time lock and the honest "cannot tell" message; the real fix is request keys (X5-11, production change).
- The stock history row is a second request in the browser path, until R1 is installed.
- The ordering of `employee_activity` at equal timestamps is not visible from the dashboard (X5-15, Query C or owner).
- The inquiry draft check leaves a very short gap between its re-read and the save (the text is too long to send as a database condition).
- Accessibility is checked automatically only; a real VoiceOver / device test is still needed.

## 9. Owner decisions, Query C/D, R1–R5, production blockers

- **Owner decisions:** `OWNER_DECISIONS_NEXT.md` (new at-a-glance table with risk of waiting, launch impact and production action).
- **Query C:** prepared, not run (the owner runs it). **Query D:** prepared, not run, static check added.
- **R1–R5:** drafts, tested locally (SQL tests, 61 install checks, stress, mutations), **not installed**. The function fingerprint is unchanged (`3df2bf7a07b451f12f9359ceca1c85df`).
- **PO line guard:** draft, extended, not installed.
- **Production blockers:** `READINESS_GATE.md`. Every remaining P0/P1 needs Query C, an owner decision or a production change.

## 10. Rollback

- Nothing is merged. To drop this work, ignore or delete `claude/platform-deep-readiness-extension-5`; extension 4 (`82c2582`) is untouched.
- After a future merge: revert the merge commit (the helpers file carries a content hash; API still 6).
- Drafts: `11_…` removes R1–R5 and `18_…` removes the line guard (both tested, both safe to run twice).

## 11. Deliberately NOT done

- No merge, deploy, PR, or production access of any kind.
- Query C and Query D not run; R1–R5 and the guard not installed.
- Request keys (X5-11) not built: that needs a production schema change.
- No large refactor or module split (MD-04 stays queued, low value).
- The public website was not touched.
- Percentages were not changed.

## 12. Safety confirmation

- `main` untouched (`d3db7bc`). No merge, no PR, no force-push, no deployment.
- No production Supabase reads or writes; Query C/D not run; nothing installed; RLS, cron, grants and agents untouched.
- No Shopify changes; **Shopify Order Sync untouched (off)**.
- No customer data, messages, refunds, accounting actions, backups or secrets.
- GitHub settings and protections untouched.
- The Health Endeavors website and Real Estate OS repositories were not touched.
- All database work ran on a throwaway local PostgreSQL with synthetic data.

## 13. Recommended next owner action

1. Do the read-only backup check (`ROLLBACK_AND_BACKUP_REVIEW.md`, 2 minutes).
2. Review and merge this branch. It fixes several bugs live today: stale-tab receive, double-counted totals, and the manual-order issues.
3. Run Query C when convenient, then decide on R1 plus the PO line guard.
