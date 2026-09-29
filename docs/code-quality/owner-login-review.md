# owner-login.html: read-only code-quality review

**Date:** September 29, 2026
**File reviewed:** `owner-login.html` at commit `4edf5d6`, unchanged since. It is 505,024 bytes and 9,028 lines.
**Scope:** this is a read-only review. **No dashboard code was changed.** Nothing here has been fixed yet. Each item would be its own small, approved pull request, done after the test suite is in place.

Each finding has a severity:
- 🔴 could cause wrong data or a security problem
- 🟠 likely to cause future bugs
- 🟡 worth cleaning up

## 1. What the file is made of

| Part | Lines | Size |
| --- | --- | --- |
| CSS styles | 25–967 | ~940 lines |
| Theme bootstrap script | 968–976 | small |
| HTML for the login screen, dashboard shell and about 30 page panels | 977–1714 | ~740 lines |
| The application's JavaScript, all inside one `initApp()` function | 1715–9026 | ~7,300 lines, 184 functions |

The file talks to Supabase:
- 170 table calls across 37 tables
- 7 database functions

It also builds HTML from strings in 145 places (`innerHTML = …`).

## 2. Likely to cause wrong data (🔴)

### 2.1 Receiving a purchase order is many separate writes with no "all or nothing"
The "Receive" handler (about line 4533) runs these writes one by one from the browser:
- per line: update `purchase_order_items` (landed cost)
- then per line:
  - find or create the `inventory_lots` record
  - read `inventory`, then write the new `inventory` total
  - insert `inventory_adjustments`
  - update `purchase_order_items`
- once at the end: insert `expenses` and update `purchase_orders`

If the connection drops or one write fails halfway, the earlier writes stay. For example, stock is added but the purchase order isn't marked received. Pressing Receive again then adds the stock a **second time**, and the expense may also be added twice.

**Suggested fix:** move the whole receive step into one database function that either does everything or nothing, and call it with a single `rpc(...)`. This touches the database and money/inventory logic, so it needs your approval and your SQL run.

### 2.2 Stock totals are "read, add, write back" from the browser
Receiving (line ~4592) and recall quarantine (line ~4915) both follow the same pattern:
1. Read the current `inventory.available`.
2. Add or subtract in the browser.
3. Write the new number back.

If two people, or a person and an agent, change the same product at the same moment, one change silently overwrites the other (a "lost update").

**Suggested fix:** do the arithmetic in the database, for example `available = available + n` inside a database function.

### 2.3 Recall "quarantine stock" has the same partial-failure problem as 2.1
Quarantining a batch (about line 4910) makes up to 5 separate writes: the lot, inventory, two adjustments, and the recall status.

## 3. Security concerns visible from the browser code

| # | Severity | Finding |
| --- | --- | --- |
| 3.1 | 🔴 | **The Supabase library is loaded from a CDN on a floating version with no integrity check.** The tag is `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">`, and `@2` means "whatever the newest 2.x is today". A bad or compromised release would run inside your signed-in owner session with all your permissions. **Fix:** pin an exact version and add an `integrity="sha384-…"` hash. That's a tiny change, but it is a dashboard change, so it gets its own PR. |
| 3.2 | 🟠 | **There is no Content-Security-Policy.** A `<meta http-equiv="Content-Security-Policy">` limiting scripts to this site plus the pinned CDN, and connections to the Supabase project, would limit the damage from any future injection bug. |
| 3.3 | 🟠 | **"Confirm it's you" (re-enter password) is only checked in the browser.** `requireReauth()` (line 1899) checks the password, then the page performs a normal update. The database doesn't know the re-check happened, so anyone holding a signed-in session could skip it. It is a speed bump, not a lock. Only row-level security in Supabase actually protects data. |
| 3.4 | 🟠 | **Owner-only features are hidden in the browser, not blocked by it.** The page trusts row-level security for real protection. That's correct, but it means every RLS policy must be right. The test suite can't check RLS, because it never touches the real database. |
| 3.5 | 🟡 | **145 places build HTML from strings.** I spot-checked them and they consistently use `esc(...)` on database values, which is good. It is still the most likely place for a future cross-site-scripting bug. One missed `esc()` on a customer-supplied field (inquiry text, customer name) would be enough. |
| 3.6 | ✅ | **The Supabase key in the file is the public "publishable" key**, which is meant to be public. No service-role key, password or other secret was found in the file. |

