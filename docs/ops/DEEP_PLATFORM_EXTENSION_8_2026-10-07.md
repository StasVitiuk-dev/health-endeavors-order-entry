# Deep platform readiness: extension 8 (2026-10-07 → 2026-10-10)

**Status:** CURRENT. Branch `claude/platform-deep-readiness-extension-8-2026-10-07`, created from extension 7 (`f868903`). **Not merged, not deployed. Production not touched.** `main` is unchanged at `d3db7bc`. Dashboard / platform only: the website, Real Estate OS, the backups repository, production Supabase, Shopify and Gmail were not opened.

Plain-English summary for Stas: this pass found and fixed **12 more real problems** (most of them are live on the site today), added an owner **"Checks: what needs a look"** list on Home, ways to reach older orders and records, browser Back that stays inside the dashboard, a read-only **daily integrity check** (Query F) and a rehearsed restore on a throwaway local database. It also built a **staging review copy** that runs on made-up data and cannot reach production; where to show it is your choice (§7). Nothing needs a database change to merge.

## 1. Start-of-session check (read-only)

| Check | Result |
|---|---|
| Account the session acts as | `StasVitiuk-dev` (owner), **admin + maintain + push** (re-checked 2026-10-10). Expected `stasvitiuk-reos`, push only. **Not used** for anything beyond reading. Recommendation: §6 |
| Repositories in scope | This repository only |
| `main` | `d3db7bc`, unchanged |
| Ruleset `protect-main` | Unchanged from EXT7 (PR, 1 approval, code-owner review, last-push approval, no force push / deletion; admin bypass) |

## 2. Bugs fixed (each has a test that fails on the old code)

| ID | Problem (plain English) | Live on `main`? | Fix | Test |
|---|---|---|---|---|
| X8-01 | With many answered customer questions, questions still waiting could be hidden | Yes | Every waiting question is read; answered ones capped at 100 with an exact count | capped-reads |
| X8-02 | Returns could only be started for the newest 200 orders | Yes | "Older order? Type its number" finder | capped-reads |
| X8-03 | Sidebar search silently missed orders older than the loaded ones | Yes | "Look up … in all orders" (literal match: `%` / `_` are not wildcards) | capped-reads |
| X8-04 | Recycle bins and histories stopped at 50 with no hint | Yes | "Showing the N most recent of M" + Show more (6 lists) | capped-reads |
| X8-05 | The evidence picker missed older open incidents | Yes | Open incidents of any age + newest 200 | capped-reads |
| X8-06 | Browser Back left the dashboard entirely | Yes | Page history (`#page=`), Back/Forward between pages, deep links | nav-history |
| X8-07 | Returning with the Back button after signing out could show the cached page | Yes | Session re-checked on back-cache return; different user wipes | auth-chaos |
| X8-08 | "This Week" meant different windows on Orders and Expenses | Yes | One "Last 7 days" (local midnight 7 days ago) | money-periods |
| X8-09 | Two tabs editing the same product: the later save silently overwrote the earlier | Yes | Save refused if the product changed meanwhile (`updated_at`) | pages-data |
| X8-10 | Same for purchase-order shipping and tax | Yes | Conditional on the values shown | purchase-orders |
| X8-11 | Switching period / month / search quickly: a slower older reply drew over the newer one (Accounting, Tax, Activity, Calendar, Evidence) | Yes | Latest request wins (`newLoadToken`) | out-of-order |
| X8-12 | Five pages had no Content-Security-Policy | Yes | Strict policy on every page; pages work under it | csp |

## 3. New features (safety, auditability, efficiency only)

- **Home "Checks: what needs a look"** (workstream C): 17 deterministic checks with severity (data problem / could not check / to do / worth knowing), reason ("Why is this here?"), source, oldest timestamp, an Open link to the page, and "Hide until it changes" (never for data problems, unknown checks or backups). "Could not check" is never shown as zero; switched-off features are grey, not red; **backups are always UNKNOWN** here.
- Order finder (returns), all-orders lookup (search), Show more on capped lists.
- Page history and deep links; approval outcome toast.
- **Query F** (read-only daily integrity check, 15 checks) and **restore drill** (local only).
- **Staging review copy** (synthetic data, §7).

Rejected ideas (documented, not built): automatic reordering, AI replies to customers, auto-restart of agents, "mark all as seen" on the Checks list (would hide data problems), confirmation on PO line Remove (the line is re-addable and the PO is a draft; a dialog would slow the common case).

## 4. Matrices, oracles and inventories

