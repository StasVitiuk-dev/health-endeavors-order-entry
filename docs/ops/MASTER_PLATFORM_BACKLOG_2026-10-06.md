# Master platform backlog (2026-10-06)

Internal dashboard/platform only. Generated from `docs/ops/backlog/items.py` (edit the data there, then run `python3 docs/ops/backlog/items.py`). No production secrets or private business data.

**209 deduplicated items** from 264 raw candidates (55 duplicates merged: the same item recorded in PROJECT_RECORD, the overnight review, PRs, owner lists, decision registers and tests).

Status counts: BLOCKED-EXT 2, BLOCKED-OWNER 31, BLOCKED-PROD 12, BLOCKED-QC 11, DEFERRED 20, DONE 131, QUEUED 2

| Priority | Items | Done (branch) | Remaining |
|---|---|---|---|
| P0 | 14 | 4 | 10 |
| P1 | 53 | 37 | 16 |
| P2 | 64 | 45 | 19 |
| P3 | 65 | 45 | 20 |
| P4 | 13 | 0 | 13 |

Priorities: P0 data loss / security / financial corruption / destructive · P1 launch blocker / correctness / concurrency / permission · P2 reliability / scale / accessibility / major UX · P3 maintainability / tests / docs · P4 future.

"Done" = implemented and tested on `claude/platform-overnight-implementation` — **not merged, not live**.


## P0

| ID | Area | Item | Why it matters | Launch impact | Effort | Depends on | Safe in branch | Owner | Prod | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| AG-01 | Agents | Agent #1 (invoices) state verified ON before real orders | Orders without invoices | Blocker | S | Query C §1/§3 | N | Y | N | BLOCKED-QC |
| DOC-07 | Docs | Query C run and results analysed | Unblocks SM-04..06, INV-22, AG-01/04 | Blocker | S | owner runs it | N | Y | Y | BLOCKED-OWNER |
| INV-01 | Inventory | Install R1 receive_purchase_order (all-or-nothing receive) | Double stock + duplicate expense on retry/drop (reproduced) | Blocker | L | Query C; owner approval | N | Y | Y | BLOCKED-PROD |
| INV-02 | Inventory | Install R2 quarantine_recall | Quarantine twice / partial on drop | Blocker | M | Query C; approval | N | Y | Y | BLOCKED-PROD |
| INV-03 | Inventory | Install R3 receive_return | Double restock on drop | Blocker | M | Query C; approval | N | Y | Y | BLOCKED-PROD |
| INV-04 | Inventory | Install R4 adjust_inventory | Lost updates / below-zero race in the browser path | Blocker | M | Query C; approval | N | Y | Y | BLOCKED-PROD |
| INV-06 | Inventory | Dashboard PR: call R1–R5 instead of multi-step table writes | The browser path stays non-atomic until switched | Blocker | L | INV-01..05 installed | P | Y | N | BLOCKED-PROD |
| INV-22 | Inventory | Agents/automations writing stock directly (D-ops-6) | Would bypass R1–R5 | Blocker | S | Query C §5–7 | N | Y | N | BLOCKED-QC |
| SE-01 | Security | Query D: elevated functions callable by anon — classify and review | Possible unauthenticated writes | High | S | owner runs Query D | N | Y | Y | BLOCKED-OWNER |
| SE-02 | Security | Permission fixes from Query D (revoke/grant, gates) | Depends on Query D | High | M | SE-01; approval | N | Y | Y | BLOCKED-PROD |
| RP-01 | Reporting | Totals complete beyond 1,000 rows (Accounting, Tax, Business Health, Daily Summary) | Silent undercount | High | M | — | Y | N | N | DONE |
| SM-07 | State machine | Approval Deny writes "rejected"; rejected = closed everywhere | Live bug (Query A) | High | S | — | Y | N | N | DONE |
| SM-12 | State machine | Document link types: supplier or none | Live bug (Query A) | High | S | — | Y | N | N | DONE |
| ST-01 | Storage | Saved record never loses its file on dropped reply | Data loss | High | S | — | Y | N | N | DONE |

## P1

