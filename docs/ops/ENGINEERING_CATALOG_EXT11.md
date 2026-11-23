# Engineering catalog (EXT11)

**Status:** CURRENT (2026-10-11, extension 11). For maintainers and future sessions, not for daily use. One table per topic; each links to the older detailed document instead of repeating it. Labels: IMPLEMENTED IN BRANCH · TESTED LOCALLY · READY FOR OWNER DEPLOYMENT · NOT DEPLOYED · PRODUCTION VERIFIED (none yet).

## 1. Write paths: the 7 that need a database step and the 4 protected only in the page

Source: `docs/ops/MUTATION_WRITE_PATH_INVENTORY.json` (105 paths: 76 SAFE ALREADY, 18 REQUEST KEY IN PAGE, 7 DATABASE REQUEST KEY NEEDED, 4 CLIENT-SIDE MITIGATION ONLY; regenerated in EXT11).

| # | Operation (page → table) | Duplicate / partial risk today | What closes it | Rollback | Switch | Test | Depends on |
|---|---|---|---|---|---|---|---|
| 1–3 | PO Receive → `inventory_lots`, `inventory_adjustments`, `expenses` | claim-first: a second Receive is refused; a lost reply locks the order (X10-13) and the read-only check says what happened; the three writes are still separate requests | **R1** `receive_purchase_order`: all writes in one transaction, a received PO never receives twice | `drafts/11` | `stock_fn_receive_po` | install package 61/61; po-receive | P2 + P4 |
| 4–5 | Recall Quarantine → two `inventory_adjustments` | claim-first; after a lost reply the page now reads the recall back and says whether the stock move ran (X11-03) | **R2** `quarantine_recall` | `drafts/11` | `stock_fn_recall` | inventory-safety | P2 + P4 |
| 6 | Manual adjustment → `inventory_adjustments` | stock change is compare-and-set; history is a second request; a lost reply says "may or may not have been saved, check first" | **R4** `adjust_inventory` with `p_expected` (a repeat is refused, not applied twice) | `drafts/11` | `stock_fn_adjust` | stock-functions | P2 + P4 |
| 7 | Return Mark Received → `inventory_adjustments` | claim-first; after a lost reply the page now reads the return back and says whether the restock ran (X11-02) | **R3** `receive_return` (whole line; partial quantity waits on D-ops-5) | `drafts/11` | `stock_fn_return` | failure-recovery, inventory-safety | P2 + P4 |

All seven are closed by R1–R5, not by request keys; no separate request-key column is needed for them.

| # | Client-side only | Why that is acceptable now | Optional database guard |
|---|---|---|---|
| 1–4 | Manual order entry → `orders`, `order_items` (`manual-order-entry.html` and its copy `index.html`) | the page never reuses an order number another tab has taken (it checks before saving); a retry recognises its first attempt by number + person + total + customer, never by number alone; items are written only if the order has none; a `23505` refusal is handled as "taken a moment ago, nothing saved". A duplicate needs two saves of the same number within about one second; Query F row F06 finds any that slip through | a unique rule on `orders(order_number)` for live rows. **OWNER DECISION**: needs Query C/F to confirm Shopify order numbers never repeat before it can be written; not prepared |

## 2. Transaction boundaries (high-risk workflows)

| Operation | Browser writes today (switch OFF) | Database function | Atomic | Idempotent | Audited | Deployed |
|---|---|---|---|---|---|---|
| PO receive | claim + lots + stock + history + expense | R1 | only with R1 | yes (claim; R1: `already_done`) | audit trigger on PO and stock tables: UNKNOWN until Query C §10 | NOT DEPLOYED |
| Recall quarantine | claim + stock + 2 history rows | R2 | only with R2 | yes (claim) | same | NOT DEPLOYED |
| Return receive | claim + stock + history | R3 | only with R3 | yes (claim) | same | NOT DEPLOYED |
| Manual adjustment | stock (compare-and-set) + history | R4 | only with R4 | with R4 (`p_expected`) | same | NOT DEPLOYED |
| Product delete | refuses products with history or stock; one delete | R5 | yes (one statement) / R5 | yes | same | NOT DEPLOYED |
| Manual order + items | two inserts | none (not needed: see §1) | no; missing items are detected | yes (retry-safe) | orders: audit trigger (Query A) | live today |
| Creates (18 forms) | one insert each | request keys (drafts 19 + 27) | single row | with request keys ON | per table | NOT DEPLOYED |
| Status changes (approve, close, reopen …) | one guarded update (`updateIfUnchanged`) | not needed | single row | yes (stale refused) | per table | live today |
| Uploads (receipts, documents, evidence) | storage + row | not possible across systems | no; the file is removed when the row is refused | read back by path | — | live today |

