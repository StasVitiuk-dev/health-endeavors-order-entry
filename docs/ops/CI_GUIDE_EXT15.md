# CI guide (EXT15): automatic tests on GitHub

Status: **CURRENT on the feature branch only.** Supersedes `CI_GUIDE_EXT14.md` for everything below; §2–§5 of the EXT14 guide (what CI can and cannot do, jobs, recommended required checks) still apply unchanged. The workflow `.github/workflows/ci.yml` only runs tests. It never deploys, has no secrets, and has only `contents: read`. GitHub already runs it on every push to a `claude/...` branch and on pull requests (it runs from the branch's own copy of the file); merging it only makes it run on `main` too.

## 1. In plain English

EXT15 made the automatic checks harder to fool and faster to finish:

1. **Actions pinned to exact versions.** The three GitHub-made helpers the workflow uses are now named by their exact, unchangeable commit fingerprint instead of a moving label (`@v4`). A moving label can be pointed at different code later; a fingerprint cannot.
2. **Three new safety checks** run on every change: the module graph, "no inline styles left", and a type-check gate.
3. **Fairer test split.** The browser tests run in 3 parallel parts. They used to be split by number of files; now they are split by how long each file actually takes, so no part waits for a much slower one.
4. **Traps.** A new test plants a problem in a copy of the files for every new check and proves the check catches it.

## 2. Pinned actions (verified, not guessed)

| Action | Pinned to | Version | How verified |
|---|---|---|---|
| `actions/checkout` | `11d5960a326750d5838078e36cf38b85af677262` | v4.4.0 | `git ls-remote https://github.com/actions/checkout` on 2026-10-12: the `v4` and `v4.4.0` tags point to this commit |
| `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | v4.4.0 | same, `actions/setup-node` |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | v4.6.2 | same, `actions/upload-artifact` |

Each line in the workflow carries a comment with the version and the date it was checked. `tests/specs/ci-guard-ext14.spec.js` fails if any `uses:` is not a 40-character fingerprint of a GitHub-made action with that comment.

**Updating later:** run `git ls-remote https://github.com/actions/<name> refs/tags/v4*`, take the commit of the newest `v4.x.y` tag, replace the fingerprint and the comment. Never type a fingerprint from memory.

## 3. New steps in the `static` job

| Step | Command | Fails when |
|---|---|---|
| Module graph | `node tests/tools/app-modules.js` (`npm run app:modules`) | a module is not loaded, created twice, out of order, in a cycle, or uses a name it did not ask for |
| No inline styles | `node tests/tools/inline-styles.js --check` (`npm run styles:check`) | a `style="…"` appears on the owner page, its program or modules, or the generated CSS block is stale |
| Type-check gate | `node tests/tools/typecheck.js --gate` (`npm run types:check`) | the TypeScript checker (on plain JavaScript, nothing compiled) finds a gated problem: unknown name, unreachable code, fall-through, impossible comparison, wrong argument count, unused variable |

The type check covers the registry, helpers and the 16 modules (18 files): **0 gated findings**, 30 reported-only findings (mostly "property does not exist" on DOM elements, which needs type annotations to silence; see `ENGINEERING_REPORT_EXT15.md`). The program file itself is not gated yet.

## 4. Balanced shards

- `tests/ci-durations.json` holds the measured test time per spec file (desktop + iPhone, from the EXT14 final full run).
- `node tests/tools/ci-shards.js --list 2/3` prints the files of shard 2 (longest files first, each to the currently lightest shard). `--plan 3` shows the estimate: **~29.5 / 29.5 / 29.5 minutes** of test time, against ~33.2 / 25.5 / 27.1 for the old count-based split. The slowest shard decides when CI is done, so the estimated wall time improves by about 11%.
- A spec file without a recorded time gets the median, so a new file can never be dropped (trap test in `ci-traps-ext15.spec.js`).
- Refresh after big test changes: `PLAYWRIGHT_JSON_OUTPUT_NAME=r.json npx playwright test --config tests/playwright.config.js --reporter=json` then `node tests/tools/ci-shards.js --record r.json`.

## 5. Caching

`actions/setup-node` already caches the npm download cache (`cache: npm`, keyed on `package-lock.json`). The Playwright browser download (~170 MB) is **not** cached: caching it would need `actions/cache`, a fourth action, and the gain (about 30–60 s per shard) is small next to the ~10-minute shard. Decision: **not added** (PROPOSED for later if CI minutes matter).

## 6. Traps (`tests/specs/ci-traps-ext15.spec.js`)

Control: all three new checks pass on an unmodified copy. Then each planted problem must make its check fail with the right message: inline style in a module, inline style in the page, hidden module dependency, module file not loaded, module created twice, unused variable (type gate), and shard coverage with a new untimed file. Existing traps from EXT14 still run: planted secrets (`ci-guard-ext14`), unsafe SQL (`sql-package-ext14`), production traces in a staging build (`staging-artifact-ext14`, `staging-ext15`), CSP `'unsafe-inline'` (page mutation).

## 7. Running the same thing locally

```bash
npm run ci:local                                                 # static + browser suite
CI_PG="-h /var/tmp/hepg -p 5499 -U postgres" npm run ci:local    # + the database suite
CI_SKIP_BROWSER=1 npm run ci:local                               # static (+ database) only
```

`npm run db:suite` was renamed `npm run db:suite:local` so nobody mistakes it for a production command.

## 8. Known limitations

- **Found in EXT15:** on PR #29 every CI run since the workflow was added was red. The `static` job ran `safety.spec.js` in its Node-only step, but that spec starts a browser and the `static` job installs none ("Executable doesn't exist"), so the browser shards were skipped every time. Fixed on both branches: the step now lists only Node-only specs, a guard test (`ci-guard-ext14.spec.js`, last test) fails if a browser spec is added there, and `npm run ci:local` hides the browser for that step so the local run matches CI. The EXT14 reports' "CI ready" was not checked against GitHub's actual runs; it is now.
- **Also found in EXT15:** the browser job checked out only the latest commit, so the module move proof could not see `3a40095` (fixed: full history); and the intermittent database failure was the stress test's 200 callers hitting the CI database's 100-connection limit (fixed in the harness; see `ENGINEERING_REPORT_EXT15.md` §5).
- Measured on GitHub (`3980d99`): static ~45 s, browser shards 766 / 940 / 781 s, database 517 s, screenshots 86 s. The duration-balanced shards finish within ~3 minutes of each other.
- One offline-bar check failure on shard 2 (`079f378`) did not repeat: **OPEN INTERMITTENT**.
- Pinned fingerprints do not update themselves. Dependabot for actions would need a repository setting (**OWNER DECISION**, not done).
- The `visual` job stays informational (fonts differ between machines).
