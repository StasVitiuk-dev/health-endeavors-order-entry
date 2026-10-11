# Overnight platform session, extension 3 (2026-10-06)

**Branch:** `claude/platform-overnight-extension-3`, created from `claude/platform-overnight-implementation` at **`37050c6`** (that branch is unchanged).

- **Ending SHA:** see the last commit on the branch (this report is part of it; the final SHA is given in the chat summary).
- **Not merged, not deployed. `main` (`d3db7bc`) and production untouched.**
- **CI copy:** `claude/tests-only-ci-v2` (`2182bf0`, not active), created from `claude/tests-only-ci` (`662d46b`, unchanged).

## Plain-English summary

I re-audited the whole dashboard from scratch instead of trusting the earlier list, and turned the most important checks into automatic tests that run every time.

**Real problems found and fixed on the branch (none is live until you merge):**
- **Manual orders landed on the wrong day.** An order dated the 6th was saved as 7 pm on the 5th, so on the 1st of a month it counted in the previous month. The date box also showed "tomorrow" after 7 pm. **This is live on `main` today.**
- **A manual order could be saved twice.** If the connection dropped while saving, pressing Save again created a second order. **Also live on `main`.**
- **Expenses total cut at 200.** The Expenses page's "Total logged" only added up the newest 200 expenses.
- **Open returns hidden.** The Returns page could hide older open returns.
- **Stale edits.** A product's status could be flipped back by a tab left open from earlier.
- **Sold products deletable.** A product that had already been sold could be deleted.
- **Signed out elsewhere.** A tab signed out elsewhere kept showing the dashboard with empty lists, as if there were no data.
- **Raw error text.** Dropped connections showed "Failed to fetch" instead of "we can't tell whether this was saved".
- **Search Enter.** Typing a page name and pressing Enter opened a help article instead of the page.
- **Keyboard and screen readers.** Focus didn't return to the button after a dialog closed, and dialogs weren't announced as dialogs.
- **Install preflight.** The stock-function install had no check that the database looks the way we expect.

**Made much harder to break:**
- every status change is checked for stale-tab safety in every test;
- every common failure (server error, permission refusal, rule refusal, lost reply before or after saving) is forced on every simple action;
- roles, data sizes up to 20,000 rows and nine screen sizes are tested;
- "mutation testing" breaks each safety rule on purpose to prove a test notices: page 31 of 31, database 8 of 8.

**Prepared for you, not run:**
- Query C version 3 with a step-by-step guide (`QUERY_C_OWNER_RUN_GUIDE.md`).
- The R1–R5 install runbook with a fingerprint check.

## Commits (oldest first)

| SHA | What |
|---|---|
| `bc987f9` | State-machine rule in the mock; transition matrix; Query C v3; R1–R5 install preflight and package tests |
| `b22c45b` | Expenses totals and Returns counts complete; typed-number checks (helpers API 4) |
| `66ad853` | Failure-injection matrix; signed-out handling; retry-safe manual orders; plain error text |
| `c6e9876` | Role matrix; sold-product delete refused; search Enter; report boundaries; Query C section 10; readiness / audit docs |
| `83ea404` | Mutation testing 31/31 + 8/8; scale matrix to 20,000; 3 untested SQL rules now tested |
| `a93ae12` | Empty uploads refused; document delete guarded |
| `63eb2c0` | Focus return, dialog semantics, device matrix, palette/inspector edge cases |
| `ee23b08` | Modularization step 2d (date ranges, API 5) |
| `87ea398` | CI review (improved copy on `claude/tests-only-ci-v2`) |
| `0600bfe` | Manual order dates in Central (live bug on main) |
| `914ab50` | Other pages react to sign-out elsewhere; future backlog F3 |
| `6161812` | AA contrast for all visible text |
| `72c0613` | Docs reconciled |
| `55001c8` | Agent error text masked; atomic upload design |
| `4e41ff4` | Merge simulation re-run recorded |
| `330dc77` | Duplicate delivery costs listed for review |
| `da36b4c` | Content-Security-Policy on the dashboard |
| (final) | This report, final numbers |

