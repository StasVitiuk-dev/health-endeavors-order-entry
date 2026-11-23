# Release review (EXT14): owner review package

**Branch:** `claude/platform-ext14-deep-engineering-2026-10-11` · page code frozen at `3a40095` · base `main` `d3db7bc` · **draft, not merged, not deployed.**

## 1. Is it safe to merge? (plain English)

The answer from EXT13 still holds, with EXT14 on top. Merging changes the dashboard code only. Every new database-backed feature stays **off** until its SQL is installed, and no SQL runs on merge. EXT14 adds three things that take effect on merge:

1. **The owner page loads its program from `assets/owner-login-app.js`.** If that file ever fails to load, the page shows a plain message after 8 seconds instead of a blank screen.
2. **A stricter browser security policy for scripts.** Tested on every page in the suite. If something stops working after the merge, roll back as in §4.
3. **The GitHub test workflow becomes active.** It runs tests on pull requests. It cannot deploy, has no secrets and only reads the code.

## 2. What changed in EXT14 (scope)

| Kind | Files |
|---|---|
| Dashboard code | `owner-login.html` (program moved out, policy, "not loaded" message), `assets/owner-login-app.js` (new), `assets/owner-login-theme.js` (new), `assets/owner-login.css` (message style), diagnostic summary role fix |
| CI | `.github/workflows/ci.yml` (new, tests only) |
| SQL drafts | `drafts/11` (switch guard), `drafts/13` (missing totals), `drafts/31` (new rollback), `drafts/19`/`20` (comments/warning), metadata headers in all drafts; test SQL moved to `docs/ops/sql/local-test/draft-tests/` |
| Tests and tools | new specs: CI guard, SQL package, staging artifact, mutation runner safety, screenshots policy, status manifest, diagnostics fuzz, money precision, test config; tools: sql-lint, ci-impact, secret-scan, status-validate, run-db-suite, ci-local; staging scenarios |
| Docs | this file, `ENGINEERING_REPORT_EXT14.md`, `CI_GUIDE_EXT14.md`, `SCREENSHOT_POLICY_EXT14.md`, `START_HERE_EXT14.md`, `CURRENT_PLATFORM_STATE_EXT14.md`, `STATUS_MANIFEST_EXT14.json`, dated corrections in EXT13 docs |
| Removed | 6 byte-identical screenshots (manifests point to the identical earlier file) |

**Deliberately NOT changed:** production database, switches, Supabase settings, GitHub settings and rulesets, Pages settings, any other repository, customer data, inventory, accounting.

## 3. Tests run on the frozen code

| Check | Result |
|---|---|
| Full suite, desktop + iPhone (`npm test`), page code `3a40095` | 1,895 passed; 8 known-bug tests failing as expected (marked, waiting on R1–R5); 309 skipped on purpose; 5 unexpected, all test-side and fixed (`ENGINEERING_REPORT_EXT14.md` §7); re-run of the affected specs: all passed |
| Page + tool mutants (170) | 170/170 caught |
| SQL mutants (14) | 14/14 caught |
| Database suite (26 steps, local PostgreSQL 16) | 26/26 PASS (421 s) |
| High-risk specs × 3 (17 files: PO receive, fault injection ×2, inventory safety, manual order, auth chaos, stale tabs, double submit, concurrency, request keys ×2, assets, CSP, XSS, diagnostics fuzz, staging artifact, mutation runner) | 1,422 as expected (incl. the known-bug tests failing as marked), 45 skipped, **0 unexpected, 0 flaky** (34.3 min) |
| Secret scan / SQL lint / status check / docs check | OK / OK / OK / OK |

## 4. Rollback (step by step)

1. Open the merged pull request on GitHub and press **Revert**. GitHub creates a new pull request that puts every file back.
2. Approve and merge that revert pull request (you are the approver). GitHub Pages republishes `main` within 1–5 minutes.
3. Hard-refresh the live dashboard (Cmd+Shift+R) and check that you can sign in and Home loads.

No database step is involved: EXT14 installed nothing. The revert also removes the CI workflow.

## 5. Relationship to draft PR #28 (stacked-PR analysis)

- PR #28's branch `claude/platform-ext12-preproduction-simulation-2026-10-11` is at `cc9a142` (EXT13). The EXT14 branch starts exactly there, so **PR #28 can be fast-forwarded** to the EXT14 head. That is one PR to review, as in EXT13.
- **Size against `main`:** 517 files changed, +56,487 / −8,765 lines (EXT13 alone: 497 files, +47,706 / −2,372). Most of the size is tests (164 files) and docs (190 files). The 145 screenshot files are images.
- **Splitting into stacked PRs was considered and not recommended.** The parts depend on each other: the moved program file needs the test plumbing, CI needs the SQL lint, and the staging build needs the moved program file. Splitting would mean 4–5 PRs, each needing your approval with a stale-approval reset, for no extra safety. If you prefer smaller reviews, the natural cut is: (a) code + tests, (b) SQL package, (c) CI, (d) docs. Tell Claude and it will prepare them.

### Reviewer manifest (what to look at, in order)

| # | Look at | Why | Time |
|---|---|---|---|
| 1 | `ENGINEERING_REPORT_EXT14.md` §1 | what changed, in plain English | 5 min |
| 2 | `.github/workflows/ci.yml` (top comment) | confirms tests only, no secrets, no deploy | 5 min |
| 3 | `owner-login.html` diff (head and end of body) | the program is now one `<script src>` line | 5 min |
| 4 | The staging copy (`npm run staging:build`, or ask Claude for screenshots) | see the dashboard on fake data with the scenarios | 15 min |
| 5 | `CURRENT_PLATFORM_STATE_EXT14.md` | nothing claims production | 5 min |

## 6. Deployment instructions for Stas (only when you decide to)

1. On GitHub open draft PR #29 (EXT1–14; it contains everything in #28). Check that the description says the tests passed.
2. Press **Ready for review**, then **Review changes → Approve**. (Claude cannot approve or merge; you are the only approver.)
3. Press **Merge pull request** → **Confirm**.
4. Wait 5 minutes. Open the live dashboard in a Private Window (or hard-refresh with Cmd+Shift+R).
5. Check:
   - you can sign in;
   - Home shows its cards;
   - Orders, Inventory and Tasks open;
   - System status shows "Environment: PRODUCTION".
6. If anything differs: do not change anything else. Use §4 and tell Claude what you saw (a screenshot helps).

## 7. Known limitations

- No real Safari or real iPhone test. Chromium at iPhone size only.
- CI is unproven on GitHub's machines until merged (it was run locally as `npm run ci:local`).
- Actions are pinned by tag, not SHA.
- The program is still one 560 KB file (split roadmap M7).
- Inline styles are still allowed (325 of them).
- Production state of every database step remains UNKNOWN until you run Query C.
