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
