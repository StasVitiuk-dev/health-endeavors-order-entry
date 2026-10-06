# Deep platform readiness, extension 4 (2026-10-06)

**Branch:** `claude/platform-deep-readiness-extension-4`, created from `claude/platform-overnight-extension-3` at **`3d5f1cc`**. That branch and every earlier one are unchanged.

- **Not merged, not deployed, no PR opened.** `main` (`d3db7bc`) and production are untouched.
- **Ending SHA:** the last commit on the branch. This report is part of it, and the final SHA is given in the chat summary.
- **CI copy:** `claude/tests-only-ci-v2`, now `33395f9`. The Playwright job timeout was raised from 40 to 60 minutes. It is still not active.

## 1. Plain-English summary

This round went looking for the ways the dashboard can go wrong when real life is messy: two tabs, a dropped connection, a reply that never comes, an evening in Central time, a sign-in that expires halfway, an emergency. **Fourteen real problems were found and fixed on the branch**, each with a test that fails on the old code. One more needs a small database change that only you can approve. Nothing is live until you merge.

The most important ones:

- **Manual orders could lose or merge an order.**
  - Two tabs saving in the same second adopted each other's order, so one order could disappear into the other.
  - A retry was treated as "the same order" whenever only the total matched, so changed lines could be silently dropped.
  - Both are fixed. The unfinished attempt now also survives a page reload, with a warning.
- **Delivery expenses on the wrong day.** Receiving a purchase order after 7 pm on the 30th logged its expense in the **next month**, in both Accounting and Tax Records. Fixed in the dashboard and in the R1 draft.
- **Emergency mode could leave Shopify Order Sync on.** If saving "Emergency" itself failed (refused, changed in another tab, or connection lost), the page stopped before switching off Order Sync and pausing Agent #7. Those steps now always run in an emergency, and the page says plainly that the mode was not confirmed.
- **Money in whole cents.** A purchase order total could be saved as 0.30000000000000004, and refunds accepted fractions of a cent. Both are fixed.
- **Lists that look complete but aren't.** Some lists read a whole table in one request, and the server silently stops at 1,000 rows. The page now says so when that happens. Totals were already read in full.
- **Plain words for confusing failures.** Gateway error pages showed raw web-page code, and cut-off replies showed raw data. Both now say "we can't tell whether this was saved; reload and check".
- **Keyboard users** can now skip straight to the content, and Tab no longer escapes an open dialog.
- **Found by load testing, not yet fixable without you:** removing a line from a purchase order while that order is being received can leave stock that no line explains. This happened in 2–7 of every 20 tries, even with the R1 function. A small, tested database guard is drafted (`drafts/17_…`) and needs your approval to install after R1.

## 2. Commits (oldest first)

| SHA | What |
|---|---|
| `d4dab3b` | Write-path inventory (98 paths) with a guard gate; procedure form double-submit fixed |
| `734c613` | State machines part 2; stale feature-request advance fixed; restores guarded |
| `84856e8` | Failure injection part 2; manual order hardening |
| `ea5909c` | Session expiry part-way; product delete looks before undoing a lost reply |
| `5a6250c` | Timezone contract; receive expenses and expense ranges use the Central day |
| `8c009ab` | Row-limit notice; numeric field contract; PO total in whole cents |
| `e1c440c` | Stock package: cents, type preflight, PO line guard draft, stress S26–S29 |
| `c07fe71` | Query C owner package; Query D local audit |
| `33d317b` | Skip link and dialog focus trap; palette order; devices; CSV |
| `a4d635b` | Emergency protective switch-offs run even if the mode is not recorded |
| `d195863` | Mock realism gate; mutation expansion; error language |
| `0a3b798` | Owner decisions list; backlog; stress wording |
| `bead3bc` | Current-state and progress docs |
| `65b2bb5` | Leak test; fixes from the full run |
| `f6695cc` | Performance-at-scale tests |
| `ec7ab5d` | Merge re-check |
| `61d5a38` | Owner backup checklist |
| (final) | This report, final numbers |

## 3. Risks ranked, and what happened to each

