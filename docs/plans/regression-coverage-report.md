# Regression coverage report

Status: **tests only, no dashboard code changed.** September 29, 2026. Branch `claude/regression-coverage`. All data is synthetic, and the mock blocks any real network access.

## What was added

| File | Tests | Covers |
| --- | --- | --- |
| `tests/specs/pages-data.spec.js` | 32 (× desktop + iPhone) | **Orders**: stats, list, recycle bin, privacy log, delete/restore with password (cancel, wrong, right, Esc), prompt fits on screen. **Expenses**: list/total, add sends exact fields, required category, double-click → one save, failed save keeps input, delete sends `deleted_at` only. **Accounting**: Today / This Month / All Time maths, refund exclusions, review list. **Tax**: yearly figures, COGS vs operating, state tax, estimated COGS, missing receipts, last year, **CSV export content**. **Inventory**: buckets, low-stock flag, threshold and product saves send only their fields, below-zero refused. **Returns**: per-status actions, validation. **Failed page load** shows an error. |
| `tests/specs/ui-chrome.spec.js` | 16 (keyboard tests desktop-only; tap tests phone-only) | **Theme** cycle + remembered. **Command palette** (open, click result, records, arrow keys, click-outside, Esc). **Shortcuts** `?`, **g-keys** (6 pages), `/` search, **⌘[ ⌘] back/forward**, **⌘N quick reminder** (exact fields, empty = no save), **j/k row cursor**. **Change-history overlay**: desktop hover+Space+tabs+Esc; phone tap opens a sheet that fits the screen, Close works, task buttons don't open it. **Password prompt**: empty refused, Enter confirms. |
| `tests/specs/helpers-unit.spec.js` | 20 (runs once, in Node) | `esc`, `fmtMoney`, status helpers, order classification, PO totals, account numbers, device labels, time-ago, date-only, week start, report rollups, business-rule limits, tax categories (incl. "every expense category has a tax category") |
| `tests/specs/request-baseline.spec.js` + `tests/baselines/requests.json` | 1 | Opens **all 31 pages** with realistic data: no JavaScript errors, no writes, and the list of **73 distinct database requests** must match the saved baseline |
| `tests/specs/visual.spec.js` + 20 images | 10 × 2 sizes | Screenshots of the login screen, 8 main pages and Orders in dark mode |
| `tests/fixtures/business-data.js` | – | Synthetic orders, order items, products, inventory, expenses, returns, with a frozen clock and time zone |
| `tests/helpers/stateful-backend.js`, `tests/helpers/extract-source.js` | – | Opt-in persisted writes + fault injection; copying helpers out of the page for unit tests. The shared mock is unchanged. |

## Results

