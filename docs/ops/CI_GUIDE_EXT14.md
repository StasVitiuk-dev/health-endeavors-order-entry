# CI guide (EXT14): automatic tests on GitHub

Status: **CURRENT, built in the branch only.** `.github/workflows/ci.yml` does nothing until Stas reviews and merges it. Merging it is a decision for Stas. The workflow only runs tests: it never deploys anything and never touches production.

## 1. In plain English

When someone opens a pull request, or pushes to a `claude/...` branch, GitHub runs the same tests Claude runs by hand: the dashboard tests (fake data, fake database), the SQL safety checks, the documentation checks, and the database tests on a throwaway PostgreSQL inside GitHub's machine. A red ✗ on the pull request means a test failed. Nothing is published and nothing reaches production either way.

## 2. What it can and cannot do

| | |
|---|---|
| Permissions | `contents: read` only (it can read the code, nothing else) |
| Secrets | none. The workflow uses no secret. The database password `ci-only-local` belongs to a throwaway database that exists only during the run |
| Deploy / Pages | no deploy step, no Pages step, no environment |
| Other repositories | none checked out |
| Production | never contacted. The test mock blocks every outside address, and the database runner refuses any Supabase host |
| Actions used | GitHub's own: `actions/checkout`, `actions/setup-node`, `actions/upload-artifact` (tag `@v4`; SHA pinning was not possible from here, see §6) |
| Artifacts | failure traces only (`test-results/`), kept 7 days |

`tests/specs/ci-guard-ext14.spec.js` fails the build if any of these changes (permissions, secrets, deploy steps, other repositories, non-GitHub actions, missing time limits, long retention).

## 3. Jobs

| Job | When | Time limit | What |
|---|---|---|---|
| `static` | always | 15 min | secret scan · SQL lint (`npm run sql:lint`) · status manifest (`npm run status:check`) · docs check (`npm run docs:check`) · Node-only specs |
| `browser` | unless the change is documentation only | 40 min × 3 shards | the full Playwright suite in 3 parts. Screenshot comparisons are excluded (they depend on fonts) |
| `database` | when SQL, its runners, the workflow or `package.json` changed | 30 min | `tests/tools/run-db-suite.sh` with `QUICK=1` on a `postgres:16` service |
| `visual` | as `browser` | 20 min | screenshot comparisons, **informational** (a red result here does not block) |

Change impact (`tests/tools/ci-impact.js`) is deliberately conservative: only Markdown outside the SQL folder, `design-review/` and doc images can skip the browser suite, and an unknown file runs everything.

## 4. Running the same thing locally

```bash
npm run ci:local                                         # static + browser suite
CI_PG="-h /var/tmp/hepg -p 5499 -U postgres" npm run ci:local   # + the database suite
CI_SKIP_BROWSER=1 npm run ci:local                       # static (+ database) only
```

## 5. Recommended required checks (OWNER DECISION REQUIRED, after merging)

Once the workflow has run green on `main` at least once, Stas may add these to the `protect-main` ruleset as required status checks. This is a settings change, so Claude does not make it:

- `Static, SQL safety, docs, tools`
- `Browser suite (shard 1/3)`, `(shard 2/3)`, `(shard 3/3)`
- `Local database suite (throwaway PostgreSQL)`

Do **not** require `Screenshots (informational)`.

A job skipped by change impact counts as passed for required checks. That is intended: documentation-only changes then do not wait for a 40-minute run.

## 6. Known limitations

- Actions are pinned by tag (`@v4`), not by commit SHA. This session could not read the `actions/*` repositories to look up SHAs (403). Pinning by SHA is a small follow-up PR.
- The browser suite takes about 40 minutes on a 4-CPU machine with 2 workers. On GitHub's runners the 3 shards should finish in about 15–20 minutes each (estimate, not yet measured on GitHub).
- The database job uses `QUICK=1`, which skips the slow stress and volume steps. The full run stays local: `npm run db:suite:local`.
- CI cannot check the live site, real devices, real Safari or production data. Those remain owner checks.