| # | P | Finding | Status |
|---|---|---|---|
| X4-05 | P1 | Same-second manual orders merged into each other | **Fixed** (branch) |
| X4-04 | P1 | Manual order retry matched on the total only | **Fixed** |
| INV-18 / X4-09 | P1 | Delivery expense dated with the UTC day (wrong month after 7 pm on the last day) | **Fixed** (dashboard and R1 draft) |
| X4-17 | P1 | Emergency switch-offs skipped when the mode was not recorded | **Fixed** |
| X4-15 | P1 | PO line removed while the order is received (2–7 of 20 races, even with R1) | **Draft guard, needs approval** (BLOCKED-PROD) |
| X4-01 | P2 | Stale "Mark in progress" on a feature request could jump it to done | **Fixed** |
| X4-06 | P2 | Reload after an unknown save invited a duplicate order | **Fixed** |
| X4-07 | P2 | Gateway pages / cut-off replies shown raw | **Fixed** |
| X4-08 | P2 | Product delete: a lost reply put a stock row back for a deleted product | **Fixed** |
| X4-10 | P2 | "Last 7 days" missed expenses from 7 days ago after 7 pm; UTC slices | **Fixed** |
| X4-11 | P2 | Whole-table lists silently stop at 1,000 rows | **Fixed** (notice) |
| X4-12 / X4-13 | P2 | Floating-point / sub-cent money saved | **Fixed** |
| X4-16 | P2 | Install preflight did not check column types | **Fixed** (draft) |
| X4-18 | P2 | No skip link; Tab escaped dialogs | **Fixed** |
| X4-02/03/14/19/20 | P3 | Restores unguarded, procedure double submit, add-product limits, palette order, developer wording | **Fixed** |

Full list with evidence: `MASTER_PLATFORM_BACKLOG_2026-10-06.md` (ids X4-…).

## 4. Workstreams (A–AQ) at a glance

| WS | Result | Where |
|---|---|---|
| A write paths | 98 paths found automatically. Every update/delete is checked for a stale-tab condition, read-back and double-click lock, or carries a written reason | `WRITE_PATH_MATRIX.md`, `write-path-inventory.spec.js` |
| B state machines | Approvals, feature requests, legal holds, FDA flag, recalls, expense/feature-request delete and restore, each against every actual state (+ part 1 from extension 3) | `state-transitions-2.spec.js` |
| C failure injection | +6 failure kinds × 9 actions (gateway 502/503, 429, expired sign-in, duplicate, garbled reply) + late reply with a second click | `fault-injection-2.spec.js` |
| D manual orders | Enter repeat, same-total change, reload, same second, taken number, gateway page, one bad line | `manual-order-entry.spec.js` |
| E time zones | DST start/end, leap day, 23:59 vs midnight, month/year end, Berlin viewer, 9 pm receive | `TIMEZONE_CONTRACT.md` |
| F exact totals | Existing 0 … 20,000 matrix + row-limit notice at 0/1/999/1,000/1,001/5,000 | `scale-matrix.spec.js` |
| G–J products, POs, returns, recalls | Concurrency races S26–S29; delete vs delivery; recall never below zero. N4 stays an owner decision | `CONCURRENCY_MATRIX.md` |
| K stock integrity | Ladder up to 200 callers (see the honest limit in `stress-test-results.md`); invariants | `stress_test.sh` |
| L install package | Wrong type, missing table, hostile search_path, owner, reinstall after rollback, runbook fingerprint kept in step | `install_package_test.sh` |
| M/N/AP Query C/D | Owner package (checksum, what not to click, how to stop), checksum test; Query D local audit | `QUERY_C_OWNER_RUN_GUIDE.md`, `QUERY_D_LOCAL_AUDIT.md` |
| O roles | Existing 4-role matrix incl. unknown role; signed out covered by the session specs | `role-matrix.spec.js` |
| P audit | Existing `AUDITABILITY_REVIEW.md` (needs Query C §10) | — |
| Q Emergency | completed / partial / failed / unknown all tested | `admin-pages.spec.js` |
| R session | Expiry between steps of delete and receive, refresh failure after sleep, retry after re-sign-in | `session-expiry-midway.spec.js` |
| S storage | Legal hold vs delete: both options written for you | `OWNER_DECISIONS_NEXT.md` |
| T CSV | Formula starters, money, quotes, line breaks, Unicode, 20,000 rows | `helpers-unit.spec.js` |
| U search | Pages → records → Guide; 10,000 records | `search-palette.spec.js` |
| V accessibility | Skip link, focus trap, headings on every page, table headers | `a11y-basics.spec.js` |
| W devices | +280, 344, 375, 414, 1366, 2560 px | `device-matrix.spec.js` |
| X rules/flags | Covered by the existing guarded-toggle and business-rule tests, plus the numeric contract | — |
| Y/Z numbers and cents | Every number box has step, min and max; money in whole cents | `NUMERIC_FIELD_CONTRACT.md` |
| AA mock realism | Mock rules must equal the schema evidence | `mock-realism.spec.js` |
| AB mutations | 47 page + 10 SQL | below |
| AC harness | All unpinned specs pass under UTC+14 (German) and UTC−11 (French) | below |
| AG/AH performance and leaks | Numbers in `PERFORMANCE_AND_RESOURCES.md`; zero growth over 4 rounds | — |
| AI modularization | **Deliberately not done** this round. The helpers file grew without an API change, and moving more code now adds merge risk for little value (MD-04 stays queued) | — |
| AJ secrets | Clean (below) | — |
| AK error language | Developer wording removed; static guard | `error-language.spec.js` |
| AL invariants | `invariants.sql` after the busiest stress scenarios | — |
| AM merge | `main` and all 20 PR heads unchanged; this branch contains all 20 | `pr-merge-order.md` |
| AN CI | Timeout raised on the inactive copy; still informational SQL job | — |
| AO decisions | `OWNER_DECISIONS_NEXT.md` | — |
| AQ docs | current-state, progress, backlog (235 items) reconciled | — |