**Update (Sept 29, evening):** the tests that pinned down bugs B2, B3, B6 and B7 were removed from this branch, because fix PRs now exist for them (#9, #11, #12), each bringing its own correct-behaviour tests. That lets this PR and the fixes merge in any order. B1 (palette Enter) has no fix yet; its test stays.

**77 new test definitions on this branch** (originally 81). Most run at both desktop and iPhone size; some are desktop-only or phone-only on purpose.

| | Passed | Failed | Skipped |
| --- | --- | --- | --- |
| Before (main) | 65 | 0 | 9 |
| **This branch, one full run (after removing the fixed-bug tests)** | **184** | **0** | **44** |
| This branch, full suite × 3 repeats (before `known-bugs` was added) | 564 | 0 | 132 |
| `visual.spec.js` × 3 repeats | 60 | 0 | 0 |
| `request-baseline.spec.js` × 3 separate runs | 3 | 0 | 0 |

**Skips are by design:**
- desktop-only tests (keyboard, hover) at iPhone size, and phone-only tests (tap, swipe) at desktop size
- the Node unit tests and the request baseline run once, at desktop
- the existing search `fixme`

In addition, the inventory-safety branch has 25 more definitions (50 runs, 250/250 over 5 repeats).

## Bugs discovered (documented, not fixed)

| # | Impact | Bug | Evidence |
| --- | --- | --- | --- |
| B1 | 🟠 Medium (no fix yet; needs your decision, since the guide-first order was deliberate) | **Command palette: typing a page name and pressing Enter opens a Guide article instead of the page.** Guide matches are listed first. Same cause as the existing sidebar-search `fixme`. | `ui-chrome.spec.js` "KNOWN BUG…" |
| B2 | 🟠 Medium | **Tax page, "Expenses missing a receipt": dates shown one day early** (May 20 → "May 19, 2026 7:00 PM") in US time zones. It uses `fmtDate` on a date-only value; `fmtDateOnly` exists for this. Your accountant would see wrong dates. The CSV export has the same issue. | Fix: **PR #11** |
| B3 | 🟠 Medium (security) | **CSV exports keep cells starting with `=`**, so they run as formulas in Excel or Numbers (see security review S4). | Fix: **PR #9** |
| B4 | 🟡 Low | On an iPhone, tapping a purchase order row also opens the change-history overlay on top (found earlier). | Fix: **PR #14** |
| B5 | 🟡 Low | **Password prompt**: Enter while a check is running starts a second check; the comment says 12 s, the code 8 s. | Fix: **PR #13** |
| B6 | 🟠 Medium (phone) | **Swiping a wide table sideways switches to another page.** The Orders table is wider than an iPhone screen, and dragging it to see Total/Placed/Delete triggers the "swipe to change page" gesture (Orders → Inventory). | Fix: **PR #12** |
| B7 | 🟡 Low–Medium | **In US evenings, dates default to tomorrow.** The new-expense date field, the adverse-event date field and the expense created by "Receive delivery" all use the UTC date (`toISOString()`). After ~7 pm Central, that's the next day, so expenses land on the wrong day and possibly in the wrong month or year for tax. | Fix (display / pre-fill part): **PR #11**. The Receive-delivery expense date is left for the inventory fix (needs approval). |
| B8 | 🟡 Low | **Tax page asks for all order items with every order id in the web address** (`in.(…)`). With many orders (e.g. "All Time" after a few years), the address gets too long and the request can fail. | Code reading (`loadTaxRecords`) |
| B9 | 🟡 Low | **Help and Quick-add overlays aren't known to `anyOverlayOpen()`**, so a phone swipe while they're open can change the page underneath. | Code reading |

Earlier findings (inventory safety, PO receive, product delete) are in `docs/plans/inventory-safety-report.md` on branch `claude/inventory-safety-audit`.

## Flakiness findings

- The first versions of 3 new tests were flaky: they checked results before the page had finished its last request. All were fixed *in the test* (wait for the final request). No dashboard change.
- The Tasks and Home screenshots changed every run because the shared task fixtures use real "today" dates. Fixed by pinning those dates inside the screenshot test.
- The request baseline is compared as a **set** of distinct requests, not in order, because pages load in parallel and the order varies.
- Screenshots are Linux-specific (fonts). They're reliable in Claude's environment. On a Mac they'd need their own baseline.
- Element screenshots capture only the visible part of long pages (e.g. the top of Tax Records).

## Areas still untested

- **Pages with no data-level tests yet:** Calendar (views, personal events, notes), Quality Control, Recalls (outside the inventory tests), Incidents, Evidence locker and Documents (uploads, links), Adverse events, Legal holds, SOPs, Suppliers, **Purchase order creation/editing**, Feature requests, Approvals, **Feature flags / Business rules / System mode** (password-gated, affect agents), AI agents page, Continuity, Daily summary, Report history, Sessions (revoke), Employee Activity filters and **its CSV export**.
- **Behaviour:** pinned pages, ⌘1–9, help overlay content, pull-to-refresh, the offline banner, the 5-minute background refresh, receipt uploads (storage is only mocked as "empty").
- **Real systems:** real row-level security, triggers and `audit_log` (needs a test database), real Safari on a real iPhone, real CDN library loading.

## Recommended next tests (before refactoring)

1. Flags / business rules / system mode: password prompt, exact fields, rule limits.
2. Calendar: views, personal events, notes.
3. Purchase order create/edit/status (not receive: that's covered).
4. Activity page + its CSV.
5. QC / recalls / incidents render with data.
