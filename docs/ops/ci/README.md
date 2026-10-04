# Tests-only CI: design (DRAFT, not active)

**File:** `tests-only.yml.draft`. It is **inactive**: GitHub runs workflows only from `.github/workflows/`. Activating it means moving the file there in its own reviewed PR, which needs owner approval.

## Guarantees

| Requirement | How |
|---|---|
| No secrets | The workflow references no `secrets.*`. Its token has `contents: read` only. `checkout` keeps no credentials (`persist-credentials: false`). |
| No deployment | There is no deploy, Pages or release step. GitHub Pages keeps deploying from `main` exactly as today; this workflow doesn't touch it. |
| No production contact | The tests use the repo's Supabase mock. Any request to a non-mock host is blocked, and the test fails (`tests/specs/safety.spec.js`). |
| Supply chain | Actions are pinned to exact commit SHAs. `npm ci --ignore-scripts` installs exactly what `package-lock.json` lists, without running package install scripts. |
| Safe for forks | Trigger is `pull_request`, never `pull_request_target`, so code from a fork can't reach a privileged token. |
| Cost | Public repository: GitHub-hosted runners are free. About 3–6 minutes per run. |

## Expected results after the PR stack merges

The full simulation (all 20 PRs merged in the recommended order) ran the whole suite locally. See `docs/ops/pr-merge-order.md` for the counts.

## Later (owner decision)

- Make the check **required** in the `protect-main` ruleset, so a PR can't merge while tests fail.
- Keep the visual snapshot tests (PR #15) informational at first. Font rendering on GitHub's runners can differ from local runs.
