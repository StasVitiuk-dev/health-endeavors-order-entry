# Modularization roadmap (dashboard)

**Status:** CURRENT (2026-10-07, extension 8). Measured on the EXT8 branch. Builds on `modularization-review.md` and `modularization-maps.md` (EXT3/EXT4, kept as history). Rule: **no big rewrite, no build system, no change to sign-in**; each step is small, behaviour-preserving, protected by tests and reversible by one revert.

## 1. Measurements (owner-login.html, EXT8)

| Measure | Value |
|---|---|
| Page size | 554 KB, 9,526 lines, 193 top-level functions (inside `initApp`) |
| Already extracted | `assets/owner-login-helpers.js` (36 KB, 38 pure helpers, API 8, loaded with a content hash and a version check); `assets/owner-login.css` (47 KB) |
| Database calls in the page | 92 `supabase.from(…)` sites |
| DOM coupling | 364 `getElementById`, 152 `innerHTML =` assignments |
| Longest functions (lines, approx.) | `wirePoDetail` 390 · `loadInventory` 343 · `loadReturns` 307 · `loadRecalls` 238 · `loadTaxRecords` 220 · `saveQuickAdd` 216 · `loadDocuments` 208 · `loadEvidenceLocker` 190 · `loadSystemMode` 177 · `requireReauth` 168 |

## 2. Where one edit can break something unrelated

| Coupling | Why it is risky | Mitigation in place |
|---|---|---|
| Shared page globals (`SEARCH_INDEX`, `currentUserRole`, `agentControlsByNum`, `ALL_INQUIRIES`, `currentPageId`) | Search, sidebar badges, Home checks and pages read each other's state | Tests per consumer (search, badges, checks); EXT8 Home checks read their own data instead of other pages' lists |
| Every page renders with `innerHTML` template strings | A missed `esc()` is an XSS hole | `xss-everywhere.spec.js` (every text field, every page) |
| Helpers file vs page version | A cached old helpers file with a new page breaks silently | Content hash in the URL + API version check (refuses to start) |
| `index.html` = copy of `manual-order-entry.html` | Two files must stay identical | Test compares them |
| Sidebar redraws on every background load | Anything drawn inside the sidebar can vanish (EXT8: order lookup results) | Keep state outside the DOM (`ORDER_LOOKUP`), redraw from it |
| Parameterised loads (period, search, month) | Slow older replies drew over newer ones (EXT8) | `newLoadToken(key)` latest-request guard on Accounting, Tax, Activity, Calendar, Evidence |

## 3. Duplication found and handled

| Logic | Places | Status |
|---|---|---|
| Revenue rule (cancelled / fully refunded excluded) | Home tile, Daily Summary, Orders, Accounting, Tax, Home checks | One helper `classifyOrderStatus` (EXT6) |
| Manual orders saved without items | Accounting and the new Home checks | **EXT8: one function `manualOrdersWithoutItems(orders)`** |
| "Open" status lists | Tasks, Approvals, Incidents, Home checks, Evidence | One `CLOSED_WORDS` list and its PostgREST form `CLOSED_IN` (EXT7) |
| Stale-tab guarded update | ~25 call sites | One `updateIfUnchanged` helper (EXT3) |
| Capped list + total + Show more | 6 lists | **EXT8: one `appendMore` helper** |
| Inline status filters for open approvals / tasks in Business Health vs Home checks | 2 | Acceptable for now (different columns read); candidate below |

## 4. Next extraction candidates (safest first)

| Step | What | Risk | Protection |
|---|---|---|---|
| M1 | Move `newLoadToken`, `appendMore`, `LIST_LIMITS` and `pageFromHash` to a small `assets/owner-login-ui.js` (no Supabase) | Low | out-of-order, capped-reads, nav-history specs; asset hash + version check |
| M2 | Move the remaining pure computations out of `loadTaxRecords` / `loadAccounting` (totals from rows) into helpers, leaving the page to read and draw | Low–medium | tax / accounting / money-period oracles compare exact figures |
| M3 | A tiny `query.js` wrapper for "open rows only" reads (`notClosed(q)`), used by Tasks / Approvals / Incidents / Home checks | Low | owner-control-center and attention specs |
| M4 | Split `wirePoDetail` (390 lines) into receive / lines / totals / payment parts, same file | Medium | purchase-orders, po-receive, phone-po-tap, concurrency specs; PO mutants |
| M5 | Move inline `<script>` blocks to files, then drop `'unsafe-inline'` from the Content-Security-Policy | Medium | csp.spec.js, full suite; one page at a time (start with `change-password.html`) |
| M6 | Page-per-file split of the dashboard | High | **Not recommended yet**: needs a loader / router and touches sign-in. Revisit after launch |

## 5. Rules for any extraction