## Bugs found (32 X3 items + extras) and what happened

Full list with evidence: `SECOND_PASS_AUDIT_2026-10-06.md`, `PRODUCT_LIFECYCLE_REVIEW.md`, `AUDITABILITY_REVIEW.md`, `storage-safety-audit.md`, and the master backlog (ids X3-…, F3-…).

| Priority | Fixed on branch | Waiting (Query C / owner / later) |
|---|---|---|
| P1 | X3-03 Expenses total; X3-09 install preflight; X3-20 duplicate manual order; X3-32 manual order dates | X3-17 Emergency flag columns (branch fallback added; Query C confirms); X3-25 backup health unverified (owner check) |
| P2 | X3-01, X3-04, X3-08, X3-13, X3-21, X3-22, X3-24, X3-28, X3-29 | X3-18 who-did-it on compliance actions (Query C → owner); F3-02 manual orders have no SKU (owner) |
| P3/P4 | X3-02, 05, 06, 07, 10, 14, 23, 26, 27, 30; AX-09; F3-04, F3-06, F3-14; RP-06; ST-09 (design); search Enter (UX-01) | X3-11, 12, 15 (deferred); X3-16, F3-01, F3-07 (owner); F3-03 (Query C); X3-31, F3-05/08–13 (deferred) |

## Tests added (all synthetic data; every fix has a test that fails on the old code)

| New test file | What it proves |
|---|---|
| `state-transitions.spec.js` | Buttons per status; every button against every stale status (tasks, returns, purchase orders) |
| `fault-injection.spec.js` | 9 actions × 5 failure types |
| `session-failures.spec.js` | Signed out elsewhere; expired sign-in on read and write; reload; direct URL |
| `manual-order-entry.spec.js` | Retry-safe saving; plain errors; Central dates |
| `role-matrix.spec.js` | 4 roles × 4 stock actions |
| `scale-matrix.spec.js` | Exact totals at 0 … 20,000 rows with the 1,000-row cap on |
| `second-pass-fixes.spec.js` | X3-03 … X3-06 |
| `product-lifecycle.spec.js` | Sold, quality-checked, wildcard SKU, unused |
| `report-boundaries.spec.js` | Central month/year edges; exact cents; deleted/cancelled; duplicate delivery costs |
| `device-matrix.spec.js` | 9 screen sizes and zoom levels |
| `search-palette.spec.js` | Duplicates, cap, no match, Inspector permission error |
| `sql-readonly.spec.js` | Queries A–D are one read-only statement; Query C never outputs function source |
| Additions to existing specs | Contrast for all text; focus return; dialog roles; Emergency fallback; CSP; storage; helpers unit tests |
| SQL / shell | `install_package_test.sh` (34); `query_c_no_cron_test.sql`; SQL test 16 (+4 cases); stress S21–S25; `run-sql-mutations.sh` |

## Final evidence (run with nothing else competing)

| Check | Result |
|---|---|
| Full suite (desktop 1100 px + iPhone 390 px), nothing else running | **1,358 tests: 991 passed, 0 failed, 367 skipped**. Skips are by design: the new matrix tests run once, at desktop size. At the start of extension 3: 864 / 739 / 125 |
| Key safety specs repeated ×3 (fault injection, transitions, manual orders, session, roles, storage, safety) | **513 passed, 0 failed, 0 flaky** |
| SQL draft tests on the real shapes (15, 16, 14) | all pass |
| Install package tests | **34 / 34** |
| Query C v3 on mock catalogs (with and without pg_cron) | 0 errors; the planted fake key and token never appear |
| Read-only proof of queries A–D | `sql-readonly.spec.js` passes |
| Stress (25 scenarios, 72 checks per run) | **13 runs, 0 failed, 0 deadlocks**; 100 simultaneous callers ≈ 1.2–1.4 s (linear growth) |
| Mutation: page | **31 / 31 caught** (final re-run below) |
| Mutation: SQL | **8 / 8 caught** |
| Accessibility (contrast for all text in light and dark; names; focus return; dialog roles; Escape) | pass |
| Responsive (320, 360, 390, 430, 640, 768, 800, 1024, 1100, 1280, 1440 px, very tall, short laptop) | pass |
| Merge simulation (20 PRs) | all clean; all fingerprints match; 364 / 405 passed |
| Secret / e-mail scan of the extension diff | clean. Only synthetic addresses; the only host is the project's public Supabase address (already public in the page) |

