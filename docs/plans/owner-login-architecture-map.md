# `owner-login.html`: detailed dependency map and refactor preparation

Status: **analysis only, no code changed.** Based on `main` at d3db7bc (September 29, 2026). This deepens `owner-login-modularization-plan.md`. Where the two differ, this file is newer.

The numbers come from the read-only script `docs/plans/analysis/dependency_map.py`. It is a text scan, not a JavaScript parser, so treat the counts as a close guide. Re-run it after any change:

```bash
python3 docs/plans/analysis/dependency_map.py
```

## 1. The big picture

- The file is 9,028 lines and 505 KB: 44 KB of CSS, 49 KB of HTML (30 page sections and 3 overlays), about 390 KB of JavaScript, and 16 KB of inline icons.
- **Almost all the JavaScript runs inside one function, `initApp()`** (lines 1740–9025). It holds 295 top-level declarations: **176 functions, 79 constants and 40 shared variables (`let`)**. They all see each other directly. That is the root of every "hidden dependency" below.
- Only 3 names escape to `window`: `window.toastOk`, `window.toastErr`, and `window.__sbLoadFailed` (set by the CDN tag). `toastOk` is called as a bare name in about 30 places, which only works because it's a global.
- There is one timer (`setInterval`, 5-minute quiet refresh of the current page). It depends on `PANEL_LOADERS`, `currentPageId`, `anyOverlayOpen` and `quickAdd`.

## 2. Areas and what they depend on

Each area is a group of line ranges (listed in the script). The arrow shows the areas each one borrows names from, with the count of names borrowed.

| Area | Lines (main) | Borrows from | Database |
| --- | --- | --- | --- |
| core | 1740–1777 | auth | none |
| helpers | 1778–1857 | none | none |
| auth (login, re-auth, reset) | 1858–2047 | **core (11)**, shell (3), loading | `profiles` |
| shell (sidebar, navigation, page switch, gestures, offline bar) | 2048–2634, 4016–4107 | **keyboard (9)**, loading (4), search (3), others | none |
| search (`SEARCH_INDEX`, `searchEverything`) | 2169–2430 | helpers, activity, labels, help, purchasing, orders, compliance | none (reads what loaders store) |
| labels (22 `*_LABELS` tables) | 2192–2288 | none | none |
| feedback (toasts, skeletons, number animation) | 2635–2702 | none | none |
| loading (`PANEL_LOADERS`, `safeRun`, `loadDashboard`) | 2703–2748, 5504–5522 | **every page area** (~45 names) | none |
| help, palette, keyboard | 2749–3076, 3914–4015, 4080–4107 | palette (6), inspector (4), loading (3), calendar (3)… | `manual_attention_items` (quick add) |
| activity + inspector (change history) | 3077–3691 | activity ⇄ inspector (8), core, helpers, shell, keyboard | rpc `employee_activity*` |
| attention (home page) | 3692–3872 | helpers (5), **operations (3)**, core | 8 tables + rpc |
| calendar | 3873–3913, 5049–5503 | core (4), feedback, **inventory (1: `currentUserId`)** | 3 calendar tables |
| purchasing | 4153–4668 | helpers, core, **inventory (2)**, loading, **money (1: `loadExpenses`)** | 8 tables incl. `inventory`, `expenses` |
| compliance (QC, recalls, incidents, evidence, documents, adverse events, legal holds, SOPs) | 4669–5048, 5734–5775, 6993–7076, 7240–7839 | **purchasing (5)**, helpers (4), inventory (2), tasks, attention… | 14 tables incl. `inventory` |
| orders (+ inquiries) | 5523–5650, 6057–6249 | helpers, core, auth, search, feedback | `orders`, `customer_inquiries`, rpc |
| tasks | 5651–5733 | helpers (4), core (2), search | `tasks` |
| operations (agents, flags, rules, approvals, sessions, reports, feature requests, continuity) | 5776–6056, 6250–6992, 7077–7239 | helpers, **labels (3)**, core, auth, compliance, inventory | 19 tables/functions |
| inventory | 4108–4152, 7840–8167 | core, helpers, labels, loading, purchasing | `products`, `inventory`, `inventory_adjustments` |
| returns | 8168–8500 | **labels (4)**, **inventory (3)**, core, helpers | `returns`, `inventory`, … |
| money (expenses, accounting, tax) | 8501–9019 | helpers, core, labels, **compliance (1: `fmtDateOnly`)** | `expenses`, `orders`, `order_items`, `products` |

