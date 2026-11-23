# Plan: split `owner-login.html` into smaller files without changing behaviour

Status: **local draft, analysis only. No code has been refactored.** Based on `main` at d3db7bc (September 29, 2026) and the current test suite.

## 1. Current file structure map

`owner-login.html` is 9,028 lines and 505 KB. It has three layers.

| Lines | Size | What |
| --- | --- | --- |
| 1–24 | 18 KB | `<head>`: meta tags, **two inline base64 PNG icons (~16 KB, nearly identical)**, inline manifest, Supabase library from the CDN (floating `@2`, no integrity hash) |
| 25–967 | 44 KB | **One `<style>` block**: base styles, components, dark mode (~550), phone layout (~615) |
| 968–976 | – | Tiny pre-paint theme script, so there's no flash of the wrong theme |
| 977–1037 | 3 KB | HTML: login screen, app shell, sidebar container |
| 1038–1684 | 46 KB | HTML: **30 `<section class="panel">` pages**, one per sidebar page |
| 1685–1714 | 1 KB | HTML: overlays (Record Inspector, command palette, help, shortcuts, re-auth, quick add) |
| 1715–9026 | ~390 KB | **One `<script>`**: see below |

The JavaScript is structured like this:

- 1715–1738: constants for the Supabase address and the public key, the error banner, and the check that the CDN library loaded.
- **1740–9025: everything else lives inside one function, `initApp()`.** The Supabase client, the current user's role and email, the calendar mode, 19 `let` state variables, 54 constant tables and about 300 functions are all private to that one function. They share variables freely.

| Lines | KB | Area | Main tables / calls |
| --- | --- | --- | --- |
| 1740–1777 | 3 | Supabase clients (`supabase`, `verifyOnly`), DOM handles, error display | auth |
| 1778–1857 | 4 | **Pure helpers**: `esc`, `fmtMoney`, `fmtDate`, theme, empty-state icons, `isClosedStatus`, `isOverdue` | – |
| 1858–2047 | 8 | Login, **re-authentication for sensitive actions** (`requireReauth`, used 10×), forgot password | auth, `profiles` |
| 2048–2634 | 30 | Keyboard shortcuts, **sidebar + search** (`SIDEBAR_GROUPS`, `SEARCH_INDEX`, `searchEverything`), **22 `*_LABELS` tables**, pinned pages, `showPage` | localStorage (`he_*` keys) |
| 2635–3076 | 34 | Toasts, skeletons, number animation, **`PANEL_LOADERS` registry**, built-in guide (`HELP`), command palette, global keyboard layer | – |
| 3077–3691 | 29 | Employee Activity, **Record Inspector** (Quick Look, used by every page), CSV export | rpc `employee_activity*` |
| 3692–3872 | 8 | Needs Your Attention, business health | `needs_attention`, `manual_attention_items`, `orders` |
| 3873–4152 | 13 | Calendar mode, back/forward history, j/k row cursor, ⌘N quick add, connection banner, background refresh, iPhone pull-to-refresh and swipe, add product | various |
| 4153–4668 | 27 | **Suppliers + Purchase Orders** (incl. Receive, the partial-update bug) | `suppliers`, `purchase_orders`, `purchase_order_items`, `inventory*`, `expenses` |
| 4669–4837 | 9 | Quality Control | `quality_checks`, `incidents`, `inventory_lots` |
| 4838–5048 | 12 | Recalls (quarantine: same partial-update problem) | `recalls`, `inventory`, `inventory_lots`, `inventory_adjustments` |
| 5049–5503 | 22 | Calendar (Apple + personal, notes) | `calendar_events`, `personal_calendar_events`, `calendar_notes` |
| 5504–5650 | 7 | `loadDashboard`, **Orders** (+ customer-data access logging) | `orders`, `order_items`, rpc `log_customer_data_access` |
| 5651–5775 | 7 | **Tasks** (buttons v2), Incidents | `tasks`, `incidents` |
| 5776–6555 | 44 | AI agents registry and controls, Inquiries, Continuity, Daily summary, Report history | `agent_controls`, `ai_decision_log`, `customer_inquiries`, `service_status`, `daily_reports` |
| 6556–7239 | 33 | Feature flags, system mode, business rules, approvals, sessions, SOPs, feature requests | `feature_flags`, `system_mode`, `business_rules`, `approval_requests`, rpc sessions |
| 7240–7839 | 29 | Evidence locker, Documents, Adverse events, Legal holds | matching tables |
| 7840–8167 | 18 | **Inventory** (manual stock, adjustments) | `products`, `inventory`, `inventory_lots`, `inventory_adjustments` |
| 8168–8500 | 18 | **Returns** (restock → inventory) | `returns`, `orders`, `order_items`, `inventory` |
| 8501–8700 | 9 | **Expenses** (receipts, soft delete) | `expenses` |
| 8701–9025 | 17 | **Accounting** and **Tax records** (CSV export) | `orders`, `expenses` |

