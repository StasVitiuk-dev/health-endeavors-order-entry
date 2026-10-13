# Release review (EXT15): owner review package

**Branch:** `claude/platform-ext15-modularization-csp-2026-10-12` · **page code frozen at `66a9918`** (every later commit changes only tests, CI and documents; verified: 0 lines of page code differ) · base `main` `d3db7bc` · **draft, not merged, not deployed.**

## 1. Is it safe to merge? (plain English)

Merging changes the dashboard code only. No SQL runs on merge, every database-backed feature stays off until its SQL is installed, and nothing touches customers, stock or money. On top of EXT14, merging EXT15 changes four things:

1. **The owner page's program is loaded as 16 smaller files** (plus the main program file). If any one fails to load or is out of date, the page shows a plain "reload the page" message instead of half-working.
2. **A stricter browser style policy.** Inline styles are no longer allowed on the owner page. The look is unchanged (checked element by element).
3. **Four honesty fixes:** a blank nightly-check count no longer shows PASS; an unclear agent switch shows Unknown instead of Enabled; a failed AI spend read shows "?" instead of "$0.00 spent"; the offline bar no longer blocks the menu.
4. **GitHub's automatic tests** (already active on branches) start running on `main` too. They only test; no secrets, no deploy.

## 2. What changed in EXT15 (scope)

| Changed | Files |
|---|---|
| Program split into modules | `assets/owner-login-app.js` (smaller), `assets/owner-login-modules.js` (registry), `assets/app/*.js` (16 modules), `owner-login.html` (script tags, policy) |
| Styles | `assets/owner-login.css` (129 utility classes, offline bar), inline styles removed from the HTML and program |
| Helpers | `assets/owner-login-helpers.js` (nightly-check count rule; one unused constant removed) |
| CI | `.github/workflows/ci.yml` (SHA pins, balanced shards, 3 new checks, full history for the browser job, change impact vs `main`) |
| Tests and tools | `tests/specs/*-ext15.spec.js` (10 new), `tests/tools/*` (graph, extraction, move proof, module map, style tools, type check, DOM sink audit, CI shards), DB stress harness |
| Docs | `docs/ops/*_EXT15.md` (8) |

**Not changed:** any SQL draft that installs or changes a database object; the other five pages' behaviour; the high-risk screens' logic (purchase orders, inventory, returns, recalls, accounting), which stayed in the program file deliberately.

## 3. Tests run on the frozen code

| Check | Result |
|---|---|
| Full suite, desktop + iPhone, page code `66a9918` (final run, 52.5 min) | **1,991 passed, 0 failed, 0 flaky**, 334 skipped on purpose |
| First-pass full suite (`1d9c350`, 63.5 min, machine shared with other runs) | 1,964 passed, **24 failed** → 1 product bug (offline bar, fixed), 1 machine-load timing (10k search; passes alone), 22 test-side (fixed). Recorded in `ENGINEERING_REPORT_EXT15.md` |
| EXT15 page mutants | **12/12 caught** (the first run caught 9/11: two test gaps found and closed) |
| GitHub CI, `3980d99` (same page code) | **all green**: static, 3 browser shards, database (incl. SQL mutants), screenshots |
| GitHub CI, `63f824a` | DB_SUITE_AND_CI: see the final report |
| Local database suite (full, incl. volume steps) | see the final report |
| Move proof / module graph / no inline styles / type gate / secret scan / SQL lint / status / docs check | OK on every run |
| Visual equality of the style change | IDENTICAL computed styles, every page, desktop + iPhone |

**Evidence caveats (recorded, not hidden):** during the final local run, (a) the old offline-bar CSS was on disk for about 8 seconds (a negative control), and (b) a database stress reproduction ran for about 3.5 minutes on the same machine. The run had 0 failures, so neither changed a result; a failure in those windows would have been re-run, not trusted.

## 4. Rollback (step by step)

If anything is wrong after a merge:

1. On GitHub, open the merged pull request and press **Revert** → **Create pull request**.
2. Approve and merge the revert pull request (as for any PR).
3. Wait 5 minutes, then hard-refresh the live dashboard (Cmd+Shift+R) or use a Private Window.

The revert restores the exact previous files. No database change needs undoing, because EXT15 contains none.

## 5. Relationship to the open draft PRs

- Draft PR #29 (EXT1–14) is the base of this branch. Its latest CI run (`b6f7f68`) is fully green on GitHub.
- EXT15 is a **successor draft PR** that contains everything in #29 plus EXT15 (this branch started from #29's EXT14 head). Review EXT15 instead of #29; #29 can then be closed without merging. Merging either one is Stas's decision.

### Reviewer manifest (what to look at, in order)

1. `docs/ops/APPLICATION_MODULE_MAP_EXT15.md` §5: the 14 deliberate edits (everything else was moved unchanged, proven by a tool).
2. `assets/owner-login-modules.js` (32 lines): the registry.
3. `owner-login.html`: the `Content-Security-Policy` line and the module script tags.
4. `assets/owner-login.css`: the offline bar block.
5. `.github/workflows/ci.yml`.

## 6. Deployment instructions for Stas (only when you decide to)

1. On GitHub open the EXT15 draft PR. Check the description says the tests passed and CI is green.
2. Press **Ready for review**, then **Review changes → Approve**. (Claude cannot approve or merge.)
3. Press **Merge pull request** → **Confirm**.
4. Wait 5 minutes. Open the live dashboard in a Private Window (or hard-refresh with Cmd+Shift+R).
5. Check:
   - you can sign in;
   - Home shows its cards and the sidebar has its coloured groups;
   - Orders, Inventory and Tasks open;
   - System status → Copy diagnostic summary lists "modules 16/16".
6. If anything differs: change nothing else, use §4, and send Claude a screenshot.

## 7. Known limitations

- No real Safari or real iPhone test (Chromium at iPhone size only).
- Five smaller pages still allow inline styles.
- The program file is still 6,783 lines; the high-risk screens are not yet modules.
- One GitHub-only test failure (offline-bar check on shard 2, `079f378`) did not repeat after the check was given 5 s to settle; cause not identified: **OPEN INTERMITTENT (harness timing suspected)**.
- Production state of every database step remains UNKNOWN until Query C is run.
