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
