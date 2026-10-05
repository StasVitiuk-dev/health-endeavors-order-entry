# Overnight platform review: 2026-10-05

**Scope:** the internal dashboard and platform only. The website repository, Real Estate OS, production Supabase, Shopify, agents, backups, money and customer messages were not touched.

**Labels used:**

| Label | Meaning |
|---|---|
| IMPLEMENTED | code changed on a branch |
| TESTED | automated tests prove it |
| REVIEW READY | could become a PR as is |
| BLOCKED | waits on Query A/B/C or an owner decision |
| PRODUCTION VERIFIED | true on the live system — **nothing in this document is** |

## 1. Executive summary

**What changed for the business (all on a branch, not live):**

1. **Stale tabs, double clicks and retries can no longer silently overwrite or duplicate work** on any status-changing button:
   - approvals
   - purchase orders: an explicit state machine; Cancel can no longer turn a *received* order into *cancelled*
   - returns: a stale page can no longer re-open a refunded return, so no second restock and no second refund
   - recalls, legal holds, the FDA flag, receipts, feature requests, agent switches, feature flags and system mode
2. **Stock writes use compare-and-set** (the update only applies if the numbers haven't changed since they were read; otherwise re-read and retry). Two people, tabs or agents saving at once can't erase each other's change. The "can't go below zero" check uses fresh numbers. Purchase-order receive, return restock and recall quarantine **claim the record first**, so they never double-count.
   - Still missing: all-or-nothing behaviour on a dropped connection. That needs the R1–R4 database functions (BLOCKED ON QUERY A/B).
3. **R7 done:** the Supabase library is pinned to 2.117.2 with an integrity hash on all 6 pages. Altered bytes are refused (tested).
4. **N14 fixed:**
   - Accounting, Tax Records, Business Health, Daily Summary and the AI-spend figures now count **every** row.
   - **Proved on the old code:** 2,500 orders worth $25,000 showed as **$10,000**, with no warning.
   - Also found and fixed: the Tax page's cost estimate would have **failed outright** at about 2,500 orders (a roughly 90 KB request URL).
5. **Agent truth model:** each agent shows Enabled, Disabled, Unknown, Failed, Stale, Dry run or Calculated here, computed from real data.
   - Before: if the switches couldn't be read, every agent was shown as **on**. Agent #1 showed fixed "Live now" text.
6. **Safety interlocks:** Shopify Order Sync is labelled "blocked until launch checks" and needs an extra confirmation to turn on. Tests prove that no dashboard page can send a customer message.
7. **Modularization started:**
   - CSS and icon moved to `assets/` (pixel-identical)
   - 21 pure helpers moved to `assets/owner-login-helpers.js`, with load and version guards
   - `owner-login.html`: 536 KB → 464 KB
8. **Tests:** the full suite on the branch has **531 passing, 0 failing**. 8 new spec files (44 test definitions, more with per-page loops) and 8 rewritten spec files. Local database stress suite: 230 checks, 0 failures, 0 deadlocks.
9. **CI** is ready on its own branch (not active).

## 2. Branches and commits

| Branch | Base | Pushed | Purpose |
|---|---|---|---|
| `claude/platform-overnight-implementation` | `main` `d3db7bc` + the 20 open PR branches + `claude/ops-readiness`, as **merge commits** (none of those branches changed) | yes | all implementation |
| `claude/tests-only-ci` | `main` `d3db7bc` | yes (no PR → 0 Actions runs) | one file: `.github/workflows/tests.yml` |
| `claude/ops-readiness` | unchanged: `99e50fab93958ec2eace3eb3f3b53f30e6bb8eaa` | — | yesterday's review (read-only use) |

**Why this base:** 8 open PRs already fix `owner-login.html`. Building on bare `main` would have duplicated or conflicted with them. After the 20 PRs merge, this branch's own diff is only tonight's work.

**Overnight commits (first-parent, oldest first):**

| Commit | Content |
|---|---|
| `9ad0d7d` | integration merges (21) |
| `ca46107` | guarded updates, compare-and-set stock, claim-first, confirmations, refund cap |
| `2842ef4` | R7 pin + SRI; N14 paging for Accounting/Tax |
| `63571e9` | N14 for Business Health / Daily Summary; truncation proven on old code |
| `a5fa35e` | N4 refund policy options + map; `report_totals` SQL draft |
| `027f809` | agent truth model |
| `af23a9e` | R9 sync interlock, R10 no-send tripwires, failure/recovery tests |
| `902628f` | stress suite + results |
| `54d7106` | CI review-ready + README |
| `7e93dce` | request baseline (paged reads) |
| `9fc998c` | modularization step 1 (CSS, icon) |
| `5e53be2` | modularization step 2 (pure helpers) |
| `02b3470` | XSS-everywhere test, document delete password, modularization maps |
| `d1a8370` | Tax cost estimate: chunked + paged |
| *(final)* | docs: this review, progress/current-state, work log |

**`main` unchanged:** `d3db7bc8e8cb74e9e26e296ac5ca546164a63cb1` (checked at the end of the session).

## 3. Implemented (code changes only)

### 3.1 Shared building blocks (`owner-login.html`)

| Helper | What it does |
|---|---|
| `updateIfUnchanged(table, key, patch, expected)` | Conditional update: applies only while the row still matches what the page showed; checks exactly one row changed; otherwise an "already changed… nothing was overwritten" message. Same idea as Task buttons v2. |
| `changeStock(productId, deltas, uid)` | Compare-and-set stock with re-read and retry (5×). Refuses below zero using fresh numbers, and refuses to write over a malformed stored number. |
| `fetchAllRows` / `fetchAllRowsIn` | Paged reads with an exact count. Throws on a short read. Long `.in()` lists are sent in chunks. |
| `confirmSecondPress(btn, label)` | The existing two-press pattern, shared. |
| `isNetworkError`, `staleMessage` | Honest messages: "may or may not have been saved — check before retrying" versus "safe to try again". |

### 3.2 By area

| Area | Change |
|---|---|
| Approvals | Decision applies only from the status the page showed (stale page: "already changed"). |
| Purchase orders | **State machine** `PO_ALLOWED_FROM`: ordered←draft; shipped←ordered; cancelled←draft/ordered/shipped; received←ordered/shipped. Two-press Cancel. Totals, lines and line removal only while draft/ordered. **Receive claims first** (marks Received only if still Ordered/Shipped), with a `received_at` claim token that recovers when the reply is lost. Literal lot match (N1). A part-way failure names exactly what was done, and no Receive button remains to double-count. |
| Returns | Approve/Reject only from requested; Close only from the status shown; **Mark Received claims first**, then restocks. **Mark Refunded only from Received, capped at the order line value** (`line_total`, or qty × `unit_price`; these columns are written by the repo's own manual-order-entry page). |
| Recalls | Quarantine claims first (initiated → quarantined), then moves stock with compare-and-set. Resolve needs a written note, plus a second press if the stock was never quarantined. |
| Legal holds | Release asks for the password; only an *active* hold is released. |
| Adverse events | "Mark reported to FDA" is two-press, and sets the flag only if it's not already set. |
| Expenses | Remove receipt is two-press; unlinks first (only if still the same file), then deletes the file. |
| Documents | Permanent delete also asks for the password. |
| Products | Delete refuses while any stock remains (fresh read). |
| Manual adjustments | Compare-and-set; honest network-drop message. |
| Feature requests, feature flags, agent switches, system mode | Change only from the state the page showed. A stale tab can't undo Emergency mode or a pause. |
| Reports (N14) | Accounting, Tax Records (incl. cost estimate), Business Health, Daily Summary and AI spend read every row. |
| N4 | `ACCOUNTING_REFUND_POLICY` (`'status_only'` kept) plus a tested `'subtract_return_refunds'` option that never subtracts twice. |
| Agents | `agentTruth()` states. Unreadable switches show Unknown and are disabled. Banner says when switches can't be read. #1 text no longer fixed "Live now". The Emergency description says rule-based agents keep running. |
| R7 | All 6 pages: `supabase-js@2.117.2/dist/umd/supabase.js` + `integrity` + `crossorigin` + `onerror`. |
| R9 | `LAUNCH_BLOCKED_FLAGS`: Shopify Order Sync badge + reason; turning ON needs an extra confirm before the password. |
| Modularization | `assets/owner-login.css`, `assets/owner-login-icon.png`, `assets/owner-login-helpers.js` (frozen `window.HE.helpers`, API 1). Content-hash `?v=`. Start-up refuses mixed or missing files. |

## 4. Tested

### Commands

| Purpose | Command |
|---|---|
| Full suite | `npx playwright test --config tests/playwright.config.js` (run on a clean worktree copy of each commit, so edits can't contaminate a run) |
| Single spec | `npx playwright test --config tests/playwright.config.js tests/specs/<file>` |
| Stress suite | `bash docs/ops/sql/local-test/stress_test.sh 10 -h /var/tmp/hepg -p 5499 -U postgres -d he_guess` |
| SQL drafts | `psql … -f docs/ops/sql/drafts/12_DRAFT_tests_stock_functions.sql`; `psql … -f docs/ops/sql/drafts/14_DRAFT_tests_report_totals.sql` |
| CI equivalent | `npm ci --ignore-scripts` (clean copy, 0 vulnerabilities); `npx playwright test --config tests/playwright.config.js --ignore-snapshots --reporter=list,github` |

### Results

| Run | Result |
|---|---|
| Baseline: integration merge before any change (`9ad0d7d`) | 440 passed, 49 skipped |
| After the guarded-update checkpoint (`ca46107`) | 422 passed, 13 failed: all expected (characterization tests of the old bugs), then updated |
| `af23a9e` | 519 passed, 1 failed (request baseline not regenerated yet; regenerated in `7e93dce`) |
| `5e53be2` (modularization step 2) | **531 passed, 0 failed, 65 skipped** |
| Final commit | see §4.1 |
| Stress suite (local PG16, draft functions, guessed schema) | 10 runs, 230 checks, **0 failed, 0 deadlocks**, 13.9–15.2 s per run |
| Stress control (old lock order) | 15–17 deadlocks out of 30. Proves the check works. |
| `report_totals` SQL draft (local) | all assertions pass |

"Skipped" = tests that run on only one screen size (Node-only and source checks run once; phone-only tests skip on desktop).

### New or rewritten specs

| Spec | Covers |
|---|---|
| `po-receive.spec.js` | Claim-first: dropped claim, lost reply, stale tab, part-way drop |
| `inventory-safety.spec.js` | Compare-and-set proofs; claim-first for recall and return; product delete |
| `ops-findings.spec.js` | Approvals, PO, legal hold, returns, recall, FDA (fixed behaviour) |
| `purchase-orders.spec.js`, `admin-pages.spec.js`, `compliance-pages.spec.js`, `operations-pages.spec.js` | Guarded filters and confirmations |
| `library-pin.spec.js` | All 6 pages pinned; a tampered library is refused |
| `report-totals.spec.js` | 1,000 and 400-row caps; short read; Business Health; cost estimate under a 16 KB URL limit |
| `refund-policy.spec.js` | Both N4 options, unit and browser |
| `agent-truth.spec.js` | All states, unreadable switches |
| `no-live-send.spec.js` | Source scan; inquiry actions; walk through every page |
| `failure-recovery.spec.js` | 500, 401, RLS "0 rows", slow + double click, refund cap, malformed stock, document delete |
| `assets.spec.js` | Content-hash versioning; helper file purity and names; load-failure and old-API guards |
| `xss-everywhere.spec.js` | Poisoned data on every page, with a control that proves it detects a broken `esc` |
| `ui-chrome.spec.js` | Palette test made deterministic (it was flaky 1 in 6 on the unchanged branch) |

**Every remaining `test.fail` was checked to fail on its stock assertion:** the all-or-nothing gaps for receive, recall, return and manual adjustment.

### 4.1 Final runs

*(Filled in at the end of the session: see the work log entry "final".)*

## 5. Review ready

These need owner review. None is merged.

1. **`claude/platform-overnight-implementation` as one PR, after PRs #5–#24 merge in the documented order.** Its own diff is then tonight's work only. Split option if preferred:
   1. guarded updates + compare-and-set + claim-first
   2. R7
   3. N14 + N4 option
   4. agents + interlocks
   5. modularization 1–2
2. **`claude/tests-only-ci`**: open a PR to activate; then make "Playwright (behaviour)" required.
3. The SQL drafts (R1–R5, `report_totals`): **not** review ready for production. They need Query A/B first.

## 6. Blocked on Query A/B/C

| Item | Why it's blocked |
|---|---|
| R1–R5 all-or-nothing database functions (`receive_purchase_order`, `adjust_inventory`, `quarantine_recall`, `receive_return`, `delete_unused_product`) | Need the real columns, constraints, triggers and RLS (Query A) and the data health (Query B). Drafted and stress-tested only on a guessed schema. |
| `report_totals()` (database adds up, one row back) | Real column and status names |
| Agents writing `inventory` directly (D-ops-6) | Query C3 |
| Agent #1 actual state | Query C1 or a look at the switch |
| RLS/grant review (anon/PUBLIC execute, SECURITY DEFINER functions) | Query A |
| Database-side refund cap / one-refund-per-return constraint | Query A |
| Orphaned storage files (S10) | Storage policy + an owner decision on deleting files |

## 7. New risks found tonight

| # | Severity | Finding | Reproduction | Status |
|---|---|---|---|---|
| N14b | 🟠 High at scale | Tax cost-of-goods estimate: one `.in()` URL with every order id (~90 KB at 2,500 orders) is rejected by gateways, so the **whole Tax page errors**; its reply was also capped at 1,000 rows | `report-totals.spec.js` "cost-of-goods" with `maxUrlLength = 16384`: the old commit shows an empty section | Fixed on branch |
| N14c | 🟠 Medium | Business Health "AI spend this month" and the AI Agent Activity month total were capped at 1,000 log rows. Hourly agents can pass that within a month. | `report-totals.spec.js` Business Health (2,400 rows) | Fixed on branch |
| N16 | 🟠 Medium | When agent switches fail to load, every agent was shown **on** (code comment: "everything shown as on"); an agent with no switch row also showed on | `agent-truth.spec.js` (500 on `agent_controls`) | Fixed on branch |
| N15 | 🟡 Medium (compliance) | Document delete is a hard delete with a browser confirm only: no password, stored file left behind, legal holds not consulted | Read the code (`docDeleteBtn`) | Password added. File and legal-hold handling: owner decision |
| N17 | 🟡 Low | A stale page could switch system mode from a mode it no longer showed (e.g. undo Emergency) | `admin-pages.spec.js` filter now includes `mode=eq.<shown>` | Fixed on branch |
| N18 | ℹ️ Test infra | The test mock didn't expose `Content-Range` cross-origin like the real gateway, so count-based code (e.g. the Tasks/Approvals "showing N of M" notes) was never really exercised | `report-totals.spec.js` first run | Mock fixed |
| N19 | ℹ️ Low | The palette searches only already-loaded records, so ⌘K right after login can miss tasks | `ui-chrome.spec.js` (flaky 1 in 6 on the unchanged branch) | Test made deterministic; behaviour unchanged |

Earlier findings N1–N13: see `other-fixes-review.md`. Branch status of each:
- fixed: N1, N3, N5 (cap + state), N6, N11, N12 (note + confirm), N13
- partly: N10 (confirmation + unlink-first)
- owner decision: N4 (options ready)
- documented: N2, N7, N8 (pin done), N9

## 8. Modularization progress

**Before extracting anything:**
- maps written: `docs/ops/modularization-maps.md`. Start-up order, 191 functions, 40 shared `let`s, 84 `const`s, 229 element IDs (**all present**), 37 tables, 7 RPCs.
- characterization tests already in place: visual, request baseline, helpers-unit, plus tonight's tests

| Step | Extracted | Validation |
|---|---|---|
| 1 | `<style>` → `assets/owner-login.css` (byte-for-byte, 45,416 bytes); two identical base64 icons → one PNG | Visual snapshots 20/20 pixel-identical; full suite green |
| 2 | 21 pure helpers → `assets/owner-login-helpers.js` (IIFE, `'use strict'`, frozen `window.HE.helpers`, API 1) | Mechanical purity check (no DOM, Supabase or shared state); helpers-unit tests read the new file; refusal tests for a missing or old file; full suite 531/0 |

**Stopped at the boundary:** before the namespace, start registry and feature modules.
- They need the 20 open PRs merged first.
- The stock pages wait for R1–R4.
- Next safe candidates: `confirmSecondPress` and `staleMessage`; the access helpers (with `supabase` passed in); then Tasks.

## 9. Remaining biggest tasks (by impact)

1. **Run Queries A/B/C**, then reconcile and publish the R1–R5 SQL. The owner runs it; then one dashboard PR per function. This removes the last half-done-work risk on stock and money.
2. **Merge PRs #5–#24 in order**, then this branch (or its splits), with live checks.
3. **Agent #1 state:** check, decide, turn on before real orders.
4. **N4 accounting decision** (both options ready).
5. **Activate CI** and make it required.
6. Continue modularization: namespace and start registry → Tasks → lower-risk pages.
7. Integration service (design in `integration-service-architecture.md`): only after 1–3.
8. Open owner decisions: S10 files, receipt deletion policy, D-ops-1…8, D-3 hosting.

## 10. Rollback

| Group | How |
|---|---|
| Any group | Revert its commit(s) on the branch. Nothing is merged, so nothing on the live site needs undoing. |
| After a future merge | Revert the merge commit. No database objects were created by any of this. The SQL drafts are files only. |
| R7 | Revert `2842ef4` (pages go back to the floating `@2`). |
| Modularization | Revert `5e53be2`, then `9fc998c`. The CSS, icon and helpers go back inline; `assets/` can stay or be removed. |
| CI | Never opened; delete the `claude/tests-only-ci` branch only if the owner wants (I didn't delete anything). |

## 11. Safety confirmation

- `main` untouched (`d3db7bc8e8cb74e9e26e296ac5ca546164a63cb1`, checked at the end)
- no merge, no PR opened, no force-push, no branch deleted, `claude/ops-readiness` unchanged
- no deploy. The last Pages deployment is still Sept 29; 0 Actions runs on the new branches.
- no production Supabase access of any kind (no SQL, RLS, grants or cron); all database work was on a throwaway local PostgreSQL
- no Shopify access or changes; no customer data viewed or modified; no live communications
- no agent enabled or disabled; no backups touched; no money or accounting actions (N4 is code behind an unchanged default)
- no secrets requested, created or written
- no Real Estate access; no website repository access or changes (website rows in the progress doc were left as they were)

---

## Appendix A: auditability of state-changing actions (WS17)

"Actor" means the row itself records who did it. Every table may additionally be covered by the database `audit_log` triggers that feed the Record Inspector history. Their coverage per table is **unknown until Query A** (it lists triggers).

| Action | Actor recorded on the row | Timestamp | Old → new visible | Reason / comment |
|---|---|---|---|---|
| Approve / deny request | `reviewed_by` ✓ | `reviewed_at` | via `audit_log` | — |
| PO ordered / shipped / cancelled | ✗ | `updated_at`, `ordered_at` | via `audit_log` | — |
| PO receive | `received_by` ✓; stock history `adjusted_by` ✓; expense ✗ | `received_at` | history rows | reason text on history |
| Return approve | `approved_by` ✓ | `approved_at` | via `audit_log` | — |
| Return receive / refund / close | ✗ | `received_at` / `refunded_at` / `updated_at` | via `audit_log` | disposition; amount |
| Recall quarantine / resolve | ✗ (stock history `adjusted_by` ✓) | `updated_at`, `resolved_at` | via `audit_log` | resolution note (now required) |
| Legal hold release | `released_by` ✓ | `released_at` | — | ✗ (no reason field) |
| FDA flag | ✗ | `fda_reported_at` | — | ✗ (no report reference) |
| Manual stock adjustment | `adjusted_by` ✓ | `created_at` | history row | reason ✓ |
| Agent switch / system mode / business rule | `updated_by` / `changed_by` ✓ | ✓ | via `audit_log` | — |
| Feature flag | ✗ | ✗ | via `audit_log` | — |
| Expense delete / receipt remove / product delete / document delete | ✗ | `deleted_at` only for expenses | via `audit_log` (if covered) | — |

**Not changed tonight (would need schema columns, so draft-only):**
- actor columns for return receive/refund, recall, FDA flag and flags
- a release reason for legal holds
- an FDA report reference

**Recommendation:** first confirm `audit_log` trigger coverage with Query A. If every table above is covered with `auth.uid()`, the actor is already recorded and only the UI needs to show it.

## Appendix B: destructive actions (WS18)

| Action | Kind | Protection on the branch |
|---|---|---|
| Order delete | Soft delete (recycle bin) | password (existing) |
| Expense delete | Soft delete (recycle bin) | — (reversible) |
| Feature request delete | Soft delete | — (reversible) |
| Document delete | **Irreversible**, compliance-affecting | confirm + **password (new)**; file left behind (N15) |
| Receipt remove | **Irreversible** file delete, tax record | **two-press (new)**, unlink first |
| Product delete | Irreversible; was stock-affecting | two-press (existing) + **refuses with stock (new)** |
| PO line remove | Irreversible, money-affecting before ordering | only while draft/ordered (**new**) |
| PO cancel | Status change, money-affecting | **two-press + state machine (new)** |
| Recall resolve | Compliance | **note required + second press if never quarantined (new)** |
| Legal hold release | Compliance | **password + active-only (new)** |
| FDA flag | Compliance (no undo button) | **two-press + only if unset (new)** |
| Session log-out (other device) | Security | password (existing) |
| Calendar event / note delete | Irreversible, low impact | confirm (existing) |
| Attention item dismiss | Reversible flag | — |

## Appendix C: performance and scale (WS19)

- **Measured** (`report-totals.spec.js`, synthetic): Accounting "All Time" with 2,500 orders and 1,200 expenses, behind a 400-row cap, renders correct totals in about 10 s of test time, in 7 + 3 paged requests. With the default 1,000-row cap: 3 + 2 requests.
- **Changed:** totals are always complete now, at the cost of more requests as data grows. The scalable end state is `report_totals()` (database sums, one row), drafted and BLOCKED ON QUERY A/B.
- **Still unbounded, but low risk today:**
  - Calendar notes `.in(event_uid, ≤300)`: could exceed URL limits with very long Apple UIDs
  - Inquiry → order lookup `.in(id, …)`
  - Lists are capped by design (tasks 100, approvals, returns 200) and say so when truncated (now that the mock exposes the count, those notices are exercised)
- No subscriptions or realtime channels are opened (verified: the test mock blocks websockets and no test fails on it). Background refresh: the current page only, every 5 minutes.

## Appendix D: integration readiness on the platform side (WS20)

- The design is in `docs/ops/integration-service-architecture.md`: one sale = one order = one invoice; idempotent inbox; reconciliation; stock publication blocked until R1–R4.
- **Boundary:** the event contracts and the simulator live in the website workspace. Re-creating them here would duplicate website-owned code. **Stopped at the boundary** (the owner to approve a private integration repository).
- **Platform-side pieces added tonight that the integration will rely on:**
  - `report_totals()` draft
  - the N4 refund policy (a single source of truth for refunds is needed before Shopify refunds arrive)
  - the R9 interlock on `shopify_order_sync`
  - the no-live-send tripwires
- No endpoint, webhook or secret was created.

## Appendix E: blueprint / specification gap (WS15)

The full *Blueprint Checklist* and the 69-item specification are in the owner's private documents, not in this repository. Only the summary in `PROJECT_RECORD.md` §4 could be compared.

| Item (from PROJECT_RECORD §4) | State | Rank (safety / value / difficulty / dependency) |
|---|---|---|
| R1–R5 all-or-nothing functions | browser-side protection done tonight; DB functions BLOCKED ON QUERY A/B | 1 / high / medium / Query A |
| Agent #1 verification | UI now shows the real state; the owner must look | 1 / high / trivial / owner |
| Agent run-history view | needs a history table (schema) | 3 / medium / medium / Query C |
| "Recently done + Reopen" on Tasks | not built: needs the owner's choice of which transitions to allow back | 4 / medium / small / owner |
| Login / failed-login history | needs auth logs server-side | 3 / medium / medium / server |
| Business Rules DB validation | client validation exists; DB side needs schema | 3 / low / small / Query A |
| Scheduled-report email; email intake | waits on an email service (R10) | 5 / medium / medium / owner |
| Charts / analytics | not started | 5 / low / medium / — |
| Modularization | steps 1–2 done tonight | 4 / maintainability / large / open PRs |