Totals:
- 170 `supabase.from(...)` calls across 37 tables, plus 7 `rpc` functions.
- 145 `innerHTML =` assignments.
- 98 click handlers.
- 338 `getElementById` calls.
- Zero inline `onclick="…"` attributes, which is good: no HTML string depends on global function names.

## 2. What belongs together

| Group | Pieces that must move together |
| --- | --- |
| **Core / platform** | Supabase clients, `currentUserId`, current user and role, `showDashError`, `toast`, `safeRun`, `requireReauth`, error banner |
| **Pure helpers (no DOM, no Supabase)** | `esc`, `fmtMoney`, `fmtDate`, `fmtDateOnly`, `fmtTimeShort`, `fmtEventTime`, `timeAgo`, `isClosedStatus`, `isOverdue`, date-range helpers, `poLinesTotal`, `poGrandTotal`, landed-cost maths, `rollupReports`, CSV quoting, `businessRuleValueError`, all `*_LABELS` tables |
| **Shell / navigation** | sidebar, `SIDEBAR_GROUPS`, icons, pinned and open groups, `showPage`, last page, `PANEL_LOADERS`, back/forward, iPhone gestures, keyboard layer, palette, help, shortcut sheet |
| **Search** | `SEARCH_INDEX` (written by **19 different loaders**), `searchEverything`, badge counts |
| **Record Inspector** | `PANEL_RECORD_TABLE`, `RECORD_ID_ATTRS`, hover and tap handlers, j/k row cursor, Activity rendering helpers (`describeChange`, `codeDiff`) |
| **Tasks** | `TASK_*` tables, `changeTaskStatus`, `loadTasks`, and the Tasks section HTML |
| **Orders & customers** | `loadOrders`, `logCustomerAccess`, Needs attention, Inquiries (links to orders), Accounting and Tax (read orders) |
| **Inventory domain** | Inventory, adjustments, lots, Returns restock, PO receive, Recall quarantine, QC lot picker. **These four places all do "read stock, add in browser, write back":** PO receive 4592, recall 4918, manual adjust ~8131/8146, return restock ~8351/8359 |
| **Purchasing** | Suppliers, Purchase Orders, `PO_*` state, and Expenses (receive writes an expense) |
| **Money** | Expenses, Accounting, Tax records, `EXPENSE_CATEGORY_LABELS`, `TAX_CATEGORY_MAP` |
| **Compliance** | QC, Recalls, Incidents, Evidence locker, Documents, Adverse events, Legal holds, SOPs |
| **Agents / operations** | AI registry, agent controls, flags, system mode, business rules, approvals, continuity, daily summary, reports, sessions, feature requests |

## 3. Duplicated code and tight coupling

**Duplicated:**
- **Inventory arithmetic in 4 places** (listed above). This is also a correctness bug. One shared helper, and later one database function, fixes all four.
- **Multi-step writes without all-or-nothing:** PO receive, recall quarantine, returns restock.
- **22 label tables** (`*_LABELS = {…}`) spread over the file, some next to their page and some in the search block.
- **The same load pattern in ~30 loaders:** `try { query } catch (err) { showDashError('Could not …') }` appears 105 times. Soft-delete "show deleted / restore" lists are repeated 3 times (expenses, feature requests, legal holds). There are also 39 `deleted_at` filters.
- **Date helpers:** `getTodayRange`, `getYesterdayRange`, `acctRangeStart`, `taxRangeStart`, `startOfWeekMonday` and six date/time formatters.
- **CSV export** is written twice (Activity, Tax records).
- **Two ~8 KB base64 icons** in `<head>`, nearly identical.

**Tightly coupled (hard to separate):**
1. **Everything shares the `initApp()` closure.** Any extracted file needs another way to reach `supabase`, `currentUserRole`, `calMode`, `PO_*`, `ACTIVITY_*`, and so on.
2. **`PANEL_LOADERS` (line 2707) names ~40 loader functions that are defined later in the file.** This only works because of function hoisting inside one script. If the loaders move to separate files, the registry must be built *after* all files have loaded.
3. **`SEARCH_INDEX`** is written by 19 loaders and read by search, the palette and badge counts. It's a shared global.
4. **The Record Inspector** is wired onto every page through `PANEL_RECORD_TABLE` and global hover/tap handlers on `main.contentArea`. (It is also the cause of the phone overlay opening on purchase orders.)
5. **Cross-page refreshes:** Receive calls `loadInventory` and `loadExpenses`, returns call inventory loaders, and so on.
6. **The HTML sections and the JS find each other by id** (338 `getElementById` calls). Moving HTML into JS templates would break this, so the HTML should stay in the page for now.

