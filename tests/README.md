# Dashboard regression tests

These are automated browser tests for the owner dashboard (`owner-login.html`). Claude runs them before showing you any dashboard pull request, so old bugs don't come back unnoticed.

## Safe by design

- **The dashboard never reaches the real Supabase.**
  - Every request to the Supabase project is caught inside the test browser and answered from made-up data in `fixtures/synthetic-data.js` (see `helpers/mock-supabase.js`).
  - Every other internet address is blocked.
  - If anything ever tries to get out, the test fails.
- **No real data or secrets.** There are no real customers, orders, employees, passwords or keys. A test (`specs/safety.spec.js`) scans these files to make sure it stays that way.
- **No Shopify, no Gmail, no GitHub Actions.** The tests run only on the computer where you start them.
- **The live dashboard is not changed.** These files sit next to the dashboard, but none of the dashboard pages load them.

## What's covered

| File | What it checks |
| --- | --- |
| `specs/general.spec.js` | Login; the dashboard loads with no JavaScript errors; every sidebar page opens; the last page is remembered; search; sign out; no sideways overflow; desktop (1100px) and iPhone (390px) layout |
| `specs/tasks.spec.js` | Task buttons v2: which buttons show; all three status moves; the "Mark done" confirmation; Cancel sends nothing; double-clicks and in-flight clicks send one update; stale-state protection; errors; only the `status` field is sent; buttons don't jump under the cursor; changes survive a reload |
| `specs/mobile-tasks.spec.js` | On an iPhone-sized screen, task buttons are fully visible without sideways scrolling, big enough to tap, and work when tapped |
| `specs/safety.spec.js` | The production Supabase address is answered by the mock; other sites are blocked; only the synthetic session is used; no secrets or real emails in test files |

Every test in `general`, `tasks` and `safety` runs twice: once at desktop size and once at iPhone size.

Since then the suite has grown to about 40 spec files (724 tests on the overnight branch). Each file's header says what it covers. Highlights:

| File | What it checks |
| --- | --- |
| `specs/state-machine.spec.js` | Every status/category the page can write (dropdowns, status maps, transition buttons, literals) is one the real database accepts; no backwards transitions; the fixtures obey the rules |
| `specs/double-submit-stale.spec.js`, `inventory-safety`, `ops-findings`, `failure-recovery` | Stale tabs, double clicks, retries, dropped connections, silent row-level-security refusals |
| `specs/storage-safety.spec.js` | Uploads never leave orphaned files and never delete the file of a saved record; size/type checks |
| `specs/report-totals.spec.js`, `scale-urls.spec.js` | Totals beyond 1,000 rows; long id lists split so no URL is too long |
| `specs/xss-everywhere.spec.js`, `csv-export-guard.spec.js` | Hostile text in every field is shown as text on every page; CSV formula injection |
| `specs/empty-database.spec.js`, `a11y-basics.spec.js` | Every page on empty data; accessible names, unique ids, phone tap targets |

## The mock enforces the real database's rules

`helpers/db-constraints.js` holds the value rules from the owner's read-only schema check (Query A): allowed statuses and categories, `>= 0` / `> 0` numbers, required columns.
- **Refused writes.** The mock refuses any write that breaks one, exactly as Supabase does (HTTP 400, code 23514). The shared setup (`helpers/dashboard.js`) then fails the test.
- **Impossible data.** The same happens if a test's data ends in a state the real database couldn't hold.

A test that seeds impossible data on purpose (only the XSS test) sets `backend.allowImpossibleData = true`. When the real rules change, update `db-constraints.js` first.

## How to run (for Claude or a developer)

You need Node.js 18 or newer.

```bash
npm install          # one time: installs the test tool and a local copy of the Supabase library
npm test             # runs everything, desktop and iPhone
```

Useful variations:

```bash
npx playwright test --config tests/playwright.config.js --project desktop     # desktop only
npx playwright test --config tests/playwright.config.js -g "Mark done"         # tests whose name matches
npx playwright test --config tests/playwright.config.js --repeat-each 5        # flakiness check
```

A failing test saves a screenshot and a trace under `test-results/`. Open a trace with `npx playwright show-trace <path>`.

If Playwright asks you to install a browser, run `npx playwright install chromium` once.

## Adding tests for a new change

1. Add any synthetic rows you need to `fixtures/synthetic-data.js`. Keep names obviously fake ("SYNTHETIC …") and emails ending in `.test`.
2. Write the test in `specs/`. Use `login(page)` and `gotoPage(page, 'somePanel')` from `helpers/dashboard.js`.
3. `backend.requests`, `backend.taskUpdates()` and `backend.tableWrites()` show exactly what the page asked the "database" to do.
4. Use only values the real database accepts (see `helpers/db-constraints.js`), or the shared setup fails the test.
5. For stateful flows use `enableWrites(backend, [tables])` from `helpers/stateful-backend.js`. Then `dropNext` / `failNext` / `beforeNext` simulate a dropped connection, an error, or another person changing data in between.

## What these tests can't check

- Real row-level security, triggers and the `audit_log` in Supabase. That needs a real (test) database, and the mock is not one.
- Real Safari on a real iPhone. These tests use Chromium at iPhone size.
- Value rules of tables the schema check didn't cover (incidents, legal holds, system mode…). They are listed in `docs/ops/state-machine-audit.md` and waiting for Query C.
- The SQL drafts and concurrency. These run on a local PostgreSQL (`docs/ops/sql/drafts/1*_DRAFT_tests_*.sql`, `docs/ops/sql/local-test/stress_test.sh`), not in this suite.