| ID | Area | Item | Why it matters | Launch impact | Effort | Depends on | Safe in branch | Owner | Prod | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| AG-09 | Agents | Re-enable workflows / Shopify sync at launch | Operations | Blocker | S | products; R1–R4 | N | Y | Y | BLOCKED-OWNER |
| INV-05 | Inventory | Install R5 delete_unused_product | Product delete atomicity | High | S | approval | N | Y | Y | BLOCKED-PROD |
| INV-16 | Inventory | One active recall per lot (partial unique index or status check) | Two recalls can quarantine the same lot twice | Medium | S | D-ops-4; approval | P | Y | Y | BLOCKED-OWNER |
| INV-20 | Inventory | Revoke direct table writes on stock tables after R1–R5 (functions become the only path) | Legacy direct-write path bypasses the checks | High | S | INV-06; Query C §8; approval | N | Y | Y | BLOCKED-PROD |
| INV-21 | Inventory | Rollout order R1 → R4 → R2 → R3 → R5 | Money impact first | High | S | D-ops-1 | N | Y | N | BLOCKED-OWNER |
| MU-11 | Mutations | Legal hold should block deletes of related records? | Compliance meaning of a hold | Medium | M | owner decision | P | Y | N | BLOCKED-OWNER |
| RP-03 | Reporting | Refund accounting decision N4 (subtract vs full) | Revenue correctness | High | S | owner decision | P | Y | N | BLOCKED-OWNER |
| RP-04 | Reporting | Accounting/Tax date ranges in Central time vs UTC | Evening orders counted on the wrong day | Medium | S | D-ops-3 / owner | P | Y | N | BLOCKED-OWNER |
| SH-01 | Shopify | Real products with exact SKUs (dashboard = Shopify) | Returns/receives find products by SKU | Blocker | S | owner | N | Y | Y | BLOCKED-OWNER |
| SH-02 | Shopify | Sync design decision (D-4) | How orders/stock flow | Blocker | M | owner | N | Y | N | BLOCKED-OWNER |
| SM-04 | State machine | Add Query C §9 rules (incidents, legal holds, FR, QC, inquiries, service_status, system_mode, enums) to db-constraints.js | Remaining tables unverified | High | S | Query C | Y | N | N | BLOCKED-QC |
| SM-05 | State machine | incidents.severity accepts "normal"? (recall/QC escalation) | Escalation could fail for normal severity | Medium | S | Query C §9 | Y | N | N | BLOCKED-QC |
| SM-06 | State machine | orders.channel enum vs manual order entry values | A manual sale type could be refused | Medium | S | Query C §9 | Y | N | N | BLOCKED-QC |
| ST-07 | Storage | Read-only check of bucket privacy, size limits, MIME rules and storage policies | Unknown production settings | Medium | S | owner runs a read-only check | N | Y | Y | BLOCKED-PROD |
| X3-17 | Agents | Emergency Order Sync switch-off writes updated_by/updated_at to feature_flags (columns unverified) | Switch-off could always fail; branch fallback added | High | S | Query C §10 | P | N | N | BLOCKED-QC |
| X3-25 | Docs | Backup health unverified; records disagree (kept on vs last ran Sept 13) | Restore readiness unknown | High | S | owner check | N | Y | N | BLOCKED-OWNER |
| AG-02 | Agents | Truthful agent state (Unknown/Failed/Stale/Dry run) | No optimistic defaults | High | M | — | Y | N | N | DONE |
| AG-05 | Agents | Shopify sync interlock + wording; Emergency switches it off | Premature sync | High | S | — | Y | N | N | DONE |
| AG-06 | Agents | No-send tripwires (email, Shopify) | No customer messages | High | S | — | Y | N | N | DONE |
| DOC-03 | Docs | Owner runbook: how to install R1–R5 and roll back (click-by-click) | Production change by owner | High | S | — | Y | N | N | DONE |
| INV-07 | Inventory | R1–R5 drafts reconciled with Query A schema | Drafts were written on a guessed schema | High | M | Query A | Y | N | N | DONE |
| INV-08 | Inventory | Product-first lock order in every draft workflow | Deadlocks delete vs receive/quarantine (control reproduces) | High | S | — | Y | N | N | DONE |
| INV-09 | Inventory | Lot upsert on real unique index | Same new lot on two deliveries collided | Medium | S | — | Y | N | N | DONE |
| INV-10 | Inventory | Optional expected-value (stale) check on adjust_inventory | Resent request / stale tab applied twice | Medium | S | — | Y | N | N | DONE |
| INV-11 | Inventory | delete_unused_product: permission + any-bucket stock + 0-row check | False success under RLS; +5/−5 read as empty | Medium | S | — | Y | N | N | DONE |
| INV-12 | Inventory | Failure injection at every write of R1–R4 (fingerprint unchanged) | Prove all-or-nothing | High | M | — | Y | N | N | DONE |
| INV-13 | Inventory | Stress S10–S19 (60 stale tabs, hot row, delete races, killed connection…) | Concurrency proof | High | M | — | Y | N | N | DONE |
| INV-23 | Inventory | Browser: claim-first receive/return/recall; compare-and-set stock | Interim protection until R1–R5 | High | M | — | Y | N | N | DONE |
| INV-24 | Inventory | Product delete: permission, in-use check, stock row restore | False success; lost stock row | High | S | — | Y | N | N | DONE |
| INV-25 | Inventory | Whole-unit catalogue PO lines; deleted POs locked; case-insensitive SKU | Real schema alignment | High | S | Query A | Y | N | N | DONE |
| INV-26 | Inventory | Employee restock refused up front | Half-received return | High | S | Query A | Y | N | N | DONE |
| MU-01 | Mutations | Silent RLS refusals reported as success (10 paths) | False "done" | High | M | — | Y | N | N | DONE |
| MU-02 | Mutations | Escalate to incident at most once (QC, recall) | Duplicate/orphan incidents | Medium | S | — | Y | N | N | DONE |
| MU-06 | Mutations | Emergency mode: Shopify sync off / Agent #7 pause failures only logged to console; page says success | In an emergency the owner believes sync is off when it is not | High | S | — | Y | N | N | DONE |
| SE-03 | Security | Escape output on search.html / dashboard.html | XSS | High | S | — | Y | N | N | DONE |
| SE-04 | Security | Pin + SRI Supabase library on all pages | Supply chain | High | S | — | Y | N | N | DONE |
| SE-05 | Security | XSS second payload family across every text field | Escaping coverage | High | S | — | Y | N | N | DONE |
| SE-06 | Security | CSV formula guard (= + - @ tab CR) | Spreadsheet injection | Medium | S | — | Y | N | N | DONE |
| SE-07 | Security | Link scheme allowlist (javascript:, data:, vbscript:) | Clickable code | Medium | S | — | Y | N | N | DONE |
| SM-01 | State machine | Mock enforces Query A CHECK rules on every write; impossible-data guard | Class of "denied" bugs | High | M | Query A | Y | N | N | DONE |
| SM-02 | State machine | Document categories match DB (5 of 10 refused) | Uploads failed | High | S | — | Y | N | N | DONE |
| SM-03 | State machine | Static audit of dropdowns, maps, transitions, literals | Coverage of unclicked values | High | S | — | Y | N | N | DONE |
| SM-08 | State machine | Tasks: no transition out of done/cancelled; buttons have DB guards | Backwards moves | Medium | S | — | Y | N | N | DONE |
| SM-10 | State machine | Returns: re-open after refund impossible; approve only from requested | N13 finding | High | S | — | Y | N | N | DONE |
| SM-11 | State machine | Purchase orders: no backwards move; Cancel only draft/ordered/shipped | Cancel-after-receive | High | S | — | Y | N | N | DONE |
| SM-13 | State machine | Recall resolve needs note; never-quarantined needs second press | Compliance record | Medium | S | — | Y | N | N | DONE |
| SM-14 | State machine | Legal hold release only active; FDA flag only once | Compliance | Medium | S | — | Y | N | N | DONE |
| SM-17 | State machine | Agent switch / flag / system mode guarded | Stale tab flips | High | S | — | Y | N | N | DONE |
| ST-02 | Storage | Evidence/receipt orphan cleanup; document delete removes file | Orphans | Medium | S | — | Y | N | N | DONE |
| X3-03 | Reporting | Expenses page count and money total summed from the newest 200 only | Silent wrong money total beyond 200 expenses | High | S | — | Y | N | N | DONE |
| X3-09 | Inventory | R1–R5 install had no schema preflight (wrong shape installs, fails at first click) | Install safety | High | S | — | Y | N | N | DONE |
| X3-20 | Orders | Manual order retry after a failure created a SECOND order (duplicate revenue) | Two-step save, lost reply | High | S | — | Y | N | N | DONE |
| X3-32 | Orders | Manual order date stored as midnight UTC = 7 pm the PREVIOUS day in Central (wrong day; on the 1st the wrong month) and default date was "tomorrow" after 7 pm | Live on main: misplaced revenue in Accounting/Tax | High | S | — | Y | N | N | DONE |