**Risky to separate (leave until last, or keep together):**
- Login, re-auth and session start-up: security-sensitive, with timing-sensitive locks (`verifyOnly` client).
- The keyboard layer, palette, row cursor and inspector: one global event web.
- The inventory, purchasing and returns code: money and stock logic. Refactor it only together with the atomic database fix, never as a pure "move".
- `PANEL_LOADERS` and progressive loading: load order matters.

## 4. Proposed module structure

This keeps **plain `<script src>` files, loaded in order, with no build step.** GitHub Pages serves them as-is, and the page keeps working the same way. ES modules and a bundler are deliberately avoided for now: they would change how names are shared, and would need a build step plus a deploy change.

```
owner-login.html              ← HTML only: head, shell, 30 sections, overlays
assets/
  owner-login.css             ← the current <style> block, unchanged
  icons/app-icon.png          ← (optional) replaces the two inline icons
  js/
    00-helpers.js             ← pure helpers + label tables (no DOM, no Supabase)
    10-core.js                ← app namespace: HE.supabase, HE.state, toast, errors, safeRun, reauth
    20-shell.js               ← sidebar, navigation, search index, palette, help, keyboard, gestures
    30-inspector.js           ← Activity + Record Inspector + row cursor
    40-tasks.js               ← Tasks, Incidents
    41-orders.js              ← Orders, Needs attention, Inquiries
    42-inventory.js           ← Inventory, adjustments, lots, Returns
    43-purchasing.js          ← Suppliers, Purchase Orders
    44-money.js               ← Expenses, Accounting, Tax records
    45-compliance.js          ← QC, Recalls, Evidence, Documents, Adverse events, Legal holds, SOPs
    46-calendar.js            ← Calendar
    47-operations.js          ← Agents, flags, system mode, rules, approvals, continuity, reports, sessions, feature requests
    99-start.js               ← builds PANEL_LOADERS from what each file registered, then runs initApp
```

How the pieces share things:
- Each page file registers itself, for example `HE.panels.tasksPanel = [loadTasks]`.
- `99-start.js` builds the loader table only after every file has loaded. This removes the hoisting dependency.
- Shared state moves from closure variables to one object, `HE.state`.
- Each script file gets a `?v=<commit>` suffix, so a browser can't combine a new page with an old cached script after a deploy.

## 5. Step-by-step plan (behaviour unchanged at every step)

Every step:
- is one small PR
- runs `npm test` on desktop and iPhone
- adds a **"no request changed" check**: the list of Supabase requests during a full click-through must be identical before and after
- has rollback = revert the PR

| Step | Change | Protected by (existing) | Needs first (missing) |
| --- | --- | --- | --- |
| **0** | **Tests only**, no dashboard change (see section 6) | – | – |
| 1 | Move `<style>` → `assets/owner-login.css`, byte-for-byte | general: layout desktop/iPhone, overflow, header fits; mobile-tasks: button sizes | **visual screenshot baselines** of every page, light and dark, desktop and iPhone |
| 2 | Move pure helpers + label tables → `00-helpers.js` (they use nothing from `initApp`) | general: every page opens, no JS errors; tasks; search | **unit tests** for `esc`, money/date formatting, `poGrandTotal`, landed cost, tax maths, CSV quoting |
| 3 | Introduce `HE` namespace + `99-start.js`; build `PANEL_LOADERS` at the end. No code moves yet | general: dashboard loads every panel, last page remembered, every page opens | **request-log snapshot test** (the same requests in the same order) |
| 4 | Move Tasks → `40-tasks.js` (smallest, best-tested page) | tasks.spec (14 tests ×2), mobile-tasks | – |
| 5 | Move Calendar, Compliance, Operations one per PR | general: every page opens | **per-page render tests with realistic synthetic data** |
| 6 | Move Orders, then Money (Expenses/Accounting/Tax) | general only | render + write-shape tests for Orders, Expenses, Accounting, Tax; **CSV export content tests** |
| 7 | Move Inspector + Activity, then Shell/keyboard/palette | general: search, sidebar, iPhone menu | **keyboard/palette/inspector tests**, phone tap-to-inspect |
| 8 | Inventory, Purchasing, Returns: **only after** the atomic database functions exist, moved as part of that work | po-receive.spec (local draft) | Inventory adjust, return restock, recall quarantine write-shape tests |
| 9 | (Optional) replace the base64 icons with one PNG file; pin the Supabase library version + integrity hash | safety.spec, login loads | icon/manifest presence check |
| last | Login / re-auth / session start → `10-core.js` | general: login, wrong password, sign out | **re-auth prompt tests** (correct/wrong password, cancel), forgot-password link |

