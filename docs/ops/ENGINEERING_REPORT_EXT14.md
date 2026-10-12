# Engineering report: EXT14 (deep engineering debt burn-down)

Date: 2026-10-11 → 2026-10-12. Branch: `claude/platform-ext14-deep-engineering-2026-10-11` (from EXT13 `cc9a142`). Page code frozen at **`3a40095`**. **Not merged, not deployed, nothing run against production.** Everything here was measured on synthetic data, on a local PostgreSQL 16 or inside the test mock.

The labels below mean: **IMPLEMENTED IN BRANCH** (code exists and is tested here), **MEASURED LOCALLY** (a number from this machine), **NOT DONE** (with the reason).

## 1. Summary for Stas (plain English)

- **The dashboard's main page is now small and strict.** Its 9,500 lines of program moved from inside the page into their own file (`assets/owner-login-app.js`). The page itself shrank from 617 KB to 58 KB. The browser now refuses any script written into the page itself except one known small one (a stronger guard against injected code). If the program file fails to load, the page says so in plain words instead of sitting blank.
- **Automatic tests on GitHub are ready** (`.github/workflows/ci.yml`). They only run tests, have no secrets and cannot deploy. They do nothing until you merge them. See `docs/ops/CI_GUIDE_EXT14.md`.
- **6 real problems were found and fixed** (§9). The most important:
  - the diagnostic summary could copy a database value word for word;
  - the optional report-totals draft counted a missing order total as $0 without saying so;
  - the stock-function rollback did not refuse while a stock switch was on;
  - the repository's own secret check had been failing unnoticed since EXT12.
- **The SQL package is organized and machine-checked.** Every file is listed with its purpose, risk, dependencies and rollback, and a checker refuses unsafe SQL.
- **A private staging copy with 12 scenarios** can be built with one command and zipped. It works offline on fake data. It is not published anywhere.
- **Production readiness is unchanged (~15%).** Only evidence from production can move it.

## 2. Baseline → after (MEASURED LOCALLY)

| Metric | EXT13 baseline (`cc9a142`) | EXT14 (`a79bf2c`, page code `3a40095`) |
|---|---|---|
| `owner-login.html` | 10,330 lines, 617,378 bytes | 816 lines, 58,227 bytes |
| Owner page program | inside the HTML | `assets/owner-login-app.js` 9,513 lines, 559,819 bytes |
| All HTML / JS assets / CSS | 701,168 / 63,164 / 50,418 bytes | 142,017 / 623,470 / 50,739 bytes |
| Inline scripts allowed on owner page | `'unsafe-inline'` | none except one hashed boot line (`sha256-/FjR…`) |
| Tracked files / bytes | 505 / 31,355,536 | 525 / 30,762,400 |
| Screenshots | 146 PNG, 26,169,927 bytes, 6 identical copies | 140 PNG, 25,429,772 bytes, 0 copies |
| Spec files | 100 | 109 |
| Page + tool mutants | 169 (154 + 15) | 170 (155 + 15) |
| SQL mutants | 13 | 14 |
| CI | none | 4 jobs (static, 3 browser shards, database, informational visual) |
| Full suite (2 workers, 4 CPUs) | 41.7 min wall; 1,820 passed + 8 known-bug tests failing as expected, 1,048 skipped, **2 unexpected** (the secret check, §9.4) | 43.6 min wall; 1,895 passed + the same 8 known-bug tests, 309 skipped, 5 unexpected → all 5 fixed in tests/runner only (§7), page code unchanged |

## 3. Modularization (IMPLEMENTED IN BRANCH)

| Module | What | Loaded by |
|---|---|---|
| `assets/owner-login-theme.js` | dark/light theme before first paint | `<head>` |
| `assets/owner-login-helpers.js` | pure helpers, API 9 (`window.HE.helpers`) | before the app |
| `assets/owner-login-app.js` | the whole owner dashboard program (one `initApp` closure) | end of `<body>` |
| `assets/owner-login.css` | styles, including the "program did not load" message | `<head>` |