## P2

| ID | Area | Item | Why it matters | Launch impact | Effort | Depends on | Safe in branch | Owner | Prod | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| AG-04 | Agents | Scheduled jobs list vs dashboard cron names reconciled | Stale job names | Medium | S | Query C §5 | Y | N | N | BLOCKED-QC |
| AG-10 | Agents | Agent #6 real email service decision | Customer messages | Medium | M | owner | N | Y | Y | BLOCKED-OWNER |
| CI-02 | CI | Activate CI (owner opens/merges the PR) and make Playwright required | Gate merges | Medium | S | owner | N | Y | Y | BLOCKED-OWNER |
| CI-03 | CI | Verify pinned action SHAs against release tags | Supply chain | Low | S | owner (other repos out of scope) | N | Y | N | BLOCKED-OWNER |
| DOC-02 | Docs | Merge order for open PRs #5–#24 and this branch | Safe rollout | High | S | owner | Y | Y | N | BLOCKED-OWNER |
| DOC-05 | Docs | Task v2 live checks (refresh, audit_log, Cancel, iPhone, 2nd account) | Pending owner checks | Medium | S | owner | N | Y | N | BLOCKED-OWNER |
| DOC-06 | Docs | Document category list decision | DB rule vs wishes | Low | S | owner | N | Y | Y | BLOCKED-OWNER |
| F3-02 | Orders | Manual orders record no SKU (product name only): returns of manual orders cannot restock by SKU; sold-product check cannot see manual sales | manual-order-entry itemsPayload has no sku | Medium | M | owner: product picker | P | Y | N | BLOCKED-OWNER |
| INV-15 | Inventory | R-functions: recalled stock cannot be restocked/adjusted below zero by recall paths; quarantine twice on two recalls of one lot | Edge of over-quarantine (D-ops-4) | Medium | S | D-ops-4 | Y | Y | N | QUEUED |
| INV-17 | Inventory | Partial-quantity returns in the dashboard (p_quantity) | Today the whole line is restocked | Medium | M | D-ops-5 | P | Y | N | BLOCKED-OWNER |
| INV-18 | Inventory | Expense date for received PO uses business date (Central) | UTC date wrong in US evenings | Medium | S | D-ops-3 | P | Y | N | BLOCKED-OWNER |
| INV-19 | Inventory | Optional CHECK constraints (recalled >= 0, one expense per PO note) | Database-level safety net; Query B shows they apply cleanly | Medium | S | approval | N | Y | Y | BLOCKED-PROD |
| RP-08 | Reporting | Partial refunds counted in full (listed for review) | Known limitation | Medium | M | N4 | P | Y | N | BLOCKED-OWNER |
| RP-09 | Reporting | Sales tax by state requires state field on real orders | Unverified until first real order | Medium | S | first real order | N | Y | N | BLOCKED-EXT |
| RS-03 | Responsive | Real iPhone Safari check of task buttons | Chromium only in tests | Medium | S | owner | N | Y | N | BLOCKED-OWNER |
| SE-12 | Security | Task access hardening before more staff | Least privilege | Medium | M | owner | N | Y | Y | BLOCKED-OWNER |
| SH-03 | Shopify | Order status words match Accounting/Tax classification after launch | Revenue classification | Medium | S | first real orders | N | Y | N | BLOCKED-EXT |
| SM-09 | State machine | Feature requests: status advance guard + values vs DB | Unverified values | Low | S | Query C §9 | Y | N | N | BLOCKED-QC |
| X3-18 | Audit | Compliance actions record when but not who (legal hold, FDA, QC, inquiries) | Who-did-it lost if no audit trigger | Medium | M | Query C §10; approval | N | Y | Y | BLOCKED-QC |
| AG-03 | Agents | "error"/"fail" statuses show Failed; Agent #1 "Switch on" | Overclaim | Medium | S | — | Y | N | N | DONE |
| AX-01 | Accessibility | Accessible names, unique ids, phone tap targets, dialog focus | Screen readers / phone | Medium | S | — | Y | N | N | DONE |
| AX-02 | Accessibility | Status/error banner announced to screen readers (role=alert / aria-live) | Errors not announced | Medium | S | — | Y | N | N | DONE |
| AX-05 | Accessibility | Keyboard: every overlay closes with Escape and returns focus | Keyboard users | Medium | S | — | Y | N | N | DONE |
| AX-07 | Accessibility | Dark theme: white text on bright blue/red fills (buttons 3.0:1, Delete 2.8:1) and default-blue links (1.8:1) | Found by the AA contrast test (2026-10-06) | Medium | S | — | Y | N | N | DONE |
| AX-08 | Accessibility | 64 hard-coded grey inline text colours ignored the theme (labels 1.6:1 in dark; dates 3.1:1 in light) | Found by the AA contrast test (2026-10-06) | Medium | S | — | Y | N | N | DONE |
| CI-01 | CI | Tests-only workflow ready, least privilege | Automated checks | Medium | S | — | Y | N | N | DONE |
| EM-01 | Empty states | Every page clean on empty DB; products without movement | First launch | Medium | S | — | Y | N | N | DONE |
| EM-02 | Empty states | System mode default shown as default, not as saved | Unknown ≠ Normal | Medium | S | — | Y | N | N | DONE |
| EM-03 | Empty states | Business Health "Paused agents 0" when agent switches could not be read | Unknown shown as zero | Medium | S | — | Y | N | N | DONE |
| EM-04 | Empty states | Pages when a single loader fails (one table errors) — rest still render, error says which | Partial failure | Medium | S | — | Y | N | N | DONE |
| EM-05 | Empty states | Missing feature_flags row for shopify_order_sync: say "not configured", not "off" | Unknown vs off | Medium | S | — | Y | N | N | DONE |
| INV-14 | Inventory | Stress: 100 concurrent callers mixed across all R-functions, repeated | Push concurrency beyond 60–80 callers | Medium | S | — | Y | N | N | DONE |
| MU-03 | Mutations | PO payment status guarded | Stale Paid → Unpaid | Medium | S | — | Y | N | N | DONE |
| MU-04 | Mutations | Second press on Receive delivery and Mark Refunded | One-click irreversible | Medium | S | — | Y | N | N | DONE |
| MU-07 | Mutations | Sweep: every remaining .update/.delete without row check (calendar, inquiries, service status, reminders dismiss) | Complete the silent-refusal class | Medium | S | — | Y | N | N | DONE |
| MU-08 | Mutations | Raw DB/RLS errors: plain explanation without hiding detail | Owner understands refusals | Medium | S | — | Y | N | N | DONE |
| MU-10 | Mutations | Owner / Administrator / employee behaviour tested separately for each owner-only action | Role regressions | Medium | M | — | Y | N | N | DONE |
| MU-13 | Mutations | Session revoke (rpc) result not checked for "nothing revoked" | Could claim a device was logged out | Medium | S | — | Y | N | N | DONE |
| MU-15 | Mutations | Password re-check Enter-twice sends two checks | PR #13 | Low | S | — | Y | N | N | DONE |
| RP-02 | Reporting | Boundary tests 0/1/999/1,000/1,001/10,000 rows for Accounting and Tax totals | Off-by-one at page edges | Medium | S | — | Y | N | N | DONE |
| RP-05 | Reporting | Deleted (soft) orders and expenses excluded from all totals — test | Double counting | Medium | S | — | Y | N | N | DONE |
| RP-07 | Reporting | Tax CSV export = figures on screen at scale (2,500 rows) | Export truncation | Medium | S | — | Y | N | N | DONE |
| RP-10 | Reporting | report_totals draft reconciled with real NOT NULL columns (orders.channel, returns.reason) | Draft test assumed the guessed schema | Medium | S | Query A | Y | N | N | DONE |
| RP-10 | Reporting | AI spend this month complete beyond 1,000 log rows | Spend cap check | Medium | S | — | Y | N | N | DONE |
| RS-01 | Responsive | Key workflows at narrow desktop (800px) and tablet (768px) | Untested widths | Medium | S | — | Y | N | N | DONE |
| RS-02 | Responsive | Phone swipe in tables; PO tap opens history | PR #12, #14 | Medium | S | — | Y | N | N | DONE |
| SC-01 | Scale | Calendar notes batched; inquiry orders chunked | URL overflow | Medium | S | — | Y | N | N | DONE |
| SC-02 | Scale | Activity "Export to spreadsheet" exports only the rows loaded, silently | Partial audit export | Medium | S | — | Y | N | N | DONE |
| SC-03 | Scale | Activity "Today" digest capped at 500 shows "500 changes" | Undercount | Low | S | — | Y | N | N | DONE |
| SC-04 | Scale | Record Inspector history: 200 search matches filtered client-side → incomplete history | Audit view incomplete | Medium | S | — | Y | N | N | DONE |
| SE-08 | Security | Activity export CSV formula injection test (person/record text) | Second export path | Medium | S | — | Y | N | N | DONE |
| SE-11 | Security | Password re-check covers every destructive action (matrix complete) | Consistency | Medium | S | — | Y | N | N | DONE |
| ST-03 | Storage | Size/type check before upload | Late failure; active content | Low | S | — | Y | N | N | DONE |
| ST-05 | Storage | Malicious filenames (path traversal, unicode, very long) produce safe storage paths | Path safety | Medium | S | — | Y | N | N | DONE |
| UX-03 | UX | US-evening dates (expense/AE defaults, lot expiry, file names, tax receipt list) | Off by one day | Medium | S | — | Y | N | N | DONE |
| X3-01 | State machine | Product edit form wrote status unguarded (stale tab flips discontinued/active) | Found by the mock state rule | Medium | S | — | Y | N | N | DONE |
| X3-04 | Scale | Returns page listed and counted the newest 200 only (old open returns vanished) | Open work hidden | Medium | S | — | Y | N | N | DONE |
| X3-08 | Query C | Query C failed without pg_cron; tokens not masked in agent errors | Owner run could stop with an error | Medium | S | — | Y | N | N | DONE |
| X3-13 | Inventory | Sold product (order lines by SKU text) could be deleted (dashboard + R5) | Sales history points at nothing; returns can't restock | Medium | S | — | Y | N | N | DONE |
| X3-21 | Auth | Signed out in another tab: dashboard stayed open showing empty lists as if no data | Unknown shown as empty | Medium | S | — | Y | N | N | DONE |
| X3-22 | Errors | Raw "Failed to fetch" / database text on dropped connections and other pages | Misleading "not saved"; internal names | Medium | S | — | Y | N | N | DONE |
| X3-24 | Tests | SQL mutation run found 3 untested rules (recalled floor, fully received lines, unapproved return) | Test gaps | Medium | S | — | Y | N | N | DONE |
| X3-28 | Accessibility | Keyboard focus not returned to the opener when a dialog closed (6 dialogs) | WCAG 2.4.3; keyboard users lost their place | Medium | S | — | Y | N | N | DONE |
| X3-29 | Accessibility | No dialog was announced as a dialog (role, aria-modal, label) | Screen readers did not say a dialog opened | Medium | S | — | Y | N | N | DONE |