**Atomicity roadmap (only where a half-done state is a business inconsistency):** R1–R5 are the whole list for now. Not worth an RPC: status changes (already single-row), uploads (two systems), manual orders (already detected and retry-safe). Deferred: revoking direct stock writes (P10) after all five switches are stable.

## 3. Audit

**Actions that must be auditable** (who, when, what changed): stock changes (adjust, receive, recall, return, delete product) · PO status and payment · return status and refund record · approvals (approve / deny) · product deactivate / restore · order delete / restore · business rule changes · feature switch changes · system mode changes · session revoke.

| Table | Expected | Known today | Verified by |
|---|---|---|---|
| tasks, orders | audit trigger writes `audit_log` | REPORTED (Query A) | — |
| inventory, inventory_adjustments, purchase_orders, returns, recalls, products, approval_requests, business_rules, feature_flags, system_mode | an audit trigger, or at least who/when columns | **UNKNOWN** | Query C §10 (one row per table: audit trigger yes/no, which who/when columns exist) |

**If an audit write fails:** today the audit trigger runs inside the same database statement as the change, so a failing trigger fails the change itself (nothing half-saved); the dashboard then shows the error. For tables without a trigger there is nothing to fail. This is the existing database behaviour, not a new policy. **Fix template** once Query C shows a gap: one `create trigger … after insert or update or delete … execute function <the existing audit function>` per table, with its `drop trigger` rollback, tested locally like the other drafts. Not written until the real audit function's name and signature are known from Query C (no guessing).

**Operation id → audit:** request keys are stored on the created row itself (`client_request_id`), so an audit row of that insert already carries the key in its row snapshot where the audit function stores the whole row. Not verified until Query C shows what the audit function stores. No change proposed.

## 4. "Did it already succeed?" before a retry (lost-response model)

| Operation | What the page says after a lost reply | Status words |
|---|---|---|
| PO Receive | locks Receive; "Check this order now" reads back: safe to receive / received but not fully in stock / needs a person | UNKNOWN → CONFIRMED / ALREADY COMPLETED |
| Return Mark Received (EXT11) | reads the return back: NOT saved (press again) / saved but the restock did NOT run (check Inventory, adjust by hand, do not press again) / cannot tell (reload and check) | same |
| Recall Quarantine (EXT11) | same pattern for the stock move | same |
| Manual adjustment | "may or may not have been saved; check the stock and the history before saving again" | UNKNOWN |
| 18 create forms | request keys ON: "already saved by an earlier attempt" or "pressing again is safe"; OFF: "may or may not have been saved, check the list" | ALREADY COMPLETED / UNKNOWN |
| Status changes | a repeat is refused as "changed elsewhere" | CONFIRMED on reload |

No path shows a success message before the database confirmed the write (EXT10 audit; unchanged).

**Request-key storage:** keys live on the business row they created (one short text column), not in a separate log, so they do not grow on their own beyond one value per created row. No clean-up job is needed; nothing to decide.

## 5. Permissions (RLS): Query G result → prepared fix

Do not apply anything until the Query G result is in. Templates and rollbacks: `PERMISSION_RLS_MAP_EXT9.md` §4 and `ROLE_PERMISSION_MATRIX.md`.

| Query G finding | Classification | Fix (draft written after the result, tested on local roles: install → test → rollback → reinstall) |
|---|---|---|
| G03 open task update (any signed-in user changes any task) | TOO BROAD | replace the policy with owner/admin or assignee only; rollback restores the exact old policy text from the CSV |
| G04 anon table rights with INSERT/UPDATE/DELETE | UNEXPECTED ANON | `revoke` those rights from anon; rollback = `grant` back exactly what the CSV listed |
| G04 anon SELECT only | EXPECTED or TOO BROAD (owner decides per table) | revoke if not intended |
| G05 duplicate read policies | DUPLICATE POLICY | drop the looser one after checking the stricter one covers every needed read |
| G06 anon can run function | per function: EXPECTED (login helpers) or UNEXPECTED ANON | `revoke execute … from anon` |
| G01 table without RLS | TOO BROAD | enable RLS + a policy copied from a similar table |
| G07 RLS on, no policy | EXPECTED if the table is server-only | none |
| anything the template does not cover | UNKNOWN | read and ask |

