# Blueprint checklist, rebuilt from the evidence in this repository

Status: CURRENT · 2026-11-22 · For: Stas · counts OWNER DECISION REQUIRED (reconciliation)
Scope: what this repository can prove about the 90-item blueprint, item by item,
with links to the evidence. Nothing here is live: the branch is not pushed or merged.

## 1. The counts: previously reported, awaiting reconciliation

| Count | Figure | Where it comes from | Label |
|---|---|---|---|
| Live on `main` | 51 of 90 | Your recount of Sept 26, copied into `docs/PROJECT_RECORD.md` §7 from the old-chat documents; never re-audited in this repository | **PREVIOUSLY REPORTED, AWAITING RECONCILIATION** |
| Built and tested on the branch | 14 | The Nov 14 stage tally in `docs/ops/NOV7_STAGING_REVIEW_AND_OWNER_CHECKLIST.md` §10 (13 with page tests, 1 as tested logic) | **PREVIOUSLY REPORTED, AWAITING RECONCILIATION** (the 14 items are listed and re-checked below; whether they overlap the 51 is unknown) |
| Remaining | 25 | Arithmetic only: 90 − 51 − 14. No list of these 25 exists in the repository | **PREVIOUSLY REPORTED, AWAITING RECONCILIATION** |

Do not add the 14 to the 51. Four of the 14 (#21, #25, #70, #71) were recorded as
"partial" before this work, and the Sept 26 figure counts "3 partial items as half".
Some of the 14 may therefore already be part of the 51.

## 2. What was searched

| Source | What it holds about the blueprint |
|---|---|
| `docs/PROJECT_RECORD.md` §7 and §10 | The 51 / 90 figure and its basis (Build Now 11 + Build Soon 28 + Future 51). States that the full list is in your private *Blueprint Checklist*, kept out of this public repository on purpose |
| `docs/ops/NOV7_BUILD_HANDOFF_2026-11-07.md` | The Nov 7 hand-off: phases and capabilities, not the numbered list |
| `docs/ops/NOV7_STAGING_REVIEW_AND_OWNER_CHECKLIST.md` | The numbered items worked on, before and after, with tests and commits (§1, §8, §10) |
| `docs/ops/NOV7_STAGING_BACKLOG_STATUS.md`, `NOV7_EXECUTION_LIST.md`, `NOV7_PROGRESS_CHECKLIST.md`, `NOV7_RELEASE_REVIEW_ONEPAGE.md`, `NOV7_BOUNDED_REVIEW.md` | Execution order, test records, #24 / #36 |
| `docs/ops/BLUEPRINT_PRIORITIES_2026-11-16.md` | Five priority areas; confirms only 16 numbers are used in this repository |
| `docs/ops/OWNER-REVIEW-PACKAGE.md`, `docs/ops/NOV7_REVIEW_PACKAGE.md` | Review packages: no numbered list |
| `docs/ops/backlog/items.py` (and the generated `MASTER_PLATFORM_BACKLOG_2026-10-06.md`) | Our own engineering backlog (INV-, SEC-, … IDs). A different list from the blueprint; IDs do not map one to one |
| Every branch's history | No blueprint list file has ever been committed |

## 3. The 16 blueprint numbers this repository knows

Re-checked on 2026-11-22 at commit `4b1ac22` (Chromium on Linux, made-up data,
computer and iPhone size): **109 passed, 0 failed** (18 skipped because they run at
one screen size only), plus the sales page test 22 of 22 and the database tests in
section 4.

| # | Item (as named in the Nov 7 checklist) | Before (Nov 7) | Stage now (staging only) | Evidence | Nov 22 re-check | Live |
|---|---|---|---|---|---|---|
| #08 | Payment reconciliation review | not started | page tested | `reconcile-ext21` (12), `reconcile-wiring-ext21` · `44b91e0` | passed | no |
| #12 | Supplier scorecard (delivery accuracy) | open | page tested (read-only) | `supplier-scorecard-ext21` (5) · `c2d69ea`; `supplier-scorecard-wiring-ext21` · `44b91e0` | passed | no |
| #17 | Public intake protections (request limits) | open | **logic only**: the form it protects is in the public website project | `intake-export-guard-ext21` (6) · `61ef953` | passed | no |
| #21 | Manual fallback + pause/recovery | partial | page tested | `ops-fallback-ext21` (3) · `fa8bc11`; sales page test `sales-wiring-ext20j` · `9384fd1` | passed | no |
| #24 | Measured screen baselines | — | document; measured on the substitute browser only | `performance-scale`, `request-baseline`, `sales-decision-perf-ext20k` · `62eef9c`, `0cd75ad` | passed (substitute browser) | no; re-measure in CI after the push |
| #25 | Service health (stale / last success / error + next action) | partial | page tested | `sales-health-ext21` (5) · `f9625c2`; `sales-wiring-ext20j` | passed | no |
| #26 | Operations watch (unusual figures, stock, orders) | not started | page tested | `ops-anomaly-ext21` (11), `ops-watch-wiring-ext21` · `d0011ea` | passed | no |
| #27 | Complaint trends (packaging / pump / quality) | open | page tested | `sales-feedback-ext21` (7) · `8689ddf`; `sales-wiring-ext20j` | passed | no |
| #36 | Change / release record | — | document | `62eef9c`, `0cd75ad`; `NOV7_BOUNDED_REVIEW.md` | n/a (document) | no |
| #53 | Supplier document validation | open | page tested (read-only), and the storage draft 36/38 | `supplier-scorecard-ext21` · `c2d69ea`; review item 4 (125, 30 and 63 database checks, re-run Nov 22) | passed | no |
| #54 | Cycle counts (draft count + discrepancy) | open | page tested | `inventory-count-ext21` (11) · `49c422a`; `cycle-count-wiring-ext21` · `44b4822` | passed | no |
| #55 | Adjustment approval + audit | open | page tested; database draft 34 | as #54; `stock_count_adjustments_test.sh` 90/90, `stock_count_apply_once_test.sh` 17/17 (re-run Nov 22) | passed | no |
| #65 | Saved views and filters | open | page tested | `saved-views-ext21` (8) · `4542476`; `saved-views-wiring-ext21` · `79982fb` | passed | no |
| #70 | Scheduled reports | partial | page tested | `report-schedule-ext21` (5) · `f629b49`; `report-versions-wiring-ext21` · `8a2c7b6` | passed | no |
| #71 | Report versioning + reruns | partial | page tested | as #70 | passed | no |
| #72 | Export watermarking (traceable label) | open | page tested | `intake-export-guard-ext21` · `61ef953`; `ops-preview-wiring-ext21` · `acfdb1a`; `report-print-view-ext21` | passed | no |

Counted the way the Nov 14 tally counted: 13 page-tested (#08, #12, #21, #25, #26,
#27, #53, #54, #55, #65, #70, #71, #72) + 1 logic-only (#17) = the reported 14;
#24 and #36 are documents and were not counted.

## 4. Blueprint-related work with no blueprint number in this repository

These were built for your decisions or the Nov 7 phases. Their blueprint number,
if they have one, is **UNKNOWN** here.

| Work | Stage (staging only) | Evidence |
|---|---|---|
| Invoices: drafts, print, numbering, void, payments, tax pending | page tested; database draft 32 revised Nov 22 | `invoice-*` specs; `invoices_test.sh` 161/161; review item 1 |
| Partial receiving and returns (backlog INV-17, D-ops-5) | prototype page; database draft 40 | `partial-receiving-ext22`; `partial_receiving_test.sh` 74/74; review item 5 |
| Scan Shipment (Phase 1, B11-01) | page tested | `scan-*` specs; `NOV7_STAGING_REVIEW_AND_OWNER_CHECKLIST.md` |
| Daily report day cutoff (decision 4) | read-only Query I | `report_day_cutoff_test.sh` 24/24; review item 3 |
| Sales workflow panels (W-0 … W-5) | page tested | `sales-wiring-ext20j` 22/22 |

## 5. Unknown (cannot be verified from this repository)

- The names, numbers and status of the other **74** blueprint items (90 minus the 16 above).
- Which 51 items are counted as live, and which 3 are the "partial" ones.
- Whether #21, #25, #70 and #71 (partial before) are already inside the 51.
- Which category (Build Now, Build Soon, Future) each of the 16 numbers belongs to.
- Whether "25 remaining" is a real list or only the difference.
- Whether anything counted as live on Sept 26 has changed since (nothing has been merged since, but it was never re-audited).

To reconcile, I need only the **number, short title and your status** for each of
the 90 items, nothing else from the private checklist (it holds sensitive details,
and this repository is public). Alternatively, tell me which of the 16 above were
already in your 51, and I correct the counts from that.

## 6. Work that can continue without the reconciliation

None of these needs the counts settled, production access or a push:

1. **Partial receiving screens:** connect the Inventory and Purchase Orders screens to the draft 40 functions behind a switch, with page tests against the local database (as was done for supplier documents).
2. **Invoice payment screen:** record a payment and a reversal through the draft 32 functions (the database part is tested; there is no screen yet); feed it into the reconciliation view (#08).
3. **Stock-count approval screen** against draft 34 (approve once, refuse twice), with page tests.
4. **#17 intake limits:** write the hand-over note for the public website project (the logic is tested here; the form lives there).
5. **Keep the evidence fresh:** re-run this checklist's tests on every commit that touches these areas.

Waiting on you, not on engineering: the push (then #24 in CI and new reference
pictures), the palette choices C1–C7, the tax answers, and the SQL approvals.

## 7. Reconciliation of everything approved after Nov 22 (owner queue of Nov 25, task 10) — CURRENT

The 90-item list itself is private and not in this repository (§1), so its counts stay
**PREVIOUSLY REPORTED, AWAITING RECONCILIATION**. What this section does instead: every
approved addition since Nov 22, counted **once** by area (several cumulative PRs carry the
same work; the PR named is the one that first holds it), with the evidence. Labels:
**Merged** = on `main` (live code, usually behind a switch that is off) · **Open** = in a PR
not merged · **Draft** = a database step not installed · **Running** = actually working on real
data. Nothing in this section is Running unless it says so.

### 7a. Features and fixes

| Area | What | First PR | Tests (examples) | Needs (database / provider) | State | Remaining / owner action |
|---|---|---|---|---|---|---|
| Agents and the feed | Agent diary; agents at a glance; agent hand-offs "Handled" | #46, #64, #79 | `agent-diary-ext24`, `attention-feed-ext24` | draft 50 for "Handled" on every device | Merged (#85 chain) | turn switches on |
| Money | Real profit; money per channel; real fee and postage; packaging cost per box | #49, #52, #54, #62 | `real-profit-ext24` | drafts 50, 52 | Merged; drafts not installed | costs entered by the owner; sittings A, 10 |
| Printing and records | Daily recap; day pack; client list; weekly owner report; automatic daily printing (page side) | #48, #63, #66, #88, #74 | `backups-page-ext22`, `auto-print-ext24` | printers | Merged | real printers (pending) |
| Orders and shipping | Sales channel on every order; drop-off parcels; batch stickers and batch on each order; delivery watch | #59, #56, #57, #58 | `order-slips-ext22`, `batch-labels-ext24` | drafts 48, 54 | Merged; drafts not installed | sittings 9, 11 |
| Shared settings | Same numbers and switches on every device; drafts on every device; "My settings"; two devices never erase each other | #50, #53, #73, #78, #106 | `shared-switches-ext24`, `shared-settings-race-ext25` | drafts 50, 58 | Merged except #106 (open) | sittings A, 13 |
| Growth (approved agents' pages) | Store Campaigns + store finder; Customer Emails; Content Helper; Reviews page; receipt text on Expenses; morning summary to copy | #65, #72, #71, #70, #82, #67, #68 | `store-campaign-ext24`, `customer-emails-ext24`, `review-inbox-ext24` | drafts 56, 60; a business email for any real sending | Merged; nothing sends | real sending is a separate owner approval |
| Home and owner tools | Customers first; Ready to launch page; Ask the dashboard (voice, stage 1); what administrators changed | #87, #89, #91, #97 | `launch-page-ext25`, `admin-changes-ext25` | — | Merged | turn switches on |
| People and roles | New Employee: four levels, People page, sign-in helper; administrators near-owner (settings, tax, campaigns, deliveries, returns, supplier documents); managers; owner protection | #90, #95, #96, #98–#100, #102–#105 | `people-page-ext25`, people and helper database tests | drafts 50, 46, 56, 40, 36/38, 62/64; helper deploy | #90–#101 merged; #102–#105 open; nothing installed | sittings; private-history read-only look |
| Fixes | Invisible number on a coloured Home tile; two saves on "Later"; saved campaigns count every email; one shipping email per order | #94, #85, #84, #108 | `tile-figure-ext25`, `staging-rehearsal-ext25` | — | Merged except #108 (open) | — |

### 7b. The AI agents (none runs by itself unless stated)

| Agent | What exists in this repository | State | Remaining | Owner action |
|---|---|---|---|---|
| #1 Invoice | invoice engine, desk, storage draft 32, payments | built, tested; draft not installed | sitting 6 | tax answers, sitting |
| #2 Order Intake | order checks, channel import from files | built for files; automatic intake not built | Shopify feed (draft 42 + daily program) | sitting 7 |
| #3 Order Monitoring | attention feed rules for unpaid/unpacked orders | built (page side) | runs when the feed is on | switch on |
| #4 Retail/Wholesale | Store Campaigns, store finder, outreach drafts | built; sends nothing | real sending | business email, approval |
| #5 Shipping/Tracking | delivery watch, parcels (draft 48) | page side built; "live in Supabase" is **REPORTED** for an earlier version, not re-verified here | sitting 9 | — |
| #6 Customer Notification | notice drafts; one shipping email per order (#108) | built; sends nothing; "live" **REPORTED** for an earlier version | real sending | decision D1 stays "approve first" |
| #7 Customer Service | inquiry replies to copy; Reviews page | built; sends nothing | sitting 14 | — |
| #8 Supervisor | agent diary, agents at a glance, 24-hour raise to urgent | built (page side) | runs with the feed | switch on |
| #9 Accounting | money matching, payouts, money per channel | built; needs draft 42 for stored differences | sitting 7 | — |
| #10 Tax Record | tax records page, confirmed rates (draft 46) | built; draft not installed | sitting 8 | tax answers |
| Growth helpers | store finder, outreach, customer email, review request, receipt inbox, morning summary, sending guard | each "not running by itself" (agents overview says exactly what is built) | listings service account; email reading; scheduled sending | each its own decision |

### 7c. Declined or deferred (kept apart; not counted as remaining work)

| Item | Decision |
|---|---|
| Automatic "low stock → purchase order draft" | **Declined** (do not ask again) |
| New buttons, fonts or shapes (PR #92) | **Declined**: design stays as it is; display faults are still fixed |
| Voice assistant stage 2 (paid AI) | **Deferred**: owner decision after launch |
| One stock count for all channels | **Waits on owner** (decision + read-only look) |
| Two-step sign-in | **Deferred** to the last launch lines |

### 7d. Suggestions recorded, not built (for the owner to choose later)

- A Home warning when the newest backup is older than a day (§8 of `RECOVERY_AND_BACKUP_READINESS.md`, E7; waits on D5).
- Let managers approve deliveries or supplier documents (owner question, PR #104).