## P3

| ID | Area | Item | Why it matters | Launch impact | Effort | Depends on | Safe in branch | Owner | Prod | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| DOC-09 | Docs | Invoice status decision (issued vs draft) | Agent #1 output | Low | S | owner | N | Y | N | BLOCKED-OWNER |
| F3-01 | Accessibility | Input and control borders in light mode ~1.4:1 (37 inline #cfd8d6 + theme --field-border) vs WCAG 1.4.11 3:1 | Hard to see field edges | Low | S | design decision | Y | Y | N | BLOCKED-OWNER |
| F3-03 | Orders | Manual order number has 1-second resolution (M-YYYYMMDD-HHMMSS): two devices in the same second collide | generateOrderNumber | Low | S | Query C §9 (is order_number unique?) | Y | N | N | BLOCKED-QC |
| F3-07 | Reports | Accounting "This Week" is the last 7×24 h, not Monday–Sunday; label could mislead | acctRangeStart week = now − 7 days | Low | S | owner wording | Y | Y | N | BLOCKED-OWNER |
| F3-08 | Storage | Receipt/document file type is checked by extension only (not content) | uploadProblem uses the name | Low | S | — | Y | N | N | DEFERRED |
| F3-13 | Performance | owner-login.html still ~500 KB in one file; first load parses everything | file size | Low | L | modularization step 3 | Y | Y | N | BLOCKED-OWNER |
| F3-15 | Data | Existing manual orders entered before X3-32 may sit one day early | date bug on main | Low | S | owner (pre-launch: likely none) | N | Y | Y | BLOCKED-OWNER |
| INV-28 | Inventory | Wanted (test.fail) atomicity tests flip to passing once dashboard calls R1–R4 | Keeps the goal visible | Low | S | INV-06 | Y | N | N | BLOCKED-PROD |
| MD-03 | Modularization | HE namespace + start registry + feature modules | Plan step 3 | Low | L | open PRs merged | N | Y | N | BLOCKED-OWNER |
| MD-04 | Modularization | Upload helpers (uploadThenSave) to a module with supabase injected | Reuse/testing | Low | S | — | Y | N | N | QUEUED |
| MU-12 | Mutations | Product edit concurrent-edit guard (updated_at) | Last save wins | Low | S | — | Y | N | N | DEFERRED |
| SC-05 | Scale | "Showing first 1,000" notice for long lists (lots, products, POs) | Silent list truncation later | Low | S | — | Y | N | N | DEFERRED |
| SC-06 | Scale | Lot pickers truncate after 1,000 lots | Older lots missing from pickers | Low | S | — | Y | N | N | DEFERRED |
| ST-08 | Storage | Read-only listing of orphaned objects created before the fixes | Cleanup scope | Low | S | owner | N | Y | Y | BLOCKED-PROD |
| UX-06 | UX | Administrator tries personal calendar | Pending check | Low | S | owner | N | Y | N | BLOCKED-OWNER |
| X3-11 | Scale | Return-form order picker lists newest 200 orders only | Old order returns can't be logged | Low | S | volume | Y | N | N | DEFERRED |
| X3-12 | Scale | Evidence form incident picker newest 200 only | Years away | Low | S | volume | Y | N | N | DEFERRED |
| X3-15 | Inventory | Tasks can name a deleted product by id (free text) | Low impact | Low | S | — | Y | N | N | DEFERRED |
| X3-16 | Inventory | Keep permanent product delete limited to never-used products, or archive only? | Policy | Low | S | owner | N | Y | N | BLOCKED-OWNER |
| X3-19 | Audit | Send actor fields on more writes once columns are confirmed | Blind columns break writes | Low | S | Query C §10 | Y | N | N | BLOCKED-QC |
| AX-03 | Accessibility | Toasts announced (aria-live polite) | Success not announced | Low | S | — | Y | N | N | DONE |
| AX-04 | Accessibility | prefers-reduced-motion respected for animations | Motion sensitivity | Low | S | — | Y | N | N | DONE |
| AX-06 | Accessibility | Colour contrast check of badges in light/dark | Readability | Low | S | — | Y | N | N | DONE |
| AX-09 | Accessibility | Contrast of text inside plain divs/spans (test covers badges, buttons, hints, empty states, labels, links, stat labels) | Remaining coverage gap | Low | S | — | Y | N | N | DONE |
| CI-04 | CI | Optional SQL job (local Postgres service) for draft tests | Draft regressions caught in CI | Low | M | CI-02 | Y | Y | N | DONE |
| CI-05 | CI | Secret/PII scan step in CI | Public repo hygiene | Low | S | — | Y | N | N | DONE |
| DOC-01 | Docs | Audits recorded (state machine, mutations, storage, pagination, launch readiness) | Durable record | Medium | S | — | Y | N | N | DONE |
| DOC-04 | Docs | Mark superseded statements in older docs (guessed schema, "BLOCKED ON QUERY A/B") | Stale docs | Low | S | — | Y | N | N | DONE |
| EM-06 | Empty states | Product without inventory row: Inventory page shows it with "no stock row" warning | Broken invariant visible | Low | S | — | Y | N | N | DONE |
| F3-04 | Auth | dashboard.html / search.html / manual-order-entry.html do not react to sign-out in another tab | no onAuthStateChange (order entry re-checks the user before saving) | Low | S | — | Y | N | N | DONE |
| F3-06 | Agents | Agent error text shown on the agents page is not masked like in Query C (emails/tokens) | last_error rendered as text | Low | S | — | Y | N | N | DONE |
| F3-14 | Security | No Content-Security-Policy meta on the pages (GitHub Pages cannot set headers) | pages have no CSP | Medium | M | test inline handlers first | Y | N | N | DONE |
| INV-27 | Inventory | SQL draft tests for lot numbers with only whitespace / unicode / mixed case duplicates | Lot identity edge cases | Low | S | — | Y | N | N | DONE |
| MD-01 | Modularization | Steps 1, 2, 2b (CSS, icon, 28 pure helpers) | Smaller main file | Low | M | — | Y | N | N | DONE |
| MD-02 | Modularization | Move confirmSecondPress + small DOM helpers | Next safe slice | Low | S | — | Y | N | N | DONE |
| MU-05 | Mutations | Reminder double submit (form + quick add Enter) | Duplicates | Low | S | — | Y | N | N | DONE |
| MU-09 | Mutations | Raw errors still show table/policy names (e.g. "for table evidence_locker") | Unnecessary internal detail in UI | Low | S | — | Y | N | N | DONE |
| MU-14 | Mutations | Business rules threshold: stale overwrite (config) unguarded | Two owners editing | Low | S | — | Y | N | N | DONE |
| RP-06 | Reporting | Duplicate PO expenses detection in reports | Duplicate expense visibility | Low | S | — | Y | N | N | DONE |
| SC-07 | Scale | Single reusable paging helper used by all totals (fetchAllRows/In) | Consistency | Low | S | — | Y | N | N | DONE |
| SE-09 | Security | Bidi/RTL override and zero-width characters in names shown with clear isolation | Spoofed display text | Low | S | — | Y | N | N | DONE |
| SE-10 | Security | Public repo hygiene scan in CI (no keys/emails in added files) | Prevent leaks | Low | S | — | Y | N | N | DONE |
| SM-15 | State machine | Customer inquiry "answered" guarded; severity/draft unguarded | Last write wins on drafts | Low | S | — | Y | N | N | DONE |
| SM-16 | State machine | Service status change unguarded (stale overwrite) | Low consequence | Low | S | — | Y | N | N | DONE |
| ST-04 | Storage | Receipt delete: storage removed but DB clear fails → record points at missing file | Documented, acceptable; test it | Low | S | — | Y | N | N | DONE |
| ST-06 | Storage | Path collision: same name in the same millisecond | Upload error | Low | S | — | Y | N | N | DONE |
| ST-09 | Storage | Server-side atomic upload+record (signed upload + DB function) design | Browser cannot make two systems atomic | Low | M | design only | Y | N | N | DONE |
| TQ-01 | Tests | Flaky palette tests fixed at root; employee delete test robust | Trust in suite | Medium | S | — | Y | N | N | DONE |
| TQ-02 | Tests | Mutation tests for page-side guards (stale guard, noRowsChanged, escaping, paging, upload cleanup) | Prove tests bite | Medium | M | — | Y | N | N | DONE |
| TQ-03 | Tests | Mock: DELETE representation, ilike, constraints, URL limits | Realism | Medium | S | — | Y | N | N | DONE |
| TQ-04 | Tests | Mock refuses NOT NULL omissions for all Query A columns (not only status columns) | Inserts missing required fields | Medium | S | — | Y | N | N | DONE |
| TQ-05 | Tests | Request baseline kept current | Unexpected requests | Low | S | — | Y | N | N | DONE |
| UX-01 | UX | Sidebar search: typing a page name + Enter opens that page (test.fixme) | Fixed EXT3: page name wins on Enter (sidebar + palette); questions still open the Guide | Low | S | owner decision | Y | Y | N | DONE |
| UX-02 | UX | Palette first keys lost after Cmd+K | Typing lost | Low | S | — | Y | N | N | DONE |
| UX-04 | UX | Stale agent status text #2/#3/#7/#8 | Wording | Low | S | — | Y | N | N | DONE |
| X3-02 | State machine | Order Restore without "still deleted" condition | Found by the mock state rule | Low | S | — | Y | N | N | DONE |
| X3-05 | Validation | Blank Business Rules value saved as 0 | Number("") is 0 | Low | S | — | Y | N | N | DONE |
| X3-06 | Validation | Negative / infinite numbers accepted on button-saved fields (PO shipping/tax, prices, threshold) | No browser form check on plain buttons | Low | S | — | Y | N | N | DONE |
| X3-07 | Dates | Cleared expense date fell back to the UTC date | "Tomorrow" on US evenings | Low | S | — | Y | N | N | DONE |
| X3-10 | Tests | Hostile-filename test raced the form reset under load | Flake | Low | S | — | Y | N | N | DONE |
| X3-14 | Inventory | Product with a quality check could be deleted (dashboard); database FK unknown | Orphan QC rows | Low | S | Query C §9 | Y | N | N | DONE |
| X3-23 | Auth | Threshold save had no role check (employee request sent, refused by database) | Inconsistent with other stock actions | Low | S | — | Y | N | N | DONE |
| X3-26 | Storage | Zero-byte files uploaded and saved as empty receipts/documents | Useless record looks saved | Low | S | — | Y | N | N | DONE |
| X3-27 | Storage | Document delete from a stale tab removed record + old file, orphaning a replaced file | Orphan file | Low | S | — | Y | N | N | DONE |
| X3-30 | Tests | "Every overlay closes with Escape" silently skipped the Record Inspector (opened by click, which never opens it) | False confidence | Low | S | — | Y | N | N | DONE |

## P4

| ID | Area | Item | Why it matters | Launch impact | Effort | Depends on | Safe in branch | Owner | Prod | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| AG-07 | Agents | Agent run-history view | Operational visibility | Low | M | — | Y | N | N | DEFERRED |
| AG-08 | Agents | Agent #8 migration to Supabase with dedupe | Reliability | Low | L | owner | N | Y | Y | DEFERRED |
| DOC-08 | Docs | Activity-log retention policy | Storage growth / privacy | Low | S | owner | N | Y | N | DEFERRED |
| F3-05 | Search | Palette record results cap at 30 without saying "more…" | searchEverything slice(0,30) | Low | S | — | Y | N | N | DEFERRED |
| F3-09 | Inventory | Low-stock threshold has no stale-tab guard (last write wins on a config value) | upsert without condition | Low | S | — | Y | N | N | DEFERRED |
| F3-10 | Tests | Visual baselines exist for 2 sizes only; device matrix checks layout, not pixels | visual.spec | Low | M | — | Y | N | N | DEFERRED |
| F3-11 | CI | Mutation harnesses are not in CI (20 min page run) | run-page-mutations.js | Low | S | CI-02 | Y | Y | N | DEFERRED |
| F3-12 | Docs | Owner-facing "what each page does" guide is spread across Guide articles; no printable one-pager | help entries in page | Low | M | — | Y | N | N | DEFERRED |
| SC-08 | Scale | Search (sidebar/palette) loads only already-loaded records — document | Search scope | Low | S | — | Y | N | N | DEFERRED |
| SE-13 | Security | Failed-login history / login alerts | Detect account abuse | Low | M | server side | N | Y | Y | DEFERRED |
| ST-10 | Storage | Signed-URL lifetime (60 s) and download link behaviour documented | Expired links | Low | S | — | Y | N | N | DEFERRED |
| UX-05 | UX | "Recently done + Reopen" on Tasks | Owner wish | Low | M | — | Y | N | N | DEFERRED |
| X3-31 | Search | Guide matching is single-word fuzzy: gibberish with a common word lists unrelated articles | Relevance | Low | S | — | Y | N | N | DEFERRED |

## Merged duplicates (provenance)

- INV-01: PROJECT_RECORD R1, known bug 1, po-receive wanted test
- INV-02: R2, known bug 2
- INV-03: R3, known bug 7
- INV-04: R4, known bug 3
- INV-05: R5, known bug 5
- INV-16: D-ops-4
- INV-17: D-ops-5
- INV-18: D-ops-3, PR #11 note
- INV-21: D-ops-1
- INV-22: D-ops-6
- INV-23: overnight 10-05
- SM-10: N13
- MU-15: PR #13
- ST-02: security review S10
- RP-01: N14
- RP-03: N4
- RP-04: PR #11 note
- SE-03: R6, PR #7
- SE-04: R7
- SE-06: PR #9
- SE-07: PR #10
- SE-12: owner list
- SE-13: owner list
- AG-01: pending check 5
- AG-05: R9
- AG-06: R10
- AG-07: owner list
- AG-08: owner list
- AG-09: R9
- AG-10: R10
- SH-01: R8
- SH-02: D-4
- SH-03: pending check 4
- RS-02: PR #12, PR #14
- RS-03: pending check 1
- UX-01: general.spec fixme, known bug 11
- UX-03: PR #11, known bug 9
- UX-04: PR #8
- UX-05: owner list
- UX-06: pending check 2
- DOC-02: pr-merge-order.md
- DOC-05: pending check 1
- DOC-08: owner list
- DOC-09: owner list
