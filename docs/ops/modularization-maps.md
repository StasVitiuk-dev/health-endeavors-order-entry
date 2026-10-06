# owner-login.html: structure maps and extraction progress (2026-10-05)

Generated from the code on `claude/platform-overnight-implementation`, which contains the 20 open PRs plus this night's fixes. The numbers come from a script, not by hand.

## 1. Load and start-up order

1. `<head>`, in this order:
   1. Supabase library (pinned + SRI)
   2. `assets/owner-login.css?v=…`
   3. `assets/owner-login-helpers.js?v=…` (pure helpers → `window.HE.helpers`)
   4. the tiny pre-paint theme script
2. Body HTML: login screen, app shell, 30 page `<section>`s, overlays.
3. Main inline script:
   1. error banners (`error`, `unhandledrejection`)
   2. **start-up checks**, in order: library loaded → helpers loaded → helpers API = 3 (since 2026-10-06) → `initApp()`
4. `initApp()` runs top to bottom, once:
   1. takes the 21 helpers from `window.HE.helpers`
   2. creates the Supabase client
   3. defines **191 functions** (63 async), **40 top-level `let`** (shared state) and **84 top-level `const`**
   4. wires event listeners as it goes: many small IIFEs and `addEventListener` calls at definition time
   5. at the very end: `getSession()` → if logged in, `showDashboardFor(user)`
5. `showDashboardFor`:
   1. reads the profile (role, active)
   2. `renderSidebar` → `showPage(lastPage)` → `loadDashboard()`, which runs the `PANEL_LOADERS` for the pages
6. Afterwards:
   - a 5-minute quiet refresh, current page only
   - back online → `loadDashboard()`
   - each page's loaders also run when that page opens

**Consequence for further extraction:** functions are hoisted, but `let`/`const` are not. Anything moved out must not run before `initApp` has defined what it uses. Feature modules therefore need the `HE` namespace plus a `99-start.js` that registers the loaders at the end (plan step 3).

## 2. Shared state (the 40 top-level `let`s)

| Group | Variables |
|---|---|
| Session/user | `currentUserEmail`, `currentUserRole`, `activeReauthClose` |
| Navigation/search | `currentPageId`, `LAST_SEARCH_RESULTS`, `HELP_CURRENT`, `PAL_ITEMS`, `PAL_SEL`, `goArmed`, `goTimer`, `navSuppress`, `rowCursorEl` |
| Activity / Inspector | `ACTIVITY_OFFSET`, `ACTIVITY_ROWS`, `ACTIVITY_PERSON`, `ACTIVITY_HOVERED`, `INSPECTOR_HISTORY`, `INSPECTOR_ROW`, `INSPECTOR_TAB`, `INSPECT_TARGET` |
| Purchasing / QC | `PO_OPEN_ID`, `PO_PRODUCTS`, `PO_LOTS`, `QC_LOTS` |
| Calendar | `calMode`, `calView`, `calCursor`, `calEvents`, `calNotes`, `calHidden`, `calOpenUid` |
| Agents / ops | `agentControlsByNum`, `agentControlsState`, `cronJobStatusByName`, `ALL_INQUIRIES`, `INQUIRY_ORDER_BY_ID`, `REPORT_HISTORY_DATA`, `reportHistoryView`, `SYSTEM_MODE_SEEN` |
| Money | `acctRange`, `taxRange`, `TAX_REPORT` |

Plus `SEARCH_INDEX`, a `const` object written by 19 loaders and read by search and the palette.

## 3. DOM assumptions

- 229 distinct `getElementById` IDs are used; **all 229 exist** in the HTML (checked by script).
- Pages are `<section class="panel" id="…Panel">`, and each loader writes into its own `…Wrap`/`…Stats` element.
- Rows carry their identity in `data-*` attributes (`data-id`, `data-return-id`, `data-status`, …). The guarded updates added this night read `data-status`.

## 4. Data access

- **37 tables**, read and written directly with `supabase.from(…)`, and **7 RPCs**: `employee_activity`, `employee_activity_people`, `employee_activity_areas`, `list_my_sessions`, `log_customer_data_access`, `get_agent_cron_status`, `revoke_my_session`.
- **Shared access helpers (new this night, inside `initApp`):**
  - `updateIfUnchanged` (guarded update, exactly one row)
  - `changeStock` (compare-and-set stock)
  - `fetchAllRows` (paged reads with an exact count)
  - `confirmSecondPress` (two-press confirmation)
  - `isNetworkError`, `staleMessage`
- **Not moved yet:** they use the Supabase client and the error banner from the closure. They move together with "core" (`10-core.js`) in a later step.

## 5. Extracted so far (each step: full suite, visual snapshots identical)

| Step | What | Size effect | Guarding tests |
|---|---|---|---|
| 1 | `<style>` → `assets/owner-login.css` (byte-for-byte); 2 identical base64 icons → `assets/owner-login-icon.png` | 535,811 → 473,175 bytes | `visual.spec.js` 20/20 pixel-identical; `assets.spec.js` (content-hash `?v=`) |
| 2 | 21 pure helpers → `assets/owner-login-helpers.js` (IIFE, frozen `window.HE.helpers`, API 1) | → ~464 KB | `helpers-unit.spec.js` (now reads both files); `assets.spec.js` (names, purity, load-failure and old-API guards); full suite |
| 2b (2026-10-06) | 7 more pure helpers → the same file, API **2**: `isNetworkError`, `boolGuard`, `noRowsChanged`, `staleMessage`, `explainDbError`, `UPLOAD_MAX_BYTES`, `uploadProblem` (moved text unchanged; the page takes them from `window.HE.helpers`) | −49 lines from the page | `helpers-unit.spec.js` (5 new unit tests), `assets.spec.js` (hash, old-API guard), full suite |
| 2c (2026-10-06) | `confirmSecondPress`, `uploadStamp`, `safeStorageName` → the same file, API **3** (31 helpers) | −35 lines from the page | `helpers-unit.spec.js` (3 new unit tests), `assets.spec.js`, full suite |

**No build step.** GitHub Pages serves the files as they are. A browser holding an old cached file can't run mixed code: the page refuses to start and asks for a reload.

## 6. Boundary: where extraction stopped, and why

I stopped before step 3 (the `HE` namespace + start registry + feature modules) because:
- it needs the 20 open PRs merged first (they edit the same regions)
- the stock pages should keep their current shape until the R1–R4 database functions replace their request chains (`modularization-review.md` §2)

**Next safe candidates, in order:**
1. the upload flow (`uploadThenSave`) with `supabase` passed in (`confirmSecondPress` moved in step 2c)
2. the access helpers, moved with `supabase` passed in
3. the Tasks page (best tested)

## Step 2d (2026-10-06, extension 3): date ranges, API 5

Moved from `owner-login.html` to `assets/owner-login-helpers.js`:
- `localDateString`
- `acctRangeStart`
- `taxRangeStart`

All three are pure and now take an optional "now", so the Central-time boundaries (local midnight on the 1st, Jan 1, a US evening) are unit-tested directly (`helpers-unit.spec.js`, run with the Chicago time zone). The helpers file now holds 35 names; API 4 → 5, so a page with a cached older helpers file refuses to start and asks for a reload. Behaviour is unchanged: the request baseline is identical and the screenshots are unchanged.

Also added in extension 3, without a step number: `numberInputError` (API 4).
