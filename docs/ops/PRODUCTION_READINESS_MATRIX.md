# Production readiness matrix (one honest page)

**Status:** CURRENT (2026-10-07, extension 6). Supersedes the stage table in `READINESS_GATE.md` where the two differ (the gate keeps the blocker list). Documentation and drafts are **never** counted as deployed. Percentages are not used here; see `docs/health-endeavors-progress.md`, where they are not raised for unmerged work.

Legend: **LIVE** = on `main` now · **BRANCH** = fixed and tested on the extension branch only, so it needs a merge · **SQL** = needs an approved production database change · **OWNER** = needs a decision · **MANUAL** = needs a person to check (device, real data) · **EVIDENCE** = blocked by missing facts (Query C, backups) · **NOT BUILT** = not implemented anywhere.

## A. Dashboard code

| Area | State | What is still needed |
|---|---|---|
| Basic operations pages (orders, inventory, POs, returns, recalls, compliance, accounting, tasks, agents view) | LIVE | — |
| Stale-tab / double-click protection on 51 status changes | BRANCH | Merge |
| Receive uses the saved order; in-flight edits reported | BRANCH | Merge (prevention: the guard, SQL) |
| Money totals: no double counting mid-read, no "-$0.00", one revenue rule on every page (Accounting, Tax, Daily Summary, home tile, Orders), honest "newest 300" label, mixed-currency warning | BRANCH | Merge. **Live on `main` today: Daily Summary, home tile and Orders revenue are overstated or partial** |
| Sign-out wipes the page (shared computer) | BRANCH | Merge. **Live on `main` today: previous data stays in the page** |
| Manual orders: retry-safe, "Finish this order", typed details wiped on sign-out | BRANCH | Merge (full duplicate-proofing: request keys, SQL) |
| Emergency mode: never claims safety it can't confirm; lost reply = "may or may not" | BRANCH | Merge |
| Plain-language errors incl. undone database steps | BRANCH | Merge |
| Escaping / CSV / link guards; pinned library + integrity; content-security policy | BRANCH | Merge. **`dashboard.html` on `main` puts database text into the page unescaped** |
| Accessibility (keyboard, focus, live regions, zoom, small screens) | BRANCH (automatic checks) | MANUAL: VoiceOver / real iPhone check |
| Signed file links on iPhone Safari (pop-up blocking) | Unknown, same on `main` | MANUAL (X6-22) |
| Stock changes all-or-nothing (receive, recall, return, adjust, delete product) | NOT BUILT in the browser; drafted as R1–R5 | SQL (R1–R5) + EVIDENCE (Query C) + dashboard PR (INV-06) |
| Duplicate-proof creates (request keys) | Drafted (`drafts/19`) | SQL + dashboard PR |
| Line edits during a receive prevented (not just reported) | Drafted guard (`drafts/17`, EXT6 revision) | SQL |
| Partial-quantity returns | NOT BUILT | OWNER (D-ops-5) |
| One active recall per lot | NOT BUILT | OWNER (D-ops-4) + SQL |
| Legal hold blocks related deletes | NOT BUILT (planned only) | OWNER (MU-11) |
| CI on every pull request | Drafted (inactive branch) | OWNER (CI-02) |

## B. Business operations

| Area | State | What is still needed |
|---|---|---|
| Real products in the catalogue with exact SKUs | NOT DONE | OWNER (SH-01) |
| Shopify Order Sync | OFF on purpose | OWNER, after R1–R4 (AG-09) |
| Agents #2/#3/#7/#8 | OFF on purpose; Agent #1 state unverified | EVIDENCE (Query C, AG-01) |
| Refund accounting rule | Status-only today | OWNER / accountant (N4) |
| Backups and restore tests | **UNKNOWN** | OWNER read-only check (X3-25) |
| Elevated database functions callable by anyone (Query D) | Unknown | EVIDENCE (Query D) → SQL (SE-02) |
| Stock / delivery reconciliation | Query E prepared | OWNER runs it (read-only) |
| GitHub access least privilege for Claude sessions | **Admin credential in use** (not used for anything beyond reading) | OWNER (X6-17) |

## C. Live on `main` today and fixed only on the branch (merge closes these)

1. Daily Summary and home "Today's revenue" count Canceled / refunded orders (X6-11).
2. Orders page "Total revenue" covers the newest 300 orders only, cancelled included (X6-12).
3. A zero total can show "-$0.00"; figures can settle in a foreign number format (X6-02/03).
4. Signing out leaves the previous person's data in the page (X6-05).
5. Receiving a delivery uses the page's old copy of the order (X5-01).
6. Money totals can double count a record created mid-read (X5-09).
7. `dashboard.html` shows database text unescaped (EXT3 escaping work).
8. Plus the EXT1–EXT5 list in `CUMULATIVE_CHANGE_INVENTORY.md`.