## Risks discovered
- **Backups:** health is **unknown** (records disagree). Please check the private backups repository's Actions (read-only).
- **Emergency mode:** may not be able to switch Order Sync off on the real table if the who/when columns don't exist (X3-17). The branch has a fallback; Query C section 10 confirms.
- **Live bugs on `main`:** the two manual-order bugs stay until the fix is merged. Any manual orders entered before then may sit one day early (likely none, pre-launch).

## Unresolved, by owner of the next step
- **Query C (you run it):** stock writers, value rules for the other tables, audit coverage, and the flag columns.
- **Your decisions:**
  - N4 refunds; D-ops-1…6; document categories; legal holds vs deletes
  - permanent product delete policy (X3-16); manual-order SKU picker (F3-02)
  - input-border contrast (F3-01); the "This Week" wording (F3-07)
  - CI as a required check (CI-02); pinned action commits (CI-03); backup check (X3-25)
- **Production changes (after approval):**
  - R1–R5 install (`R1-R5-INSTALL-RUNBOOK.md`)
  - remove direct stock writes (INV-20); CHECK rules (INV-19)
  - audit trigger extension (X3-18)
  - orphan-file sweep (`ATOMIC_UPLOAD_DESIGN.md`)
  - Query D (only with your approval)

## Rollback
- **Nothing is merged,** so nothing live needs undoing. To drop this work: ignore or delete the branch `claude/platform-overnight-extension-3`. The previous branch `claude/platform-overnight-implementation` (`37050c6`) is untouched.
- **After a future merge:** revert the merge commit. The helpers-file version guard (API 6) refuses a mix of old and new files and asks for a reload.
- **CI copy:** `claude/tests-only-ci-v2` can be ignored or deleted; the original CI branch is unchanged.

## Merge simulation
All 20 open PR heads are unchanged since Sept 29–30. All 20 merges are clean in the recommended order, every `owner-login.html` fingerprint matches, and the full suite passed after step 12 (364) and step 20 (405). Details: `pr-merge-order.md`.

## Backlog before and after

| | Start of extension 3 | End |
|---|---|---|
| Deduplicated items | 162 | **209** (+47, each with evidence) |
| Done on branch | 100 | **130** |
| Queued safe items | 6 | **2** (INV-15 waits on D-ops-4; MD-04 module split, low value now) |

The target of 300–400 candidates was **not** reached on purpose. Every item must point to code, a test or a risk, and splitting items to raise the count would hide the real picture.

## Conservative readiness estimate
**Unchanged:** platform ≈70%, launch fixes R1–R10 ≈10%, overall ≈39% (see `health-endeavors-progress.md`).

The work here is preparation on an unmerged branch. The launch blockers still need Query C, your decisions and production changes. **Merging the branch fixes two bugs that are live today** (manual order dates and duplicates), so merging this work matters.

## Safety confirmation
- `main` untouched (`d3db7bc8e8cb74e9e26e296ac5ca546164a63cb1`); no merge; no PR opened; no force-push; no deployment.
- No production Supabase reads or writes; **Query C not executed; Query D not executed**; R1–R5 not installed.
- No Shopify changes; **Shopify Order Sync untouched / off**; no agent switches changed.
- No customer data viewed or changed; no customer messages; no accounting actions; no backups accessed or changed; no secrets accessed.
- GitHub settings and branch protections untouched; the CI copy is a branch only (not active).
- Health Endeavors website repository and Real Estate repositories untouched.
- All database work ran on a throwaway local PostgreSQL with synthetic data.