## 6. Missing regression tests to add before refactoring

1. **Visual baselines:** a screenshot of each of the 30 pages, desktop and iPhone, light and dark, using synthetic data. This catches CSS breakage in step 1.
2. **Request-log snapshot:** log in, open every page, and record every Supabase request (table, method, filters). A move must produce the identical list.
3. **Unit tests of pure helpers:** formatting, totals, landed cost, tax rollups, CSV escaping, `isOverdue`, business-rule validation.
4. **Realistic-data render tests** for Orders, Inventory, Returns, Expenses, Accounting, Tax, Calendar, QC, Recalls. Today most pages are only opened with empty data.
5. **Write-shape tests** for every form and button that writes: which table, which fields, how many requests. Tasks already has these; nothing else does.
6. **Keyboard layer:** ⌘K palette, `?` shortcuts, g-then-letter navigation, j/k + Return, ⌘N quick add, Esc closes overlays.
7. **Record Inspector:** hover + Space on desktop, tap on phone, Close. The test should also cover the purchase-order tap overlap found today.
8. **Re-auth prompt:** a sensitive action asks for the password; wrong password is refused; cancel does nothing.
9. **CSV exports:** Activity and Tax files have the right headers and rows.
10. **Theme:** the toggle cycles auto → light → dark and is remembered.

## 7. Recommended PR order

1. **Tests PR A:** visual baselines + request-log snapshot + helper unit tests (step 0).
2. **Tests PR B:** realistic-data render tests + write-shape tests for Orders, Inventory, Returns, Expenses.
3. CSS extraction (step 1).
4. Pure helpers extraction (step 2).
5. Namespace + start-up registry (step 3).
6. Tasks module (step 4).
7. Calendar, then Compliance, then Operations (step 5, three PRs).
8. Orders, then Money (step 6, two PRs).
9. Inspector/Activity, then Shell (step 7, two PRs).
10. Inventory/Purchasing/Returns together with the atomic database work (step 8).
11. Login/core last.

That's about 14–16 small PRs. Separately, and in any order, the PO-receive atomic fix and the CDN version pin can go ahead. Both are independent of the split.

## 8. Which refactor comes first, and why

**First: tests only (PR A), then the CSS extraction.**

- The CSS has **no JavaScript dependencies**: nothing reads it by name, and it doesn't touch `initApp()`. Moving it byte-for-byte can't change what the page *does*, only how it *looks*. The visual baselines from PR A catch exactly that.
- It's also sizeable (~44 KB, 943 lines, about 9% of the file). Mistakes are obvious and instant to undo.
- The alternative first step, pure helpers, is almost as safe. But it touches the JS scope, so it should follow the CSS move rather than lead.

**Deliberately not first:**
- Tasks is the best-tested page, but it still depends on the shared closure.
- Inventory and purchasing hold money and stock logic, and have known bugs. Moving that code before the atomic fix would mix a refactor with a behaviour change.

## 9. Risks

- **Browser caching after a deploy:** the new page could load an old cached CSS or JS file. Mitigation: `?v=` suffix on every file, then check with a hard refresh or a Private Window.
- **Script load order and hoisting:** a loader referenced before its file has loaded causes a blank page. Mitigation: build the registry at the end (step 3). The "loads without JS errors" and "every page opens" tests catch it.
- **A hidden shared variable:** a function silently relies on a closure variable that didn't move. Mitigation: move one area at a time, run the request-log snapshot, and use `"use strict"` in the new files so a mistyped name throws instead of creating a global.
- **The live site has no staging:** every merge is production. Mitigation: small PRs, all tests on both sizes, and a live check after each merge.
- **The tests use Chromium only:** a real iPhone Safari check is still needed after the CSS and shell moves.
- **No behaviour changes allowed:** the known bugs (PO receive, recall quarantine, inventory lost updates, search Enter `fixme`, phone inspector overlap) are **not** fixed by the split. Each needs its own PR.
