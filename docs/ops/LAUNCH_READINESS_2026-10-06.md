# Launch readiness: internal platform (2026-10-06)

**Status:** CURRENT. Covers the internal dashboard/platform only (the public website has its own docs outside this repository). Uses Query A (schema) and Query B ("Query B ran clean; no existing data repair required"). Work on `claude/platform-overnight-implementation` is **not merged and not live**, so it is listed as FIXED ON BRANCH, never as done.

## READY / VERIFIED

| Item | Evidence |
|---|---|
| Existing data needs no repair before the stock functions are installed | Query B ran clean |
| Real schema known for the 18 core tables (columns, value rules, unique keys, row-level security, audit triggers) | Query A |
| Audit trigger on each of the 18 core tables; `audit_log` append-only | Query A |
| Stock, lots, purchasing, recalls, expenses are Owner/Administrator-only in the database; returns, approvals, documents, tasks open to staff | Query A |
| Live dashboard (`main`) uses only the public anon key and the signed-in user's session | code + Query A |

## FIXED ON BRANCH BUT NOT LIVE

All with tests that fail on the old code; full suite numbers in the owner review.

| Area | What | Doc |
|---|---|---|
| Query A bugs | Approval Deny writes `rejected`; rejected = closed everywhere; documents link to suppliers only; orphan files cleaned up | `OVERNIGHT_PLATFORM_REVIEW_2026-10-05.md` §12 |
| Real-schema alignment | Whole-unit catalogue lines, deleted POs locked, case-insensitive SKU, employee restock refused up front | same |
| State machine | Document categories now match the database (5 of 10 used to be refused); every write in every test checked against the real rules | `state-machine-audit.md` |
| Stale tabs / silent refusals | Product delete (permission, stock row kept), 10 delete/edit paths no longer say "done" when nothing changed, escalate-once, payment status, reminders, second press on Receive and Refund | `mutation-safety-audit.md` |
| Storage | No lost files on a dropped reply; no orphans on evidence/receipts/delete; size/type checks | `storage-safety-audit.md` |
| Scale | Calendar notes and inquiry orders no longer build over-long URLs (earlier: Accounting/Tax/Business Health/Daily Summary complete beyond 1,000 rows) | `pagination-scale-audit.md` |
| Agents display | "error"/"fail" statuses show Failed; Agent #1 says "Switch on", not "Enabled" | — |
| Accessibility, empty-database and first-launch states | Labels added; every page clean on empty data | — |
| Extension (2026-10-06, later the same day) | Emergency/No-AI mode reports switch-offs that did not happen; silent-refusal sweep finished (9 more writes); session revoke re-checked; error text never shows internal table/policy names; Activity export complete beyond 500 rows; "unknown" no longer shown as 0 / "off"; one failing table no longer blanks a page; AA text contrast in light and dark; Business Rules, inquiry severity and service status only overwrite what the page showed; safe upload names; bidi-override characters dropped from displayed text | `OWNER_REVIEW_2026-10-06.md` (extension section), `MASTER_PLATFORM_BACKLOG_2026-10-06.md` |
| Supabase library pinned with integrity hash (R7); broad XSS tests (R6); Shopify-sync interlock (R9); no-send tripwires (R10) | earlier rounds | `OVERNIGHT_PLATFORM_REVIEW_2026-10-05.md` |

## NEEDS QUERY C

| Question | Why it matters |
|---|---|
| Does any agent, trigger, scheduled job or other function change stock directly? | Any such path would bypass the R1–R5 checks (D-ops-6) |
| Which agents are on; Agent #1's real state and trigger | Agent #1 (invoices) must be confirmed on before Shopify sync |
| Scheduled jobs and the functions they call | Nothing should keep calling an old path after R1–R5 |
| Row counts per table (incl. the product catalogue) | Owner asked to verify, not assume |
| Value rules for the tables Query A didn't cover (incidents, legal holds, system mode…) | Completes the state-machine audit, e.g. whether incidents accept severity `normal` |

## NEEDS OWNER DECISION

| ID | Decision |
|---|---|
| D-ops-1…6 | Stock-function rollout order, expense date, one recall per lot, partial returns, agents writing stock (`R1-R5-function-design.md` §7) |
| New | Widen the document category rule (Lab report, Invoice, …) or keep the 7 database categories |
| New | Should an active legal hold block deleting related records? |
| Open | Merge order of the open PRs and this branch; activating tests-only CI and making it required |
| Open | Query D: when to run the read-only elevated-function check (prepared, not run) |

## NEEDS PRODUCTION CHANGE (owner runs, after approval)

| Change | Prepared as |
|---|---|
| Install R1–R5 stock functions (one transaction; rollback script ready) | `sql/drafts/10_…`, `11_…` (tested: files 15, 16, stress 30 runs) |
| Then switch the dashboard's stock buttons to call them (separate PR) | not started; waits on the install |
| Any permission tightening found by Query D | not prepared; depends on Query D |
| Optional safety constraints (e.g. `recalled >= 0`, one expense per PO) | not prepared; Query B shows they'd apply cleanly |
| Storage bucket limits/policies review | questions listed in `storage-safety-audit.md` |

## NEEDS SHOPIFY SETUP

| Item |
|---|
| Real products with exact SKUs, identical in Shopify and the dashboard (R8) |
| Sync design decision (D-4); Shopify Order Sync stays **off** until R1–R4 are live and Agent #1 is confirmed |
| Re-enable the order-intake / monitoring workflows only after products exist (R9) |

## NOT NEEDED BEFORE LAUNCH

| Item | Why |
|---|---|
| Further modularization of `owner-login.html` | Maintainability, not correctness; continue after merges |
| "Showing the first 1,000" notices on long lists | Lists are far below 1,000 at launch |
| Product edit conflict guard (two people editing one product) | Single owner/admin at launch |
| Screenshot comparisons as a required CI check | Informational until stable on GitHub runners |

## Honest completion view

Nothing in "FIXED ON BRANCH" is live. Launch-blocking items remain:
1. R1–R5 installed and the dashboard switched to them
2. Query C answered (no other stock writers)
3. Agent #1 confirmed
4. Real products with matching SKUs
5. The open PRs and this branch reviewed and merged one at a time, with a live check after each
