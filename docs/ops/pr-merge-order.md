# Open PRs #5–#24: dependency map and recommended merge order

**Status:** analysis only, 2026-10-04. Nothing was merged. Every branch was merged in this order into a **scratch copy** of `main` (a detached local worktree), with the full test suite run after each step. No real branch was changed.

## 1. Starting point

- All 20 branches are based on the current `main` (`d3db7bc`). Each is **0 commits behind** `main`.
- `owner-login.html` on `main` has fingerprint (md5, first 8) `49514277`. Every PR that changes it was written against that same version.
- Files changed by more than one PR:
  - `owner-login.html`: 7 PRs (#8, #9, #10, #11, #12, #13, #14)
  - `tests/helpers/stateful-backend.js`: #15 and #16, with **byte-identical** content, so no conflict
- No PR touches the website, Supabase, workflows or secrets.

## 2. Classification

| PR | Kind | Changes | Overlaps |
|---|---|---|---|
| #5 | docs | `CLAUDE.md` (standing rules) | — |
| #6 | docs | project record, current state, progress | — |
| #17 | docs | frontend security review | — |
| #18 | docs | modularization plan (+ analysis script) | — |
| #15 | tests | regression coverage, request baseline, visual snapshots | `stateful-backend.js` (=#16) |
| #16 | tests + report | inventory safety (`test.fail` "wanted" tests) | `stateful-backend.js` (=#15) |
| #19–#24 | tests | admin, login/session, compliance, purchase orders, activity/calendar, operations | — |
| #7 | security | `dashboard.html`, `search.html` escaping | — |
| #9 | security | CSV formula guard | `owner-login.html` (helpers ~1780, 3622, 9006) |
| #10 | security | link-scheme check | `owner-login.html` (helpers ~1788, 7289–7539) |
| #13 | functional (security-adjacent) | re-auth Enter double-submit | `owner-login.html` (~1928) |
| #11 | functional | local dates | `owner-login.html` (9 places incl. ~1795, 3627, 8688, 9004) |
| #12 | functional (phone) | swipe on wide tables | `owner-login.html` (~4046) |
| #14 | functional (phone) | PO tap vs history overlay | `owner-login.html` (~3582) |
| #8 | functional (text) | agent status text | `owner-login.html` (~5778) |

The `owner-login.html` PRs edit **different lines**. #9, #10 and #11 sit close together in the helper area (~1780–1800) and in the CSV code (~3622 / 9004–9006), so those are the ones where git conflicts are most likely.

## 3. Recommended merge order

**Principle:** zero-risk docs first, then tests (so every later fix is merged against the widest net), then fixes from most to least security value, with the riskiest overlapping trio (#9 → #10 → #11) in a fixed order.

| Step | PR | Simulated result after merging (full suite) |
|---|---|---|
| 1 | #5 `sweet-hamilton-5ty3zp` | clean merge; `owner-login.html` `49514277`; **65 passed (58.9s)**, 0 failed |
| 2 | #6 `project-record` | clean merge; `owner-login.html` `49514277`; **65 passed (59.8s)**, 0 failed |
| 3 | #17 `frontend-security-review` | clean merge; `owner-login.html` `49514277`; **65 passed (1.0m)**, 0 failed |
| 4 | #18 `owner-login-modularization-plan` | clean merge; `owner-login.html` `49514277`; **65 passed (1.0m)**, 0 failed |
| 5 | #15 `regression-coverage` | clean merge; `owner-login.html` `49514277`; **183 passed (3.4m)**, 0 failed |
| 6 | #16 `inventory-safety-audit` | clean merge; `owner-login.html` `49514277`; **233 passed (4.4m)**, 0 failed |
| 7 | #19 `tests-admin-pages` | clean merge; `owner-login.html` `49514277`; **262 passed (5.3m)**, 0 failed |
| 8 | #20 `tests-login-session` | clean merge; `owner-login.html` `49514277`; **280 passed (5.4m)**, 0 failed |
| 9 | #21 `tests-compliance-pages` | clean merge; `owner-login.html` `49514277`; **299 passed (5.8m)**, 0 failed |
| 10 | #22 `tests-purchase-orders` | clean merge; `owner-login.html` `49514277`; **317 passed (5.8m)**, 0 failed |
| 11 | #23 `tests-activity-calendar` | clean merge; `owner-login.html` `49514277`; **343 passed (5.9m)**, 0 failed |
| 12 | #24 `tests-operations-pages` | clean merge; `owner-login.html` `49514277`; **363 passed (6.2m)**, 0 failed |
| 13 | #7 `escape-search-dashboard` | clean merge; `owner-login.html` `49514277`; **371 passed (6.3m)**, 0 failed |
| 14 | #9 `csv-formula-guard` | clean merge; `owner-login.html` `8bbe9da0`; **375 passed (6.4m)**, 0 failed |
| 15 | #10 `link-scheme-check` | clean merge; `owner-login.html` `82d9cc2e`; **385 passed (6.5m)**, 0 failed |
| 16 | #13 `reauth-enter-guard` | clean merge; `owner-login.html` `da09463d`; **387 passed (6.9m)**, 0 failed |
| 17 | #11 `local-dates` | clean merge; `owner-login.html` `89a7fa6a`; **398 passed (6.9m)**, 0 failed |
| 18 | #12 `phone-swipe-tables` | clean merge; `owner-login.html` `0ff02dec`; **401 passed (6.8m)**, 0 failed |
| 19 | #14 `phone-po-tap` | clean merge; `owner-login.html` `f4b4b7cd`; **402 passed (6.8m)**, 0 failed |
| 20 | #8 `agent-status-text` | clean merge; `owner-login.html` `c6b809a9`; **404 passed (6.7m)**, 0 failed |

**Result:**
- all 20 merged **without a conflict**, in this order
- the suite stayed green at every step, ending at **404 passed, 0 failed** (test runs across the desktop and iPhone projects; `test.fail` "wanted" tests count as passing while they still fail as expected)
- the #15 request baseline and visual snapshots stayed green after every fix, so no fix PR changes database requests or pixels on the covered pages
- on the fully merged tree, `ops-findings.spec.js` (branch `claude/ops-readiness`) also passes, 36/36

The `owner-login.html` fingerprint column lets the owner confirm each step on GitHub matches what was tested.

## 4. Rules while merging

1. **Merge one at a time, in this order.** The simulation shows that no branch needs updating first. If GitHub still shows "out of date" (only when the ruleset requires up-to-date branches), use **Update branch**, which is a merge, never a rebase or force-push. Wait for tests, then merge.
2. These branches were created by earlier Claude work in this account. Updating them is safe only in that order and only on these branches. **Not** any branch of the website session.
3. After each merge, a live check: open the dashboard, log in, open the changed page.
4. **Flip the "wanted" tests when their fix lands.** `test.fail()` tests in #16 and `ops-findings.spec.js` start failing *as expected-failures-that-passed* once a fix lands. That is the signal to remove `test.fail()` in the same PR.
5. **Request baseline and visual snapshots (#15):** a fix PR that intentionally changes requests or pixels must regenerate them in its own PR (`UPDATE_BASELINES=1`, `--update-snapshots`) and show the diff.
6. If CI is activated first (`docs/ops/ci/`), every one of these steps gets the suite automatically.

## 5. Rollback

Every PR is a single merge commit. Reverting it restores the previous state; none of them changes the database.