| Workstream | Result | Where |
|---|---|---|
| A. Write paths | 99 paths: 27 money, 24 stock, 22 personal; 70 safe, 23 need request keys, 6 client-side only; 34 server rules UNKNOWN until Query D; 0 without a test | `WRITE_PATH_INVENTORY.md` (+ JSON), `DATA_INTEGRITY_AND_CONCURRENCY_MATRIX.md` |
| A. Races | Lost-update reproducers for product and PO totals (fixed); PO line vs receive and stock races re-run locally (§9) | concurrency specs, local scripts |
| B. Money oracle | Period boundaries on a pinned Central clock (Intl oracle); both policies for orders without items tested (X6-14 not decided for you) | money-periods.spec |
| C. Control center | Above | attention-checks.spec |
| E. Product / purchasing | Lost updates fixed; low-stock rule strict `<` threshold, as the Inventory page | attention-checks, purchase-orders |
| F/G. Human control, navigation | Back/Forward, deep links, toasts, older-record finders | nav-history, capped-reads |
| H. Security | CSP everywhere; back-cache re-check; GitHub credential still admin (§6) | csp, auth-chaos |
| I. Recovery | Local restore drill 6/6; backup health UNKNOWN | `RECOVERY_AND_BACKUP_READINESS.md` |
| J. Accessibility / mobile | New controls: names, keyboard, 320 / 390 / 1100 px, 200% text | a11y-ext8.spec; VoiceOver / real iPhone: **BLOCKED (manual)** |
| K. Capped reads | Every capped list audited; open work never capped | capped-reads.spec, `pagination-scale-audit.md` |
| L. Failure injection | Out-of-order replies, failed checks, partial reads | out-of-order, attention-checks |
| M. Modularization | Two shared helpers extracted; measured roadmap M1–M6 | `MODULARIZATION_ROADMAP.md` |
| N. Audit quality | Gaps ranked by risk | `AUDITABILITY_REVIEW.md` (EXT8 section) |
| D. Automation | D1–D11 with BUILD NOW / LATER / DO NOT BUILD | `AUTOMATION_AND_AGENT_ARCHITECTURE.md` |

## 5. Test quality audit and skip ledger (workstream Q)

See §9 for the counts on the frozen commit. Ledger rules (`tests/tools/skip-report.js`): a skip is acceptable only as a screen-size scope skip (the test runs at the other size) or a recorded `test.fail` for a known blocked bug. Anything else fails the tool.

| Class | Meaning |
|---|---|
| EXPECTED DEVICE/SIZE | Logic, Node-only and static checks run once at desktop size; touch-only at iPhone size |
| KNOWN BLOCKED BUG (`test.fail`) | The browser stock workflows and PO receive are not all-or-nothing until R1–R5 are installed |
| ENVIRONMENT LIMITATION | none |
| UNEXPLAINED | must be 0 |

Weak spots found and handled in EXT8: one ineffective mutant (a limit later overridden by paging) replaced; fixture inventory rows without ids (unrealistic) fixed; request baseline missed one changed read and was caught by its own test.

## 6. Security: GitHub credential (X6-17, still open)

The session's GitHub connection is the owner account with admin rights. It was used only to read. **Minimum permission recommended:** Claude sessions use `stasvitiuk-reos` with the **Write** role (branches and pull requests; cannot merge to `main`, change settings or bypass the ruleset). Owner step: claude.ai → Settings → Connectors → GitHub → sign in as `stasvitiuk-reos`; optionally restrict the ruleset bypass to "pull requests only".

## 7. Staging review (workstream O)

**URL: NOT AVAILABLE.** No approved staging host exists; GitHub Pages of this repository is production. The copy is **built and tested** (`tests/tools/staging/`, `staging-build.spec.js`): production address and key replaced, synthetic data, no outside contact, read-only sign-in fields, banner "DEVELOPMENT / STAGING — NOT PRODUCTION". Smallest owner step: say *"Publish the staging copy as a private claude.ai page"* (details and two alternatives: `STAGING_REVIEW_PLAN.md`).

## 8. Final roadmap (workstream R)

Dependency order runs top to bottom inside each priority.

| Priority | CLAUDE CAN SAFELY DO | OWNER APPROVAL REQUIRED | PRODUCTION ACCESS REQUIRED | MANUAL REAL-DEVICE TEST | EXTERNAL INFORMATION REQUIRED |
|---|---|---|---|---|---|
| **P0** (before relying on production) | Keep the branch green and re-verify after any base change | Merge the EXT8 branch (fixes live bugs); switch Claude to `stasvitiuk-reos` (X6-17) | Backup check (read-only, owner); run Query C, D, E, F (read-only, owner) | — | — |
| **P1** (before launch) | Dashboard PR to use R1–R5 once installed (INV-06); request-key dashboard PR after draft 19 | R1–R5 + guard 17 install plan (D-ops-1/2/6); RPO/RTO (X8-D5); N4 refund rule | Install R1–R5, guard 17, request keys (each approved); restore drill into a throwaway project | VoiceOver + iPhone Safari pass; signed links on Safari (X6-22) | Accountant: N4, X6-14 policy (X8-D3) |
| **P2** (soon after launch) | M1–M3 extractions; card layout for wide tables on phones (X7-15); show Query F's last result on Home (after scheduling) | Staging host (X8-D1); employee approvals (X7-14a); Query F thresholds (X8-D4); backup status row (X8-D6) | Schedule Query F (pg_cron, read-only); audit trigger extension (X3-18) | Real-device check of the Checks card | Query D results (server rules for 34 paths) |
| **P3** (later) | M4–M5 (split PO detail; drop `'unsafe-inline'`); agent heartbeat design (D6) | Automation choices (X8-D7); claims review queue (D8) | Agent supervisor table (D6) | — | Legal input for claims (D8); invoices table shape (D2) |

## 9. Final evidence

PENDING (filled in after the frozen-commit verification).