The biggest hubs, meaning the names used by the most areas:

| Name | Defined in | Used by |
| --- | --- | --- |
| `esc` | helpers | 16 areas |
| `supabase` (client) | core | 15 areas |
| `showDashError` | core | 14 areas |
| `fmtDate` | helpers | 12 areas |
| `SEARCH_INDEX` | search | 11 areas (19 loaders write into it) |
| `toast` / `toastOk` | feedback | 9+ areas |
| `fmtMoney` | helpers | 7 areas |
| `currentUserId` | **inventory** (line 7841), in the wrong place | 7 areas |
| `showPage` | shell, **re-assigned in keyboard** | 6 areas |
| `safeRun`, `isClosedStatus` | loading, helpers | 6 areas each |

## 3. Shared state (the 40 `let` variables)

Most are private to their area; those are safe. The ones that cross areas:

| Variable | Written by | Also read by | Risk when split |
| --- | --- | --- | --- |
| `currentUserEmail`, `currentUserRole` | auth | core, calendar | Re-auth needs the email; the calendar picks its mode from the role |
| `currentPageId` | shell | inspector, keyboard, loading | The quiet refresh and phone gestures depend on it |
| `activeReauthClose` | auth | shell (`showPage` cancels an open prompt) | Security-relevant: leaving a page must cancel the password prompt |
| `ACTIVITY_ROWS`, `ACTIVITY_PERSON`, `ACTIVITY_HOVERED` | activity (and inspector writes `ACTIVITY_PERSON`) | inspector, keyboard | Two-way coupling between activity and inspector |
| `rowCursorEl` | keyboard | shell | The j/k cursor is cleared on page change |
| `agentControlsByNum` | operations | attention | The home page shows paused agents |
| `ALL_INQUIRIES` | orders | search | |
| `LAST_SEARCH_RESULTS` | shell | search | |

The constant *objects* that are filled in at runtime behave like shared state too:
- `SEARCH_INDEX`, which 19 loaders write into
- `PANEL_LOADERS`
- `NAV_BACK` / `NAV_FWD`

## 4. Hidden dependencies caused by `initApp()`

These are the places where moving code into separate files could **change behaviour without any error**:

1. **`showPage` is re-assigned** (line 3920: `showPage = function…`) to add back/forward history.
   - Every caller gets the new version only because they all look the name up in the same closure.
   - After a split, callers holding the old reference would silently lose back/forward history.
   - Fix before splitting: give `showPage` an explicit "after navigate" hook.
2. **`PANEL_LOADERS` (line 2707) names ~45 loader functions defined thousands of lines later.** It works only because function declarations are hoisted inside one scope. Split files must register their loaders, and the table must be built after every file has loaded.
3. **`window.toastOk` / `window.toastErr` are set at line 2653.**
   - `showDashError` (line 1768) calls `window.toastErr` only if it exists, so an error before line 2653 shows no toast.
   - About 30 places call `toastOk` as a bare global.
   - Load order will matter.
4. **`currentUserId`** lives in the inventory area but is used by 7 areas. Moving "inventory" would break calendar, compliance, operations, purchasing, returns and quick add.
5. **Cross-area helpers in odd homes:**
   - `fmtDateOnly` sits in compliance but is used by money.
   - `QC_TYPE_LABELS` sits in purchasing but is used by compliance and search.
   - `EXPENSE_CATEGORY_LABELS` sits in the search block.
6. **Cross-page refresh calls:**
   - Receive → `loadInventory`, `loadExpenses`
   - Returns → `loadInventory`, `loadInventoryAdjustments`
   - Recalls → `loadInventory`, `loadAttention`
   - Quick add → `loadAttention`

   A page module would need to reach loaders owned by other modules.