- **Globals:** the page script creates only `window.toastOk` / `window.toastErr` (used by inline handlers), plus the Supabase library's own `window.supabase` and the helpers' `window.HE`. Everything else stays inside the closure.
- **Init isolation:** the first statement of the app removes the "not loaded" message. A feature that throws during start-up shows in `#scriptError` while the dashboard stays usable.
- **Module failure tests** (`tests/specs/assets.spec.js`, 4 new):
  - app file missing (404) → plain message;
  - message gone once the app runs;
  - syntax error in the app → message;
  - one feature throwing → error box, dashboard still visible.
- **Cache safety:** every asset is referenced with `?v=<first 10 hex of its sha256>`, so a browser never mixes an old page with a new program.
- **Test plumbing:** `tests/helpers/page-source.js` hands every static check the HTML **plus** its scripts. Two old checks (hard walls, no live send) had been reading the HTML only since EXT10 and so missed the moved scripts. That gap is closed.
- **NOT DONE: splitting the 9,500-line closure into several files.** The closure shares about 300 variables between features. Splitting it safely needs either a bundler or turning those into explicit module interfaces. Both are larger than one round and cannot be proven safe by the current tests alone. Roadmap: `MODULARIZATION_ROADMAP.md` (M6 onward).

## 4. Database package (IMPLEMENTED IN BRANCH; MEASURED LOCALLY) {#DB}

### 4.1 Organization and checks

- `docs/ops/sql/MANIFEST.json` lists all 36 SQL files: class, step, dependencies, risk, rollback, precheck, effect, postcheck, dynamic-SQL justification, lock notes.
- `npm run sql:lint` (`tests/tools/sql-lint.js`) checks every file against the manifest:
  - names, warning banners, read-only files that really are read-only;
  - transactions, no `SECURITY DEFINER`, pinned `search_path`;
  - no UPDATE/DELETE without WHERE, `DROP … IF EXISTS`, no grants to public/anon, no TRUNCATE;
  - dynamic SQL must be justified;
  - rollback pairs, dependency order, no cycles.
- `npm run sql:headers` writes each file's metadata header from the manifest. `npm run sql:graph` prints the install order `10 → 21 → 17 → 23 → 19 → 27 → 25 → 29 → 13` and the rollback order.
- Local test SQL that sat beside the production drafts (12, 14, 15, 16) moved to `docs/ops/sql/local-test/draft-tests/`. `drafts/` now holds only install and rollback files, and a test keeps it that way.
- `drafts/13` now has a rollback, `drafts/31` (8/8 lifecycle checks).

### 4.2 CHECK constraints at volume (drafts/23)

| Rows | ADD CONSTRAINT | ADD … NOT VALID | VALIDATE |
|---|---|---|---|
| 10,000 | 52 ms | 87 ms | 68 ms |
| 50,000 | 73 ms | 95 ms | 115 ms |
| 100,000 | 107–299 ms | 57–63 ms | 106–136 ms |

A writer waiting during ADD was blocked about 1.3 s (the lock is held until commit). During VALIDATE it waited 0.09–0.23 s. The cost per row update afterwards is within noise. **Decision:** draft 23 is fine at today's size. At millions of rows, use NOT VALID + VALIDATE (recorded in the manifest).

### 4.3 Query plans and index candidates (50,000 synthetic rows)

| Query | Sequential scan | With candidate index |
|---|---|---|
| newest orders | 17 ms | 0.22 ms (1 MB) |
| order lookup by text | 36 ms | 0.30 ms (trigram GIN, 2.4 MB) |
| expenses by date | 8.9 ms | 0.9 ms |
| stock history per product | 17.7 ms | 3.9 ms (8 MB) |
| open tasks | 6 ms | 0.34 ms |
| approvals queue | 3 ms | 0.63 ms |

Query F (duplicates) takes 43 ms. Insert cost with the indexes is within noise. **Decision:** no index draft now. Real tables are far smaller, and an index is a production change. The candidates and the size at which each pays off are recorded in `docs/ops/sql/local-test/index_plan_review.sh`.

### 4.4 Request keys at scale (drafts/19)

Lookup by key: 0.051 ms at 10k rows (424 kB index), 0.078 ms at 100k (4.3 MB), 0.138 ms at 1M (38 MB). A repeated key was refused every time, and the keys were distinct.