**Page behaviour if a stricter rule later blocks something:** writes report "You do not have permission …" (a refusal reads back as zero rows changed and is named as a permission problem, not a network error: `changeStock`, `updateIfUnchanged`); reads show "could not load" with the database's own words. Tested in role-matrix and failure-recovery.

**The page never relies on anonymous access:** every data request is made after sign-in with the user's session; the sign-in screen makes no data request at all (tested: merge-without-sql-ext11 "the sign-in screen reads no business data").

**Roles today and later:** today OWNER and ADMIN may change stock and switches; EMPLOYEE may do day-to-day work (tasks, orders, returns without restock). The page checks the role before a stock action only to give a clear message; the database rule decides. A future OPERATOR or READ-ONLY role needs: (1) database policies per table, (2) the page's `canChangeStock()` and owner-only checks to read the new role, (3) the role matrix test extended. Not built (no need yet).

## 6. Errors: one vocabulary

| Kind | Examples on screen | Retry? | Refresh? | Stop and tell the owner? | Run a check? |
|---|---|---|---|---|---|
| VALIDATION | "Pick a product…", "Enter a non-zero amount" | after correcting | no | no | no |
| AUTH / PERMISSION | "Only the Owner or an Administrator…", "sign in again" | no | sign in | if unexpected | no |
| CONFLICT | "changed since the page loaded / changed elsewhere" | **no** (reload and look first) | yes | no | no |
| NETWORK (outcome unknown) | "The connection dropped…" | only where the page says pressing again is safe | yes | if stock or money | PO: "Check this order now"; returns/recalls: the page already read it back |
| INTEGRITY | "would leave … below zero", "isn't a valid number" | no | yes | yes | Query E |
| NOT FOUND | "That product no longer exists" | no | yes | no | no |
| SERVER | the database's message | once | yes | if repeated | no |
| SWITCH / DATABASE STEP MISSING | "not installed yet", "turn the switch off" | no | no | yes | System status |
| UNKNOWN | anything else | no | yes | yes | — |

The diagnostic summary records only the kind (`errorKind`), never the text with record details. **Safe retry:** read-only → yes; idempotent write (request keys ON, claim-guarded status change) → the page says "pressing again is safe"; non-idempotent or unknown → the page says to check first. Business errors (validation, integrity, conflict) are worded for the operator; technical ones (server, network) say what is known and what to do.

## 7. Deliberate result limits (cap registry)

| Where | Limit | Why | Says so on screen? | Complete alternative | Decision |
|---|---|---|---|---|---|
| Products, suppliers, lots (pick-lists) | none (read in pages of 1,000) | X10-15 | — | — | done |
| Accounting, Tax, Daily Summary totals | none (read in pages) | money must be complete | — | — | done |
| Open tasks / open incidents / pending approvals | 100 (open only, soonest first) | screen size | yes: "Showing the N of M open …" | Home counts are exact | SAFE WITH LABEL |
| Orders list | 300 newest | screen size | yes | search by order number (any age) | SAFE WITH LABEL |
| Deleted orders / expenses / feature requests, released holds, adjustment history, evidence | "Show more" step (`listLimit`) | screen size | yes, with Show more | Show more | SAFE WITH LABEL |
| Returns (open / closed) | separate caps | screen size | yes | — | SAFE WITH LABEL |
| Expenses | 200, Show more | screen size | yes | Show more | SAFE WITH LABEL |
| Recently done tasks | 10 | it is a "recent" list | it is labelled recent | Tasks page | SAFE WITH LABEL |
| AI decision log | 50 newest | screen size | labelled | — | SAFE WITH LABEL |
| Answered questions | cap constant | screen size | labelled | — | SAFE WITH LABEL |
| Report history | 366 days | one year | labelled | — | SAFE WITH LABEL |
| Order look-up for returns | 20 matches | search box | "newest 20 matches" | type more of the number | SAFE WITH LABEL |
| Lists still read in one request (SOPs, documents, recalls, QC, adverse events, holds, feature requests, needs-attention) | database reply limit 1,000 | small tables | yes: page warning "first N of M" plus the dashboard-wide notice | — | SAFE WITH LABEL; server paging POST-LAUNCH if any reaches hundreds |

