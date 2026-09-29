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

## What these tests can't check

- Real row-level security, triggers and the `audit_log` in Supabase. That needs a real (test) database, and the mock is not one.
- Real Safari on a real iPhone. These tests use Chromium at iPhone size.
- Pages beyond Tasks with realistic data. Most other pages are only opened with empty data, to check that they load without errors.