### 4.5 R1–R5 stress

- 10 / 25 / 50 concurrent callers: 28/28 checks, 0 deadlocks (seed 18743).
- Seeds 1–3 at 50 / 100 callers: 20/20 each, 790 calls, 0 deadlocks.
- Fingerprint unchanged: `3df2bf7a07b451f12f9359ceca1c85df`.

### 4.6 One command

`npm run db:suite` builds the local real-shape database from scratch and runs 26 steps. Result: 26/26 PASS in 776 s. `QUICK=1` skips the volume steps (that is what CI runs). The runner refuses Supabase hosts.

## 5. CI (IMPLEMENTED IN BRANCH, not active until merged)

See `docs/ops/CI_GUIDE_EXT14.md`. In short: least privilege (`contents: read`), no secrets, no deploy, GitHub-made actions only, conservative change impact, `npm run ci:local` as the local equivalent. `tests/specs/ci-guard-ext14.spec.js` holds 8 guard tests.

## 6. Staging artifact (IMPLEMENTED IN BRANCH; private, not published)

`npm run staging:build` writes `staging-build/` and `staging-build.zip`:

- synthetic data only;
- the production address and key replaced, and every output file checked for production traces;
- the Supabase library bundled offline under the page's integrity hash;
- a permanent NOT PRODUCTION banner, and a dev-only scenario selector.

There are 13 scenarios (default + 12), such as: healthy, integrity failure, agents unknown, PO reply lost, stale edit, permission denied. Scenarios that inject a failure record it in `window.__STAGING_EVENTS`, and the tests prove each one really fired (`staging-artifact-ext14.spec.js`).

## 7. Test suite speed

- **Baseline (EXT13, idle machine, 2 workers):** 41.7 min wall. 4,890 s of test time, of which 174 s was spent starting tests only to skip them.
- **Slowest:**
  - search palette at 10,000 records: 63.5 s;
  - resource-leak sweep: 29.8 s;
  - 5,000-product inventory: 24.7 s;
  - phone layout sweeps: about 22 s each.
- **Change:** the iPhone project no longer loads the 48 spec files that skip every test off desktop. They are detected from the file text, and `test-config-ext14.spec.js` guards the rule. The skipped count therefore drops by about 800. That is not lost coverage: those tests never ran on the iPhone.
- **CI** splits the browser suite into 3 shards.
- **After (final run on page code `3a40095`, idle machine):** 43.6 min wall, against 41.7 min before (+4.6%). 75 more tests ran (+96 s of test time). Time lost to skipped tests fell from 174 s to 69 s. Tests present in both runs took 4,614 s against 4,369 s (+5.6%), within run-to-run variation on this machine but not proven to be noise. **Honest result: no wall-clock improvement locally.** The real gain is in CI, where the 3 shards run in parallel.
- **The 5 unexpected failures in that run** were all test-side and are fixed:
  - `library-pin` expected the old inline error flag that the strict owner page no longer has;
  - the XSS control expected injected code to run, but the strict script policy now stops it (asserted as new defence in depth);
  - the mutation runner's Ctrl-C test exposed a real runner bug under load: an interrupted run could end normally. The runner now awaits test runs and stops at once.
- **NOT DONE: more workers by default.** Raising workers above 2 on a 4-CPU machine made timing-sensitive tests unreliable in earlier rounds, and was not re-proven here. CI gets its parallelism from shards instead.

## 8. Money precision {#money}

The pages add money as JavaScript numbers and round to whole cents only for display and CSV (`fmtMoney`). `tests/specs/money-precision-ext14.spec.js` proves:

- a worst-case bound: exact at least up to 250,000 orders with a $50M running total;
- 5 seeded ledgers of 200,000 sales and refunds that match an exact whole-cent sum;
- adversarial patterns (0.1 + 0.2, refunds cancelling to exactly $0.00, half cents).

The limit is pinned: beyond about 1M orders with a $100M total, the guarantee no longer holds. Summing in whole cents would be the fix then. Not needed at this business's size. SQL drafts use `numeric` (exact).

## 9. Bugs and gaps found and fixed in EXT14