7. **Six overlay systems, each with its own open and close logic:**
   - HTML: inspector, re-auth, sidebar
   - Created in JS: help, palette, shortcuts, quick add

   `anyOverlayOpen()` knows only 4 of them: palette, shortcuts, inspector and re-auth. The quiet refresh adds quick add; the phone swipe doesn't. So **swiping while Help or Quick add is open can still change the page underneath.** This behaviour should be preserved deliberately, or fixed in its own PR, never changed by accident during a move.
8. **One global `keydown` web: 3 separate `document` listeners** (lines 3020, 3673, 4081) plus per-field listeners. They cooperate through shared checks (`typingInField`, `anyOverlayOpen`, `goArmed`). The order they were attached in affects which one handles Escape first.
9. **Body-level tap handler on phones** (line 3583): any tap on a row opens the change history. That's why tapping a purchase order also opens history over it. Any new clickable row inherits this.
10. **Swipe handler on `main.contentArea`:** any sideways swipe changes the page, even inside a table that scrolls sideways (see bug B6 in the regression report).

## 5. Logic by concern

| Concern | Where | Notes |
| --- | --- | --- |
| **Money / accounting** | `poLinesTotal`, `poGrandTotal`, landed cost inside the Receive handler (4540–4554), `classifyOrderStatus`, `loadAccounting`, `loadTaxRecords`, `TAX_CATEGORY_MAP`, the expense insert in Receive, the Expenses form | The landed-cost maths is **inline** in a click handler, not a function, so it can't be unit-tested until it's extracted. Several dates use UTC (`toISOString().slice(0,10)`) and fall on the wrong day in US evenings. |
| **Inventory** | Receive (4532), recall quarantine (4907), manual adjust (8110), return restock (8322), product delete (8016), threshold (8054), `loadInventory`, `loadInventoryAdjustments` | Four copies of read-add-write stock (see the inventory-safety report). No shared helper. |
| **Tasks** | `TASK_*` tables, `changeTaskStatus`, `loadTasks` (5651–5733) | Small and self-contained, with good tests. The update is conditional on the current status in the database, a good pattern the inventory code should copy. |
| **Auth / security** | `showDashboardFor`, `requireReauth` + the `verifyOnly` client, forgot password, sessions page (`list_my_sessions`, `revoke_my_session`), privacy log (`logCustomerAccess`) | `requireReauth` is used by 10 actions (order delete and restore, flags, rules, approvals…). Expense delete, product delete and stock changes do **not** ask for it. |
| **Navigation** | `SIDEBAR_GROUPS`, `renderSidebar`, `showPage` (+ patch), `getLastPage` / `saveLastPage`, pinned pages, back/forward, `GO_TO`, swipe | localStorage keys: `he_last_page`, `he_pinned_pages`, `he_open_groups`, `he_theme`, `he_cal_view` |
| **Overlays** | see point 7 above | |
| **Common utilities** | `esc`, `fmtMoney`, `fmtDate`, `fmtDateOnly`, `fmtTimeShort`, `fmtEventTime`, `timeAgo`, `isClosedStatus`, `isOverdue`, `currentUserId`, `toast`, `showDashError`, `safeRun`, CSV builders (×2) | |

## 6. Duplicated logic

- **Stock arithmetic ×4** and **multi-step writes without all-or-nothing ×4.** Fix these with database functions, not by moving code.
- **The load-and-report-error pattern ×~30:** `try { … } catch (err) { showDashError('Could not load …') }` appears 105 times.
- **Soft delete + recycle bin ×4:** orders, expenses, feature requests, legal holds. Each has its own list, restore and render code.
- **Date ranges ×5:** `getTodayRange`, `getYesterdayRange`, `acctRangeStart`, `taxRangeStart`, `startOfWeekMonday`. **Date formatters ×6.** **CSV export ×2**, each with the same quoting code and neither guarding against spreadsheet formulas.
- **Label tables ×22**, some duplicated in meaning (`RETURN_*`, `QC_*`, `FR_*`, `INQ_*`, `TASK_*`, `PO_*`).
- **Status-change buttons:** tasks, feature requests, returns, recalls and POs each hand-roll "disable button → update → reload → re-enable on error".

