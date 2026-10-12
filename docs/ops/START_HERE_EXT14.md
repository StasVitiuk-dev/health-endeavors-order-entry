# START HERE (EXT14)

**AUTHORITATIVE AS OF:** 2026-10-12 · dashboard code frozen at `3a40095` (branch `claude/platform-ext14-deep-engineering-2026-10-11`) · live `main` `d3db7bc`.
**SUPERSEDES:** `START_HERE_EXT13.md` for the code and engineering state. For owner actions it still points to the EXT13 owner documents: EXT14 changed nothing about what Stas needs to do.

## Where we are (five lines)

1. The live dashboard is **unchanged**. Nothing has been merged, deployed or run on production.
2. EXT14 was an **engineering round**: the main page's program moved into its own file, automatic GitHub tests were built (inactive until merged), the SQL package was organized and machine-checked, a private staging copy got 12 scenarios, and 6 real problems were fixed.
3. All work (EXT1–EXT14) is in the EXT14 branch. It is in **draft PR #29**, which contains everything in #28 (see `RELEASE_REVIEW_EXT14.md` §5).
4. Production readiness is still about **15 / 100**. Only production evidence moves it.
5. Your next steps are the same as in EXT13: backup look, GitHub reconnect, read-only session, review and merge.

## Open this first

- **What needs you:** `OWNER_ATTENTION_SESSION_EXT13.md` (unchanged).
- **What EXT14 changed and why:** `ENGINEERING_REPORT_EXT14.md` §1 (one page, plain English).
- **Is it safe to merge, what to click, how to undo:** `RELEASE_REVIEW_EXT14.md`.

## Then, only if you need it

| Question | File |
|---|---|
| Exact state of everything, by area | `CURRENT_PLATFORM_STATE_EXT14.md` |
| Machine-readable status (what is merged / installed / switched) | `STATUS_MANIFEST_EXT14.json` (`npm run status:check`) |
| The automatic tests on GitHub | `CI_GUIDE_EXT14.md` |
| Screenshot rules | `SCREENSHOT_POLICY_EXT14.md` |
| SQL files: purpose, order, rollback | `docs/ops/sql/MANIFEST.json` (`npm run sql:graph`) |
| Matrices, data model, backlog, training (unchanged except dated corrections) | `PLATFORM_MATRICES_EXT13.md`, `DATA_MODEL_DICTIONARY_EXT13.md`, `POST_LAUNCH_BACKLOG_EXT13.md`, `OPERATIONS_HANDBOOK_EXT13.md` |

## Tools (local; they connect to nothing)

```bash
npm install                 # once
npm test                    # whole suite (desktop + iPhone size)
npm run ci:local            # the same checks GitHub will run
npm run sql:lint            # SQL safety checks
npm run status:check        # status manifest is honest
npm run staging:build       # private staging copy + zip (synthetic data, offline)
npm run docs:check          # every file and command named in the owner docs exists
```