1. **Diagnostic summary copied the database role value word for word.** Found by the new redaction fuzz test (3 of 6 seeds leaked planted text). Only known role words are copied now. Mutant 170 restores the bug and is caught.
2. **`drafts/13` (optional report totals) counted a missing order total as $0** and did not report it. It no longer sums missing totals into revenue and reports `orders_missing_total`. The test was tightened with `coalesce` (the old test passed because NULL <> 1 is not true). New rollback `drafts/31`.
3. **`drafts/11` (R1–R5 rollback) did not refuse while a stock switch was on.** The EXT13 matrix claimed it did. It refuses now, and the check works on databases without the switch table. A new SQL mutant (14th) removes the guard and is caught.
4. **The repository's own "no secrets in test files" check had failed since EXT12.** A fake payment key sat in a test sample. The EXT12/EXT13 verification runs used subsets that did not include `safety.spec.js`. The fakes are now assembled from pieces, so the scan stays strict. CI now runs this spec on every change.
5. **Coverage gap since EXT10:** two static checks (hard walls, no live send) read only the HTML, not the scripts moved out of it. They read both now.
6. **The staging build would have leaked the production address/key through the moved program file.** Every output file is scrubbed and checked now, and the build deletes itself if a trace remains.

Also fixed in the test machinery:

- `14_DRAFT_tests` left its data behind (the draft's own COMMIT);
- `drafts/20` was missing its warning line;
- the mutation runners could leave a stray worktree or temporary database after Ctrl-C, and could count an interrupted run as a missed mutant (§10).

## 10. Test machinery robustness

- **Page mutation runner:** the scratch folder must be outside the repository and carry a marker before anything is deleted. Ctrl-C removes the worktree. An interrupted test run is never counted as a missed mutant. Progress is saved after each mutant, and the real working tree is fingerprinted before and after. 4 tests, including a real Ctrl-C.
- **SQL mutation runner:** refuses Supabase hosts, cleans up on interrupt, and fingerprints all SQL files before and after.
- **Screenshot policy** (`SCREENSHOT_POLICY_EXT14.md`): no identical copies, every file listed in its manifest, 1.5 MB per file at most.
- **Status manifest** (`STATUS_MANIFEST_EXT14.json`, `npm run status:check`): a production claim without dated production evidence is refused, and so is a switch ON before its step is installed. Production readiness cannot move without production evidence. 11 negative controls.

## 11. Decisions recorded (not implemented, with reasons)

| Item | Decision | Why |
|---|---|---|
| Server-side pagination pilot | NOT DONE | The Activity/audit page already pages on the server (500 per call). Totals read every record in pages of 1,000 and refuse to show a total when a read comes back short. At today's volume a page-by-page UI would add risk for no gain. Revisit above about 5,000 orders. |
| Index drafts | NOT DONE | §4.3: tables are small, and an index is a production change. Candidates are recorded. |
| Splitting the app closure | NOT DONE | §3: cannot be proven safe in one round. |
| Rewriting git history to drop old screenshots | NOT DONE | Needs a force push; forbidden. |
| SHA-pinned actions | NOT DONE | The `actions/*` repositories cannot be read from this session (403). |

## 12. Remaining engineering debt

| # | Item | Status |
|---|---|---|
| 1 | Large page | **Improved** (HTML 617 KB → 58 KB); the program is still one 560 KB file |
| 2 | drafts/13 rollback | **Fixed** (`drafts/31`) |
| 3 | CHECK at volume | **Investigated** (§4.2), guidance recorded |
| 4 | Local tests beside drafts | **Fixed** |
| 5 | Slow suite | **Partly**: iPhone skips removed, CI shards; still about 40 min locally |
| 6 | No CI | **Built**; active only after merge |
| new | `style-src 'unsafe-inline'` (325 inline styles) | open |
| new | Actions pinned by tag, not SHA | open |
| new | Float sums beyond about 250k orders | recorded limit (§8) |
| new | Diagnostic summary "Page version" names the helpers and styles but not the program file (`owner-login-app.js`) since the move | open, low; found after the code freeze, left for the next round so the frozen code stays tested |