## 7. Especially risky functions

| Function / handler | Why it's risky |
| --- | --- |
| PO **Receive** handler (4533–4641) | Money + stock + expenses; 7+ writes; known bugs |
| Recall **quarantine** (4907) | Compliance record + stock; known bugs |
| Return **Mark Received** (8322) | Stock; known bugs |
| **Adjust inventory** form (8110) | Stock; lost-update race |
| **Delete product** (8016) | Deletes the stock row before the product delete is known to succeed |
| `requireReauth` (1899) | Security gate; subtle listener clean-up; a timeout (8 s, while the comment says 12 s) |
| `showDashboardFor` (1859) | Session start; decides who gets in (any active profile, any role) |
| `showPage` + its patch (2596, 3920) | Navigation, re-auth cancel and history in one place |
| `loadDashboard` + `PANEL_LOADERS` | Load order and progressive loading |
| Business rules / feature flags / system mode (6556–6866) | Change how agents behave; password-gated |
| `loadTaxRecords` | Money figures; `in(...)` with every order id in the URL (very long URLs at scale) |

## 8. Safe to extract first vs. keep together

**Safe first:** pure, no DOM, no Supabase, no shared state:
- the CSS block
- `esc`, `fmtMoney`, `fmtDate`, `fmtDateOnly`, `timeAgo`, `fmtAccountNumber`, `deviceLabel`, `isClosedStatus` + `CLOSED_WORDS`, `isOverdue`, `classifyOrderStatus`, `poLinesTotal`, `poGrandTotal`, `startOfWeekMonday`, `rollupReports`, `businessRuleValueError` + its constants, `TAX_CATEGORY_MAP`
- all 22 `*_LABELS` tables

These are covered by `tests/specs/helpers-unit.spec.js`.

**Keep together:**
- activity + inspector + row cursor
- the keyboard layer + palette + help + shortcuts + quick add
- `showPage` + its history patch + `activeReauthClose`
- purchasing + inventory + returns + recall quarantine, which should become one "stock" module *after* the database functions exist
- auth + re-auth + session start

**Move last:** auth/session start, the keyboard web, and the inventory family.

## 9. Proposed future structure

Plain `<script>` files in a fixed order, loaded without a build step, sharing one namespace object `HE`. There are no ES modules yet: those would make `showPage`-style re-assignment impossible and need a bundler.

```
owner-login.html                 HTML only
assets/owner-login.css           the <style> block, byte-for-byte
assets/js/
  00-helpers.js      HE.fmt.*, HE.esc, HE.status.*, HE.labels.*, HE.money.* (pure)
  05-feedback.js     HE.toast, HE.showDashError, skeletons, number animation
  10-core.js         HE.supabase, HE.verifyOnly, HE.state (user, role, page), HE.currentUserId, HE.safeRun
  12-auth.js         login, requireReauth, forgot password, session start
  15-shell.js        sidebar, showPage (with explicit hooks), history, pinned pages, gestures, offline bar
  18-search.js       HE.searchIndex, searchEverything
  20-overlays.js     one overlay registry: open/close/anyOpen for all 7 overlays
  22-keyboard.js     palette, help, shortcuts, quick add, j/k, g-keys (one keydown dispatcher)
  25-inspector.js    activity + record inspector
  30-tasks.js  31-orders.js  32-money.js  33-calendar.js  34-compliance.js  35-operations.js
  40-stock.js        inventory, purchasing, returns, recall quarantine (after the DB functions)
  99-start.js        builds PANEL_LOADERS from HE.panels, then starts the app
```

## 10. Exact extraction order and PR plan

Every PR:
- is one step, with no behaviour change
- runs the full suite on desktop and iPhone
- requires the **request baseline** (`tests/baselines/requests.json`) to be unchanged, and the **screenshot baselines** to be unchanged (or reviewed if intended)