A silent cap is caught by tests: `scale-matrix` ("a list still read in one request warns at the reply limit"), `scale-ext10b`, `capped-reads`. **Server-side paging now?** Not needed before launch: every high-risk list is either complete or labelled, the store has no real orders yet, and paging the orders list properly needs URL state and filter work for little gain at today's volume. POST-LAUNCH, when the orders list passes about 300 real orders a quarter.

## 8. Agents and automations

**What is unavailable and why it blocks true failure testing:** the agents' code runs in Supabase (edge functions / database functions) and the private repository's workflows, which this session cannot see. Without it, nobody can test what an agent does when its input is bad, when it runs twice, or when it fails half-way. The dashboard can only show what agents record (`agent_controls`, `ai_decision_log`, the rows they create). Request packet: `OWNER_UNBLOCK_CENTER_EXT11.md` packet E.

**Contract every agent should meet (for when the source is available):** input = the rows it reads; output = rows it creates, each with a deterministic issue key so a second run updates instead of duplicating; failure = recorded in `agent_controls.last_run_status` with a time, never silent; retry = one run at a time, missed runs not back-filled with writes; dedupe = by issue key. **Last-run model shown by the dashboard:** last run, last status (ok / error / failed), source of that fact (`agent_controls`), freshness (STALE after its expected interval), and UNKNOWN when unreadable; nothing is ever filled in by guess.

| D-item | Built? | Tested? | Needs schedule? | Needs owner threshold? | Intentionally not built? | Provider? |
|---|---|---|---|---|---|---|
| D1 nightly integrity check | SQL + Home card IMPLEMENTED IN BRANCH | TESTED LOCALLY | yes (P9, owner) | X8-D4 | — | — |
| D2 reconciliation monitor | as Query E | TESTED LOCALLY | optional | — | dashboard view later | invoices/shipping tables unknown |
| D3 duplicate watcher | F06–F09 | TESTED LOCALLY | with D1 | — | — | — |
| D4 inventory attention | low / negative on Home; mismatch in Query E | TESTED LOCALLY | — | "large adjustment" threshold | large-adjustment rule later | — |
| D5 backup monitor | design only | — | — | X8-D6 | needs the private backup job to write a status row | — |
| D6 agent supervisor | design only | — | — | — | needs a heartbeat source | agent source |
| D7 customer-draft queue | drafts only (live) | no-live-send | — | — | approval log when an e-mail service exists | e-mail provider |
| D8 claims review queue | not built | — | — | — | before the website launches | lawyer |
| D9 automatic reordering | — | — | — | — | **DO NOT BUILD** | — |
| D10 AI answering customers | — | — | — | — | **DO NOT BUILD** | — |
| D11 weekly AI summary | not built | — | — | — | optional, later | — |

## 9. Scale and code-structure roadmap

| When | What | Why |
|---|---|---|
| NOW (done) | complete paged reads for money and pick-lists; labelled caps; nightly check at 50k orders in 0.3 s locally; installation probes only when System status is open | correctness first |
| AFTER LAUNCH | server-side paging for the orders list and expenses; database aggregate for Home revenue (the Home reads today's orders only, so it is fine for now) | grows with real orders |
| MUCH LATER | multi-location stock, forecasting, full CRM / ERP | out of scope |

**owner-login.html:** 10,213 lines at the end of EXT10, 10,327 after EXT11's fixes (helpers, CSS and three page scripts already moved to `assets/` in EXT10, U39). Next safe extraction candidates, in order: the System status / diagnostics block (self-contained), the Tax Records block (pure calculations + export), the Returns block. Not continued in EXT11: the file is maintainable with the current tests (2,700+ cases plus 146 mutants), and every extraction costs a full re-verification. Line count is not a goal.

**Legacy paths to remove after production migration:** the browser stock paths in `changeStock` callers (PO receive, recall, return, adjustment) once all five `stock_fn_*` switches are ON and stable (with P10); marked in the code with "EXT9: R… when its switch is on" comments.

**TODO/FIXME pass:** `grep TODO|FIXME|XXX|HACK` over the page files and assets finds **none** (EXT11). Known bugs are tracked as `test.fail` (8, the browser stock paths until R1–R5) and in the backlog, not as code comments.
