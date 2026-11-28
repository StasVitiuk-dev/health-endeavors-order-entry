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

## The pages and the database drafts agree (Nov 28)

The browser tests run against a stand-in database, so they cannot see a page sending an argument a draft
does not have. Two checks close that gap:
- `tools/rpc-contract.js` (run by `specs/rpc-contract-ext28.spec.js`): every call to a database function
  in `assets/` (also one sending no values) is compared with the function its SQL draft defines (the name, every argument name sent,
  every required argument present). A planted mistake must be caught, so it can never pass by reading
  nothing. Production's own functions (no draft) are listed, not judged.
- The `*_store_adapter_test.js` files in `docs/ops/sql/local-test/` (in the database suite, so GitHub runs
  them): each page's own storage code against its real draft on PostgreSQL, through a small supabase-js
  stand-in: invoices, supplier documents, stock per order, deliveries and returns, tax rates, money
  differences. The real-database browser tests (`helpers/pg-bridge.js`) skip on GitHub, which has no
  database in the browser jobs.

The guides agree with the database and the pages too:
- `guide_after_checks_test.js` (database suite): each review guide's read-only after-check, run as written
  after its draft, gives the guide's Expected answer (launch steps and the later ones).
- `specs/guide-switch-names-ext28.spec.js`: every switch a guide tells the owner to turn on (in bold) is a
  switch the dashboard or a draft really shows by that exact name.
- `specs/launch-page-ext25.spec.js`: the steps the Ready to launch page counts are the launch plan's list.

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

## Before every push (lesson of Nov 23)

When only a few specs are run locally instead of the whole suite, always include these (the first two since Nov 23, the others since Nov 24): they catch what a feature's own tests do not.

- `specs/robustness-probe-ext21.spec.js`: feeds empty, missing and broken input to every pure module; a new module is picked up automatically.
- `specs/request-baseline.spec.js`: the list of database requests every page makes with all switches off. If a change is intended, regenerate with `UPDATE_BASELINES=1` and say so in the PR.
- `specs/write-path-inventory.spec.js`: every save in the dashboard must be listed in `docs/ops/write-paths.classification.json`. A new save without its entry was the one red check on PR #55 (Nov 24).
- `specs/modules-ext15.spec.js`: new names and listeners in the program file must be registered there.
- `specs/launch-page-ext25.spec.js`, `specs/record-switches-ext24.spec.js` and `specs/preview-switches-ext21.spec.js` (Nov 28): a new switch that saves real records changes the count of database steps the Launch page shows and the switch lists. On #163 (Nov 28) the request baseline, the module check and the Launch page spec were not run locally, and all three failed on GitHub.

When in doubt, run the whole suite once (`npm test`, one heavy run at a time) before asking for review.

The database suite (`tests/tools/run-db-suite.sh`) must pass on a **new, empty** PostgreSQL, as GitHub starts one for every run. A local server that ran earlier tests keeps roles they created (roles belong to the whole server, not one database), which can hide a missing set-up step: on Nov 28 two steps passed locally and failed on GitHub because the service-key role existed only on the local server. Before pushing a database test change, run the suite once on a fresh server (`initdb` into a new folder, another port).

Do not regenerate the request baseline in a run that may be cut short or that runs beside other tests: on Nov 24 that dropped six unrelated entries. Change the one line by hand when only one request changed.

## Which menu the tests see

The dashboard ships with a shorter menu (owner's decision, Nov 24: same-topic pages sit inside one
another; "1. A little shorter"). Most tests are about what is on a page, and several count the menu
lines of the full menu, so the shared set-up (`tests/helpers/dashboard.js`) chooses "Today's menu"
(every page on its own line) before each test, the way a person chooses it on Feature Flags.
`tests/specs/menu-layouts-ext24.spec.js` tests the menu as shipped (`test.use({ shippedMenu: true })`).
`HE_SHIPPED_MENU=1 npm test` runs everything with the shipped menu; the tests that count menu lines
then fail on purpose.