1. One step per commit, tests green before and after, full suite on the frozen commit.
2. Helpers stay pure (no `document`, no Supabase) and keep their unit tests.
3. Bump the helpers API number and the asset hash in the same commit.
4. Never touch the sign-in / sign-out / user-switch code in an extraction commit.
5. Visual snapshots must not change (or only for a stated, reviewed reason).

## 6. Extension 10 (2026-10-11): steps done and the remaining map (U39)

**Status:** CURRENT. Branch `claude/platform-ext10-operations-hardening-2026-10-11`; not merged.

### Done in EXT10 (each behaviour-preserving, each one revert)

| Step | What | Protection |
|---|---|---|
| M5 (first page) | `change-password.html`: its script moved to `assets/change-password.js` (content-hash URL); the page's policy now allows scripts only from this site, the pinned CDN and the frame guard **by its exact hash**; `'unsafe-inline'` removed from `script-src`; the inline `onerror` attribute removed (the script already checks `window.supabase`) | `csp.spec` (policy text, hash match, no inline handlers, sign-in under the strict policy, no violation), `library-pin` (altered library bytes still refused and reported) |
| Helpers API 9 | five pure functions moved to `assets/owner-login-helpers.js`: `newRequestKey`, `fixedRequestKey`, `keyFingerprint`, `nightlyCheckLevel`, `nightlyOverall`; unit-tested in Node (`helpers-unit` "EXT10 helpers"); an old cached helpers file is refused (API check) | `assets.spec` (43 names, none still defined in the page), mutants retargeted to the helpers file |
| Shared request-key path | the 13 remaining creates go through one `insertOnce(el, table, row, what)` instead of 13 hand-written insert + error blocks | `request-keys-ext10` (30 tests), 12 mutants |
| Phone tables | one `labelPhoneCards()` + one CSS block instead of per-table phone code | `mobile-cards-ext10` |

### Measurements after EXT10

`owner-login.html` ≈ 9,950 lines (+≈110 for the Home card and request-key helpers, −≈60 moved out); helpers 43 exports (API 9); new asset `assets/change-password.js`.

### Remaining map (safest first; not started)

| Step | What | Risk | Before starting |
|---|---|---|---|
| M5b | Same as change-password for `search.html`, then `dashboard.html` (small pages, one inline block each) | Low | csp + page specs per page |
| M5c | `manual-order-entry.html` (+ identical `index.html`): move its script to one shared asset so the copy rule becomes "both load the same file" | Medium (order entry is money) | manual-order-entry spec (deep), the identical-copy test rewritten to compare the script reference |
| M5d — **DONE in EXT14** (branch `claude/platform-ext14-deep-engineering-2026-10-11`, `d5db721`; file is `assets/owner-login-app.js`; script `unsafe-inline` off, one hashed boot line; "program did not load" message; 4 module-failure tests) | `owner-login.html`: the big inline script (≈9,000 lines) into `assets/owner-login.js` as ONE file first (no splitting), then `'unsafe-inline'` off for scripts. Inline `onclick`/`onerror` attributes must go first (inventory needed) | Medium–high (one huge move; must be done right after a merge, never parallel to other page work) | full suite + visual + staging build (it rewrites the page) |
| M1 | `newLoadToken`, `appendMore`, `LIST_LIMITS`, `pageFromHash` → `assets/owner-login-ui.js` | Low | out-of-order, capped-reads, nav-history |
| M2 | totals out of `loadTaxRecords` / `loadAccounting` into helpers | Low–medium | money oracles |
| M3 | `notClosed(q)` query wrapper | Low | owner-control-center, attention |
| M4 | split `wirePoDetail` (≈400 lines) into receive / lines / totals / payment | Medium | PO specs + PO mutants |

### Safety notes for any next step

- **Init order:** helpers must load before the page script (`<script src=helpers>` precedes the inline block; the API check stops start-up otherwise). Any new asset must be added the same way with a content hash, or a cached old copy runs with new code.
- **Globals:** page state lives inside `initApp` (closure); moved code must receive what it needs as arguments (helpers file is not allowed to touch `document`, `supabase`, storage or `fetch` — enforced by `assets.spec`).
- **Build order:** there is no build step; GitHub Pages serves files as they are. The staging build (`tests/tools/staging/build-staging.js`) rewrites `owner-login.html` and its helpers only; a moved owner-login script must be added to it in the same change (M5d; done in EXT14: the build now scrubs and re-hashes every asset).
- **Merge conflicts:** big moves only directly after the EXT1–10 branch is merged, never alongside other open page work.

## EXT14 update (2026-10-12)

- **M5d done**: see `ENGINEERING_REPORT_EXT14.md` §3. `owner-login.html` 617 KB → 58 KB.
- **Next (PROPOSED), M7 — split `owner-login-app.js` by feature behind explicit interfaces.** The closure shares about 300 variables. Do it one feature at a time (first: System status / diagnostics, then Reports), each exposing a small object on `window.HE`, with the full suite, the 170 mutants and the staging build after each step. Not started in EXT14, because it cannot be proven safe in one round.
