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
| `browser` | unless the change is documentation only | 40 min × 4 shards | the full Playwright suite in 4 parts (3 until Nov 26, 2026, when one part reached 39 of its 40 minutes). Screenshot comparisons are excluded (they depend on fonts) |
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
- `Browser suite (shard 1/4)`, `(shard 2/4)`, `(shard 3/4)`, `(shard 4/4)` (named `…/3` until Nov 26, 2026)
- `Local database suite (throwaway PostgreSQL)`

Do **not** require `Screenshots (informational)`.

### Why "Screenshots (informational)" is red, and how it gets green (Nov 27, 2026)

Status: CURRENT. The check has failed on every pull request since the reference pictures were retaken on
Nov 23 (20 of 20 pictures, each 3–4% of its pixels and a few pixels of height). **Cause:** the reference
pictures were made on a developer machine with Chrome 153; CI uses the Chromium that Playwright 1.56.1
pins (package-lock), on ubuntu-24.04. Both use the Liberation fonts, but the two browser builds wrap text
slightly differently, so every page comes out a few pixels taller or shorter. It is an environment
difference, not a change in the dashboard; it still means the check catches nothing today, and it stays
red until the pictures are made in CI.

**The fix (pull request "Screenshots: make the reference pictures where CI checks them"):** every run of
the job now keeps the expected / actual / difference pictures as a downloadable file
(`screenshots-<commit>`, 7 days); and the workflow can be started by hand with **update_screenshots**,
which makes new reference pictures in CI's own pinned environment and keeps them in the same file. Nothing
is committed automatically. Steps once that pull request is merged:

1. GitHub → **Actions** → **Dashboard CI** → **Run workflow** → choose the branch → tick
   **update_screenshots** → **Run workflow**.
2. When it finishes: open the run → **Artifacts** → download `screenshots-<commit>`.
3. Look at every picture (they must show the pages as they are today), then commit the files in
   `tests/specs/visual.spec.js-snapshots/` in a pull request. The next normal run should then be green.

Not done, on purpose: no larger tolerance, no skipped test, no picture retaken on a developer machine.

A job skipped by change impact counts as passed for required checks. That is intended: documentation-only changes then do not wait for a 40-minute run.

## 6. Known limitations

- **Nov 27, 2026:** three times (#134, #136, #137) a browser shard stopped before any test, because GitHub's runner image lists Microsoft's package source and that source answered `403 Forbidden` ("is no longer signed") while Playwright installed the browser's system packages. The tests never use that source, so the browser and screenshot jobs now remove it before the install (one `grep … | xargs -r sudo rm -f` line; it does nothing when the source is not there).

- Actions are pinned by tag (`@v4`), not by commit SHA. This session could not read the `actions/*` repositories to look up SHAs (403). Pinning by SHA is a small follow-up PR.
- The browser suite takes about 40 minutes on a 4-CPU machine with 2 workers. On GitHub's runners the 3 shards took about 13–16 minutes each in October; by Nov 26, 2026 they took 24–39 minutes, so the suite was split in 4 (expected about 20–30 minutes each).
- The database job uses `QUICK=1`, which skips the slow stress and volume steps. The full run stays local: `npm run db:suite:local`.
- CI cannot check the live site, real devices, real Safari or production data. Those remain owner checks.