## 4. Fragile areas and duplicated code (🟠 / 🟡)

- **One giant function.** All 7,300 lines of JavaScript live inside `initApp()`, sharing variables such as `currentUserRole`, `SEARCH_INDEX` and `currentPageId`. A change in one page can quietly affect another.
- **Every page loads on every refresh.** `loadDashboard()` runs every page's loaders. That's about 37 requests after each login or Refresh, even for pages you never open, so a slow table slows everything down.
- **The same error handling is repeated about 116 times** (`try { … } catch (err) { showDashError('Could not …' + err.message) }`). It could be one helper.
- **`supabase.auth.getSession()` is called separately in 10 places** just to get the current user id. There's already a `currentUserId()` helper.
- **There are 19 fetch limits (mostly 100 rows)** that silently drop older records. Tasks warns about this; most other pages don't.
- **Browser `confirm()` pop-ups guard "Mark done" and 3 other actions.** If Safari's "block further dialogs" is ever ticked, `confirm()` returns false, so the action is safely cancelled, but with no message saying why.
- **291 inline `style="…"` attributes** override the stylesheet. That makes layout fixes (especially mobile) hit-and-miss.

## 5. Bug found while writing the tests

- **Sidebar search + Enter opens the wrong page.** Typing `incidents` and pressing Enter opens **Quality Control**, not Incidents. The same thing happens for a task title. The Enter handler always opens the first *Guide* result when one exists. Clicking the right result works. This is recorded as a "known issue" test (`test.fixme`) in `tests/specs/general.spec.js`, so it's visible but doesn't fail the suite. It's a small, safe fix for a later PR.

## 6. Mobile-layout risks

- On phones, tables become side-scrolling boxes (`display:block; overflow-x:auto; white-space:nowrap`). The first column (title and buttons) is visible, and the tests check this for Tasks. **Other columns such as Status and Due need a sideways swipe.**
- Fixed minimum widths are used in 10 places, for example the 190px task title column. Pages with wider content (Purchase Orders, Accounting, Employee Activity) weren't checked with realistic data.
- The tests run Chromium at iPhone size, **not real Safari on an iPhone.** Safari-only quirks (date inputs, `position: sticky`, the address bar changing height) still need your real-phone check.

## 7. Splitting the 505 KB file later (no change now)

GitHub Pages serves plain files, so this can be done step by step with ordinary `<script src>` and `<link>` tags and no build tool. Suggested order, with each step as its own PR:

1. **Move the CSS** (lines 25–967) into `assets/owner.css`. This is the lowest risk: same styles, different file.
2. **Move the shared helpers** (`esc`, `fmtMoney`, `fmtDate`, the error banner and toasts) into `assets/core.js`.
3. **Move one page at a time** into its own file, starting with **Tasks**, since it now has the strongest tests. Possible files:
   - `assets/pages/tasks.js`
   - `assets/pages/purchase-orders.js`
   - `assets/pages/quality-recalls.js`
4. **Load pages when opened** instead of all at login, once they're separate.

The regression suite runs after each step. The dashboard should look and behave identically, and the tests prove it.

## 8. Recommended next dashboard improvements (in order)

1. **Pin the Supabase library version and add an integrity hash** (3.1). This is a tiny change with a big safety gain.
2. **Make "Receive purchase order" all-or-nothing** (2.1 and 2.2). This needs a drafted database function that you review and run.
3. **Fix the search Enter bug** (section 5). It's small, and its test already exists.
4. **Extract the CSS into its own file** (7.1). It's the first safe step toward smaller files.
