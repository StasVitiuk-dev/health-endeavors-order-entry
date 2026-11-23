# Review of the `owner-login.html` modularization plan (PR #18)

**Status:** review only, 2026-10-04. No refactor has started. Reviewed: `docs/plans/owner-login-modularization-plan.md` on `claude/owner-login-modularization-plan`.

**Verdict:** the plan is sound. Its step order (tests → CSS → helpers → namespace → small pages → stock/money last) is right, and it already defers inventory and purchasing until after the atomic database work. Seven changes are recommended below. Most of them are about **sequencing against the other open work**, which the plan could not see when it was written.

## 1. What has changed since the plan was written

- **"Tests PR A" mostly exists now.** The plan's step 0 is covered by PRs that are already open:

  | Plan's missing test (§6) | Now covered by |
  |---|---|
  | 1. Visual baselines | #15 `visual.spec.js`: login plus 9 pages, desktop and iPhone, plus Orders in dark mode. **Not** the other ~21 pages. |
  | 2. Request-log snapshot | #15 `request-baseline.spec.js` + `tests/baselines/requests.json` |
  | 3. Pure-helper unit tests | #15 `helpers-unit.spec.js` |
  | 4. Realistic-data render tests | #15 `pages-data.spec.js`; #19, #21, #23, #24 (admin, compliance, activity/calendar, operations) |
  | 5. Write-shape tests | #16 (inventory), #22 (purchase orders), `ops-findings.spec.js` (approvals, PO status, legal holds) |
  | 6–7. Keyboard layer, Record Inspector | #15 `ui-chrome.spec.js` (palette, `?`, g-letter, `/`, ⌘[ ⌘], ⌘N, j/k, hover+Space, phone tap) |
  | 8. Re-auth prompt | #20 `login-session.spec.js` |
  | 9. CSV exports | partly: #9 `csv-export-guard.spec.js` checks formula escaping; full header/row content is **still a gap** |
  | 10. Theme | #15 `ui-chrome.spec.js` |

- **R1–R4 are designed and tested** (`docs/ops/R1-R5-function-design.md`). Their dashboard PRs will each change a few small regions of `owner-login.html`.
- **R7 is ready to do** (pinned version and hash in `docs/ops/other-fixes-review.md`).
- **A tests-only CI workflow is drafted** (`docs/ops/ci/`), not yet active.

## 2. Recommended changes to the plan

1. **Finish the open `owner-login.html` fix PRs before step 1.** Every extraction PR conflicts with every open branch that edits the same region. Merge #9, #10, #13, #11, #12, #14 and #8 first (order in `docs/ops/pr-merge-order.md`; #7 touches only `dashboard.html` and `search.html`). None of them changes CSS, so the CSS move itself wouldn't conflict. But #9, #10 and #11 all edit the pure-helper region (lines ~1780–1800), so they **must** land before the helpers move (step 7). After that, keep a **refactor freeze rule**: while a move PR is open, no other PR edits `owner-login.html`.

2. **Activate CI before the first move PR.** The plan relies on "every test on both sizes" per PR. That should be automatic and required, not a manual run (owner decision on `docs/ops/ci/tests-only.yml.draft`).

3. **Do the R1/R4 dashboard switches *in place*, before the split, and keep them separate from any move.** The plan's step 8 moves the inventory code "as part of" the atomic work. That would mix a behaviour change with a code move in one diff, which is the hardest thing to review. Instead:
   - each R-function dashboard PR replaces one button's request chain with one `rpc()` call, in place (a small diff)
   - the request baseline is updated deliberately in that PR, and only for that button
   - the move of the Inventory, Purchasing and Returns code comes much later, as a pure move with an unchanged baseline

   Doing R1/R4 first also means the riskiest money/stock code is fixed before anyone has to learn a new file layout.

4. **Pull the R7 pin (plan step 9) out of the refactor.** It's a one-line security fix on all 6 pages and has nothing to do with the split. It can merge any time after the owner picks option A or B.

5. **Add a version guard to the cache-busting mitigation.** `?v=` suffixes (plan §9) are needed but not enough. GitHub Pages caches files for about 10 minutes, so for a while after each deploy a browser can run a **new HTML page with an old script, or the reverse**. Add:
   - one build id per deploy, written into the HTML and every new JS file (`HE.BUILD = '…'`)
   - a check in `99-start.js`: if any file's id differs, show "The dashboard was just updated — reload" and **do not run any loader**, rather than run mixed code that could write data
   - a test that every local `<script>`/`<link>` has `?v=` and that the ids match

6. **Wrap each new file in a function and attach to `HE`, rather than relying on `"use strict"` only.** In classic scripts, top-level `function foo(){}` becomes a global. Names already used by the browser (`close`, `print`, `status`, `name`, `open`, `find`, `top`) would silently clash or be shadowed. Pattern:

   ```js
   (function (HE) { 'use strict'; function loadTasks(){…} HE.tasks = { loadTasks }; })(window.HE);
   ```

   Add a test that the global scope gains only `HE` (compare `Object.keys(window)` before and after load).

7. **Fill the remaining test gaps first, as one tests-only PR:**
   - CSV export content (Activity, Tax, Accounting)
   - visual baselines for the ~21 pages #15 doesn't cover, at least on desktop
   - the global-scope check from item 6

## 3. Improved sequence

| # | Step | Kind | Depends on |
|---|---|---|---|
| 0 | Merge the open tests and docs PRs (#5, #6, #15–#24) and `ops-findings` tests | tests | — |
| 1 | Merge the open fixes (#7–#14) | small fixes | 0 |
| 2 | R7 pin on all 6 pages | security, 6 lines | owner choice A/B |
| 3 | Activate tests-only CI as a required check | CI | owner approval |
| 4 | R1 → R4 → R2 → R3 → R5: SQL live, then one dashboard PR each, **in place** | behaviour fix | owner runs Query A/B; SQL reviewed |
| 5 | Remaining test gaps (CSV, more visuals, global-scope check) | tests | 0 |
| 6 | CSS → `assets/owner-login.css`; one deduplicated icon file | move | 1, 5 |
| 7 | Pure helpers and labels → `00-helpers.js` | move | 6 |
| 8 | `HE` namespace, `99-start.js`, build-id guard | structure | 7 |
| 9 | Tasks; then Calendar, Compliance, Operations (one PR each) | move | 8 |
| 10 | Orders, then Money | move | 9; N4 decision settled first so accounting isn't moved mid-change |
| 11 | Inspector/Activity, then Shell | move | 10 |
| 12 | Inventory, Purchasing, Returns (pure move; logic is already in the R-functions) | move | 4, 11 |
| 13 | Login/core last | move | 12 |

**Each move PR:**
- unchanged request baseline and visual snapshots
- one revert undoes it
- a hard-refresh live check after merge

**Out of scope for every move PR:** the known bugs. Each keeps its own PR.

## 4. Risks the plan does not list

- **Two concurrent Claude sessions.** A long-running refactor branch in this shared account invites conflicts. Keep each move PR short-lived (open, test, merge within a day).
- **Doc line numbers go stale.** Reviews cite `owner-login.html` line numbers on a fixed commit (`d3db7bc`). After the split, cite function names instead.
- **The website session must not be affected.** The split touches only `owner-login.html` and new `assets/` files in this repository. Website code never lives here.
