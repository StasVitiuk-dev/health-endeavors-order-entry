# Tests-only CI (review-ready, NOT active)

**Files:**
- **The draft:** `tests-only.yml.draft` (this folder). Inactive: GitHub runs workflows only from `.github/workflows/`.
- **The ready branch:** `claude/tests-only-ci`, based on `main`, containing exactly one new file: `.github/workflows/tests.yml` (the same content).
  - No PR has been opened, so nothing runs. Confirmed: 0 Actions runs for that branch.
  - Activation = the owner opens a PR from that branch and merges it.

## Guarantees

| Requirement | How |
|---|---|
| No secrets | No `secrets.*` reference. Token permission `contents: read` only. Checkout keeps no credentials (`persist-credentials: false`). |
| No deployment | No deploy, Pages or release step. GitHub Pages keeps deploying from `main` exactly as today. |
| No production contact | The tests use the repo's Supabase mock; any outside request fails the test (`safety.spec.js`, `no-live-send.spec.js`). |
| Supply chain | Actions pinned to commit SHAs (checkout v7.0.1, setup-node v7.0.0, upload-artifact v7.0.1). These are lightweight tags, so the SHA is the commit. `npm ci --ignore-scripts` installs exactly `package-lock.json`. |
| Safe for forks | `pull_request`, never `pull_request_target`. |
| Stable required check | The `playwright` job runs every behaviour test with `--ignore-snapshots`. Pixel comparisons run in a separate `visual` job with `continue-on-error`, because fonts on GitHub's runners can differ from the recorded baselines. |
| Clear failures | `--reporter=list,github` (line annotations). Screenshots and traces of the synthetic session are uploaded on failure for 7 days. |
| Cost | Public repository: GitHub-hosted runners are free. About 10–20 minutes per run (the full suite takes about 15 minutes locally on 2 workers). |

## Validated locally (2026-10-05)

- YAML parses; 2 jobs; `permissions: {contents: read}`; 0 `secrets.` references; 0 write permissions; all 6 `uses:` pinned to 40-character SHAs.
- `npm ci --ignore-scripts` on a clean copy of `package.json` + `package-lock.json`: installs, with 0 vulnerabilities reported.
- `npx playwright test --config tests/playwright.config.js --ignore-snapshots --reporter=list,github` works (52 tests in a sample run; the GitHub summary line is printed).

## Owner decisions

1. Merge the workflow (open a PR from `claude/tests-only-ci`).
2. Then make the `Playwright (behaviour)` check **required** in the `protect-main` ruleset.
3. Later: make `Screenshots` required once it is stable on GitHub's runners.

## Re-review (2026-10-06)

The branch is unchanged: commit `662d46b`, one file. It matches the draft here line for line except the opening comment (the draft's says "DRAFT — NOT ACTIVE"; the branch's says where the docs are). Checked with `diff`. Re-checked:
- **YAML structure:** triggers `pull_request` (to `main`) and `workflow_dispatch` only. `permissions: {contents: read}` at the top; neither job widens it. 0 `secrets.` references, no `pull_request_target`, no write steps, no deploy/Pages/release step.
- **Deterministic:** Playwright pinned by `package-lock.json` (1.56.1); `npm ci --ignore-scripts`; Node 22.
- **Runtime:** the suite has grown to 724 tests (desktop + iPhone). That's about 13–15 minutes locally on one machine, inside the 40-minute job limit.
- **New tests need nothing extra.** The 2026-10-06 additions (database-rule checks, storage, scale, empty-database, a second XSS pass) use the same mock: no network, no secrets, no database.
- **Not in CI, by design:** the SQL draft tests and the stress test need a local PostgreSQL. They are run by hand (`docs/ops/stress-test-results.md`).
- **To verify before merging:** that the three pinned SHAs match the stated release tags on GitHub. That's a one-time look at each action's release page. Not done from this session, which only reads this repository.

## What happens if the owner opens and merges the CI pull request

1. **Opening the PR** (from `claude/tests-only-ci` to `main`). GitHub runs the two jobs on that PR, using only the PR's own files. Nothing is deployed and nothing is written anywhere. The jobs show as checks on the PR. Merging that PR changes no dashboard file.
2. **After merging:**
   - every later pull request to `main` gets the same two checks automatically;
   - "Run workflow" (workflow_dispatch) can start them by hand;
   - **the live dashboard is unaffected**, because Pages keeps publishing `main` exactly as today.
3. **Nothing is required yet.** A failing check doesn't block merging until the owner adds `Playwright (behaviour)` as a required status check in `protect-main` (a settings change only the owner can make).
4. **Rollback:** delete `.github/workflows/tests.yml` in a PR (or revert the merge commit). No other state is created.
5. **Cost and limits:** public repository, so GitHub-hosted runners are free. Fork PRs still need your approval to run (current Actions setting).