## 5. Final evidence (run with nothing else competing)

| Check | Result |
|---|---|
| **Full suite** (desktop 1100 px + iPhone 390 px), nothing else running | **1,702 tests: 1,173 passed, 0 failed, 529 skipped** in 29.1 min. Skips are by design: matrix and static tests run once, at desktop size. Start of extension 4: 1,358 / 991 / 367 |
| High-risk specs ×3 (failure injection 1+2, transitions 1+2, manual orders, sessions, session expiry, roles, storage, safety, write-path gate, admin/Emergency) | **1,185 passed, 0 failed, 0 flaky** |
| Same specs that do not pin a time zone, under UTC+14 (German) and UTC−11 (French) | 418 / 418 passed each |
| SQL draft tests 15, 16, 14 on the real shapes | all pass |
| Install package tests | **42 / 42** (was 34) |
| Stress (29 scenarios, 91 checks per run), final set | **3 runs, 0 failed, 0 deadlocks**, about 39 s each. Ladder up to 200 callers about 2.4–2.5 s. Unguarded PO-line race 4–7 of 20; guarded 0 |
| Query C v3 on mock catalogs (with / without pg_cron); Query D mock | 0 errors; planted fake secrets never appear |
| Mutation: page | **47 / 47 caught** (was 31) |
| Mutation: SQL | **10 / 10 caught** (was 8) |
| Accessibility | contrast (light/dark), names, focus return, dialog roles, Escape, **skip link, focus trap, headings, table headers**: pass |
| Responsive | 280, 320, 344, 360, 375, 390, 414, 430, 640, 768, 800, 1024, 1100, 1280, 1366, 1440, 2560 px, very tall, short: pass |
| Scale | exact totals 0 … 20,000; row-limit notice; palette over 10,000 records; leaks: zero growth |
| Merge check | `main` and all 20 PR heads unchanged; the branch contains all 20 |
| Secret / e-mail scan of the extension diff | clean: only `@example.test` addresses, no keys or tokens, no model names |
| Branch / remote | see the chat summary (the remote equals the local head; clean tree) |

## 6. Unresolved, by who acts next

- **You decide:** see `OWNER_DECISIONS_NEXT.md`. Main items:
  - N4 refunds; D-ops-4/5
  - the PO line guard
  - legal hold vs delete; document categories
  - picker, contrast and label
  - CI required check; pinned actions
  - backup check
- **You run (when you choose):** Query C (`QUERY_C_OWNER_RUN_GUIDE.md`).
- **Production changes (each needs your approval):**
  - R1–R5, then the PO line guard
  - INV-19 / INV-20; X3-18
  - Query D only if you want it

## 7. Rollback

- **Nothing is merged,** so nothing live needs undoing. To drop this work, ignore or delete `claude/platform-deep-readiness-extension-4`. Extension 3 (`3d5f1cc`) is untouched.
- **After a future merge:** revert the merge commit. The helper and CSS files carry content hashes, and the API guard (still API 6) refuses mixed old and new files.
- **Database drafts:** `11_…` removes R1–R5 and `18_…` removes the PO line guard. Both are tested.

## 8. Readiness estimate (conservative)

**Unchanged:** platform ≈70%, launch fixes R1–R10 ≈10%, overall ≈39%. The work is on an unmerged branch, and the launch blockers still need Query C, your decisions and approved production changes. **Merging this branch fixes bugs that are live today:** manual-order dates and duplicates (from extension 3), plus same-second merges, the wrong-month delivery expense and the Emergency switch-off gap.

## 9. Safety confirmation

- `main` untouched (`d3db7bc8e8cb74e9e26e296ac5ca546164a63cb1`). No merge, no PR, no force-push, no deployment.
- No production Supabase reads or writes. **Query C not run, Query D not run.** R1–R5 and the guard not installed. No RLS, cron or agent-switch changes.
- No Shopify changes; **Shopify Order Sync untouched (off).** No customer data, no customer messages, no refunds, no accounting actions.
- No backups accessed or changed, and no secrets accessed. GitHub settings and branch protections untouched; CI not made required.
- The Health Endeavors website repository and Real Estate OS repositories were not touched.
- All database work ran on a throwaway local PostgreSQL with synthetic data.