**Rollback for every stage = revert that one PR.** Earlier stages keep working because each stage is complete on its own. After each merge: hard refresh (Cmd+Shift+R) and check the live site. Each new file gets a `?v=<commit>` suffix, so an old cached file can't mix with a new page.

| # | PR | Tests that must exist and pass first | Rollback note |
| --- | --- | --- | --- |
| 0a | **Regression suite** (branch `claude/regression-coverage`): page data, interface, unit, request and screenshot baselines | – | Test-only |
| 0b | **Inventory-safety tests** (branch `claude/inventory-safety-audit`) | – | Test-only |
| 1 | Move `<style>` → `assets/owner-login.css` | Screenshot baselines (18 images × 2 sizes); layout tests | Revert; a CSS-only change |
| 2 | Move inline icons → one PNG file (optional) | Login loads; manifest/icon present | Revert |
| 3 | Create `00-helpers.js` with the pure helpers and labels (copy, then delete the originals) | `helpers-unit.spec.js`, request baseline, every page opens | Revert |
| 4 | Create the `HE` namespace + `99-start.js`; build `PANEL_LOADERS` at the end; replace the `showPage` re-assignment with an explicit hook; move `currentUserId` to core. **Behaviour identical.** | Back/forward tests, re-auth-cancels-on-navigate test (add), request baseline | Revert; this is the riskiest structural step, so do it alone |
| 5 | Move feedback (toasts) into `05-feedback.js`; replace bare `toastOk` with `HE.toast.ok` | Every page opens with no JS errors; failed-load and save tests | Revert |
| 6 | Move **Tasks** → `30-tasks.js` | `tasks.spec.js` (14 × 2), `mobile-tasks.spec.js` | Revert |
| 7 | Move **Calendar** | Calendar tests (**missing**, add first) | Revert |
| 8 | Move **Compliance** (not recall quarantine) | Every page opens; request baseline; QC/recall render tests (**missing**) | Revert |
| 9 | Move **Operations** | Flags/rules re-auth tests (**missing**), request baseline | Revert |
| 10 | Move **Orders** + inquiries | `pages-data` Orders tests (7 + fit test) | Revert |
| 11 | Move **Money** (expenses, accounting, tax) | `pages-data` Expenses/Accounting/Tax (16) | Revert |
| 12 | Overlay registry + keyboard dispatcher (one `keydown` listener) | `ui-chrome.spec.js` (18), inspector phone/desktop | Revert; keep Escape order identical |
| 13 | Move activity + inspector | Inspector tests, Activity CSV test (**missing**) | Revert |
| 14 | **Stock module**, only after the inventory database functions are live | `po-receive` + `inventory-safety` with their `test.fail()` flipped | Revert; DB functions stay |
| 15 | Auth / session start last | Login, wrong password, sign out, re-auth tests; inactive-profile test (**missing**) | Revert |

**Wait for the inventory safety fixes before steps 14 and 11.** Money reads what Receive writes. Also, anything that touches the Receive, quarantine, restock or adjust handlers should wait: first make them call one database function, then move the much smaller code.

## 11. Places where extraction could change behaviour by accident

- Changing the order of `document` `keydown` listeners, which changes who handles Escape.
- Losing the `showPage` patch, which silently loses back/forward history and the page-change clean-up.
- Building `PANEL_LOADERS` before all loaders exist: a page stays on "Loading…" with **no error**, because `safeRun` swallows errors.
- `safeRun` swallows all errors by design. A moved loader that throws `ReferenceError` just silently shows nothing. **Always check the browser console / `pageErrors` in tests.**
- Browser cache mixing an old JS file with new HTML (use `?v=`).
- Moving an HTML section into JavaScript templates: 338 `getElementById` calls depend on ids existing at start-up.
- `"use strict"` in new files turns silent mistakes into errors. That's good, but it's a behaviour change if an old sloppy assignment relied on it.
- The phone tap-to-inspect and swipe handlers are attached to `main.contentArea`. Anything that re-creates that element drops them.
