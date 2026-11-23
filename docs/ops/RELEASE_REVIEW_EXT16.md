# Release review (EXT16): owner review package

**Branch:** `claude/platform-ext16-overnight-systems-hardening-2026-10-12` (from EXT15 final `f2b2d33`). **Page code frozen at `bc8ce5e`**: every later commit changes only tests, test tools and documents (verified: 0 lines of `*.html` or `assets/` differ). Base `main` `d3db7bc`. **Draft, not merged, not deployed.**

## 1. Is it safe to merge? (plain English)

Merging changes the dashboard code only. No SQL runs on merge, every database-backed feature stays off until its SQL is installed, and nothing touches customers, stock or money. On top of EXT15, merging EXT16 changes four things:

1. **All six dashboard pages refuse inline styles and inline scripts.** Before, only the owner page did. The manual order page's program moved into its own file (`assets/manual-order-entry.js`), unchanged except one plain error message.
2. **Receiving a purchase order runs through one explicit safety state machine** (`assets/app/he-ops.js`). It allows no second send while one is in flight, none after a confirmed receipt, and none after an unknown result until a check is done. What is sent to the database is unchanged.
3. **The admin and compliance pages moved into their own modules** (moved unchanged, proven by the move tool). The main program is now 6,214 lines.
4. **One small fix:** a page whose library is refused now shows a plain message instead of a script error.

## 2. What changed in EXT16 (scope)

| Changed | Files |
|---|---|
| Strict policies, smaller pages | `change-password.html`, `dashboard.html`, `search.html`, `index.html`, `manual-order-entry.html`; new `assets/change-password.css`, `dashboard-page.css`, `search-page.css`, `manual-order-entry.css`, `manual-order-entry.js`; `assets/dashboard-page.js` (spend bar width) |
| Owner page | `owner-login.html` (3 script tags), `assets/owner-login-app.js` (smaller; receive flow uses the state machine), new `assets/app/he-ops.js`, `he-admin.js`, `he-compliance.js` |
| Tests and tools | 3 new specs (`ops-state-ext16`, `pages-strict-ext16`, `shrink-ext16`), the shrinker (`tests/helpers/shrink.js`), the chaos runner rework, opt-in fast sign-in, forensic probe, intermittent register, mutation runner `--check`, 7 new and 17 repaired mutants, `docs/ops/sql/local-test/s29_lock_cycle_repro.sh` |
| Docs | `docs/ops/*_EXT16.md` (8), project record, current state, progress |

**Not changed:** any SQL draft (deliberately: see §7, INT-4), the CI workflow file, the visible behaviour of any screen, and the server calls made by any workflow.

## 3. Tests run

| Check | Result |
|---|---|
| Full suite, desktop + iPhone, `bc596e2` (page code `bc8ce5e`; 61.6 min) | **2,025 passed, 0 failed, 0 flaky**, 336 skipped on purpose. Caveat: this review file was added to the working tree during the run (documents only); the docs checks were re-run on the final head and pass |
| GitHub CI, `0722ae6` (page code `bc8ce5e`) | static ✓, screenshots ✓, shards 1–2 ✓; **shard 3 ✗** (INT-5, stale mutant: fixed); **database ✗** (INT-4, S29 deadlock: explained, not fixed) |
| GitHub CI, `3a86cbf` | static ✓, screenshots ✓, **database ✓**; browser shards cancelled by the next push |
| GitHub CI, `bc596e2` | **static ✗**: a status document linked to this review before it existed (fixed by adding it); heavy jobs skipped |
| GitHub CI, final head | recorded in the PR description and the EXT16 final report (a document cannot contain its own CI result) |
| Mutants | all 187 apply (checked by a test); 7 new EXT16 mutants caught; 17 repaired mutants + 1 neighbour: **18/18 caught** |
| Local stress (CI-like PostgreSQL, default connection limit) | 10 runs × 98 checks, 0 failures, 0 deadlocks; S29 alone 40 rounds, 0 deadlocks; forced S29 interleaving: deadlock every time (2/2) |
| Static: move proof, module graph, no inline styles, type gate, secret scan, SQL lint, status, docs check | OK |

## 4. Rollback (step by step)

If anything is wrong after a merge:

1. On GitHub, open the merged pull request and press **Revert** → **Create pull request**.
2. Approve and merge the revert pull request (as for any PR).
3. Wait 5 minutes, then hard-refresh the live dashboard (Cmd+Shift+R) or use a Private Window.

The revert restores the exact previous files. No database change needs undoing, because EXT16 contains none.

## 5. Relationship to the open draft PRs

- Draft PR #30 (EXT15, contains #29) is the base of this branch.
- EXT16 is a **successor draft PR** containing everything in #30 plus EXT16. Review EXT16 instead of #30; #30 and #29 can then be closed without merging. Merging any of them is Stas's decision.

### Reviewer manifest (in order)

1. `assets/app/he-ops.js` (76 lines) and `docs/ops/STATE_MODEL_EXT16.md`: the state machine.
2. The receive flow in `assets/owner-login-app.js` (search `poReceiveOps`).
3. The `Content-Security-Policy` line of each of the six pages (`docs/ops/CSP_REPORT_EXT16.md`).
4. `assets/manual-order-entry.js`: moved from the page; the only edit is the library-load message.

## 6. Deployment instructions for Stas (only when you decide to)

1. On GitHub open the EXT16 draft PR. Check that the description says the tests passed, and look at the CI line (§7 explains the one known database-test exception).
2. Press **Ready for review**, then **Review changes → Approve**. (Claude cannot approve or merge.)
3. Press **Merge pull request** → **Confirm**.
4. Wait 5 minutes. Open the live dashboard in a Private Window (or hard-refresh with Cmd+Shift+R).
5. Check:
   - you can sign in;
   - Home shows its cards;
   - Purchase orders open, and an order's detail shows its Receive button;
   - the manual order page (`manual-order-entry.html`) loads and shows its form;
   - System status → Copy diagnostic summary lists "modules 19/19".
6. If anything differs: change nothing else, use §4, and send Claude a screenshot.

## 7. Known limitations

- **INT-4 (EXPLAINED, NOT FIXED):** a rare deadlock between the draft "delete product" function and a delivery being received at the same moment. Both are SQL drafts that are not installed anywhere, and nothing is damaged (the database cancels one call). The cause is reproduced on demand, and the fix is proven on a throwaway database. It is scheduled first in EXT17, because it changes the reviewed fingerprint quoted in about 25 files. Until then, the GitHub database job can fail rarely on scenario S29. Details: `CI_INTERMITTENT_EXT16.md` §4.
- **Draft receive of an order with no lines** fails with a raw "division by zero" (EXT17).
- **INT-3 (OPEN, UNEXPLAINED):** one replay inside the shrinker self-test once did not settle in 30 s.
- No real Safari or real iPhone test (Chromium at iPhone size only). Automated accessibility checks are not a VoiceOver test.
- The high-risk screens (purchase orders, inventory, returns, recalls, accounting) are still in the main program file; only PO receiving has an explicit state machine.
- Production state of every database step remains UNKNOWN until Query C is run.
