# Health Endeavors — project record

**What this is:** the single, durable record of what exists, what's verified, what's left, and what happened each day. Future Claude sessions and the owner should read this first, then the detailed documents it points to.

**Last updated:** September 29, 2026 (evening, Central). **Written by:** Claude Code session on branch `claude/project-record`, reconciling:
1. the owner's old-chat documents: *Internal Operating System Documentation* (last dated entries Sept 28, ~12:10am), *Blueprint Checklist* (last dated entry Sept 27, ~10:29pm), and the *Claude Code session template* (Sept 29 afternoon);
2. this repository's `main` branch and its full git history (d3db7bc);
3. the work done in this session (Sept 29).

**Rule used when sources disagree:** the newer dated statement wins; anything that can't be settled from these sources is marked **UNCERTAIN**.

**How each fact is labelled.** Every status in this record carries one of these labels:

| Label | Meaning |
| --- | --- |
| **[REPO]** | **Repository-verified.** Claude checked it directly in this GitHub repository: files on `main`, git history, PRs, fingerprints, or tests run against the code. It proves what is *in the code*, **not** what the live website is serving. |
| **[HIST]** | **Historical report.** Stated in the owner's old-chat documents or the Sept 29 session template, for example "confirmed live on Sept 20". Claude has not re-checked it. |
| **[PENDING]** | **Live check still to do.** Needs the owner, or a live test, to confirm on the real site or database. |
| **[UNVERIFIED]** | Nobody in these sources has confirmed the current state. |

**Important:** a file on `main` being identical to a tested version is **not** proof that the live site shows it. GitHub Pages normally publishes `main` within minutes, but only a check on the live address (hard refresh or a Private Window) confirms it. Claude does not log in to the live site.

**Deliberately left out (the repository is public):** email addresses, account numbers, user ids, passwords or password-setting methods, store domains, and anything else sensitive. The old-chat documents contain some of these; keep them private.

---

## 1. Where things stand, in one screen (Sept 29, 2026)

| Area | State |
| --- | --- |
| **Code on `main`** | **[REPO]** `owner-login.html` on `main` is **task buttons v2** (commit 4edf5d6, Sept 28). Its fingerprint (md5 `49514277…`) is identical to the v2 upload named in the old docs [HIST] and to the copy the owner attached on Sept 29. |
| **Live site** | **[HIST]** The Sept 29 session template reports v2 **live**, with 4 of 9 post-deploy checks passed. **[PENDING]** The other 5 checks (below). Claude has not checked the live site itself. |
| **Store** | **[HIST]** Not launched. Shopify order sync intentionally **off**, 0 real orders. Real products not yet added. |
| **Agents** | **[HIST]** #4, #5 and #6 run inside Supabase hourly, each live-tested with an enforced pause switch (Sept 26–27). #2, #3, #7 and #8 switched off (GitHub workflows disabled Sept 26, until there are products). #9 and #10 are dashboard pages. **Agent #1 (Invoice): pause enforcement was verified Sept 24 [HIST], but whether it is currently enabled or paused is [UNVERIFIED].** It was paused for a test that day, and no source records it being switched back on. |
| **GitHub safety** | **[REPO]** Ruleset `protect-main` is active: PR, 1 approval, Code Owners review, stale approvals dismissed, last-push approval, no force-push, no deletion. CODEOWNERS = owner. No workflow files in this repo. (Bypass list: admin-only per [HIST]; not readable by Claude.) |
| **Tests** | **[REPO]** `main` has the Playwright suite from PR #4: 65 passed, 9 skipped (run Sept 29). **Combined check [REPO]:** every open fix and test branch (PRs #7–#16, #19–#24) merged together on a scratch copy (never pushed): **405 passed, 0 failed, 49 skipped** at both sizes (Sept 29, 20:41 UTC). The 10 "wanted behaviour" tests for R1–R4 fail as expected and are counted as passed until those fixes exist. All mocked, with synthetic data. |
| **Open PRs** | **[REPO]** 20 PRs are waiting for the owner, and none is merged: #5–#6 (rules, this record); fixes #7–#14; tests #15, #16, #19–#24; reviews/plans #17, #18. See §6. |
| **Owner-run checks** | **[PENDING]** Status survives a refresh · `audit_log` shows the status-only change · Cancel on "Mark done" changes nothing · real iPhone layout · administrator account (optional) · **Agent #1's current on/off state**. |
| **Biggest known risks** | **[REPO]**, reproduced against the code with synthetic data, not fixed: the inventory and purchase-order double-count / lost-update bugs; unescaped output on `search.html` and `dashboard.html`; the Supabase library loads unpinned from a CDN. |

---

## 2. Every existing feature and what it does

**How to read this table:**
- **[REPO]:** Claude confirmed that every page and feature listed here exists in the code on `main` (Sept 29).
- **[HIST]:** the "Status" column comes from the owner's old documents. Claude has not re-tested any of it live.

**Status legend ([HIST] unless marked):**
- **Live ✓ (date)**: reported verified on the live site on that date.
- **Live**: reported deployed, but not individually verified.
- **Built, not exercised**: in the code; that path was never tested live.
- **Partly**: part of the feature exists.
- **Off**: built, but deliberately switched off.

### 2.1 Owner dashboard: `owner-login.html` (31 pages in 7 sidebar groups)

| Group / page | What it does | Status |
| --- | --- | --- |
| **Login and security** | Email + password sign-in (only active accounts); "Forgot your password?" sends a reset email; a "Confirm it's you" password re-check before sensitive actions; the separate `change-password.html` page | Live ✓ (re-check Sept 16; reset flow Sept 26) |
| **Overview → Needs Your Attention** | Home page with a **Business Health** strip (today's revenue and orders, pending approvals, overdue tasks, open serious incidents, paused agents, AI spend vs the $30 cap, active sessions). Below it, one combined feed: tasks, approvals, compliance deadlines, privacy requests, incidents, calendar, reminders, activity alerts, overdue deliveries, failed quality checks, recalls, expiring documents, low stock | Live ✓ (low-stock branch Sept 26) |
| Daily Summary | Yesterday's orders, revenue, questions, tasks, incidents and AI activity | Live ✓ (Sept 20) |
| Report History | Nightly saved daily reports; daily, weekly and monthly views | Live ✓ (email step not built, see §4) |
| Calendar | Owner: Apple-synced calendar (Day / Week / Month, notes per event). Everyone else: their own private calendar | Live ✓ owner side; **administrator side not yet tried by her** |
| **Sales → Orders & Revenue** | Order list with count and revenue; soft delete + recycle bin (both ask for the password); logs each view of customer data | Live (0 real orders; delete tested Sept 24) |
| **Inventory → Inventory** | Products (add / edit / deactivate / delete-if-unused), stock in 8 buckets, low-stock threshold, manual adjustments with a permanent log, batch (lot) badges | Live ✓ (Sept 21 / 23) |
| Returns | Requested → Approved/Rejected → Received → Refunded → Closed; restock on receipt | Live ✓ for 2 paths; **"Mark Refunded" and restock-to-Available: built, not exercised** |
| Suppliers | Supplier and manufacturer records | Live |
| Purchase Orders | Draft → ordered → shipped → received. Receiving adds stock and lot numbers, logs the full cost as an expense and works out the true unit cost. Overdue deliveries go to the home page | Live (**receive has known safety bugs, see §5**) |
| Quality Control | Log checks; failed checks show on the home page; escalate to an Incident; cross-linked with Recalls | Live |
| **Finance → Expenses** | Manual expenses with optional receipt upload (private storage); soft delete + recycle bin | Live ✓ (Sept 20–21) |
| Accounting (Agent #9) | Revenue vs expenses → net profit; Today / Week / Month / All time; excludes cancelled and refunded orders; lists partial refunds for review | Live ✓ (Sept 20 test orders) |
| Tax Records (Agent #10) | Cost-of-goods vs operating split, estimated cost of units sold, sales tax by state (by-state split unverified until real orders), expenses missing receipts, CSV export | Live |
| **Operations → Tasks** | Open tasks, sorted by due date, overdue in red. **Task buttons v2:** "Mark done" (with confirmation) and "Mark in progress", status-only, allowed moves only | **Live ✓ partly**: see §3 |
| Incidents | Incident list | Live |
| Evidence Locker | Evidence per incident: file upload or link | Live ✓ (Sept 17) |
| Documents | Contracts, certificates and so on, with expiry badges; expiring ones go to the home page | Live |
| **Customers & AI → Customer Inquiries** | Review the AI drafts: severity, edit, copy, mark answered | Live ✓ (Sept 19–20, test rows) |
| AI Agent Activity | The 10-agent registry (what each may and may not do), per-agent pause switches, Job Health for the Supabase agents, AI spend and model settings, decision log | Live ✓ (**registry text for #2/#3/#7/#8 is stale, see §8**) |
| **Admin → Feature Flags** | Feature switches + **System Mode** (Normal / Limited AI / No AI / Emergency) with a site-wide banner | Live ✓ (mode switch is recorded; agents don't read it, see §4) |
| Business Rules | Agent thresholds; password-protected; shipping delay must be 1–365 | Live ✓ (Sept 21; limits Sept 26) |
| Approval Queue | Two-person approval (refund/cancellation reviews) | Live |
| Active Sessions | Your signed-in devices; log out a device | Live ✓ (Sept 17) |
| Employee Activity | Who changed what: search, filters, digest, CSV export, one-way visibility (an administrator can't see the owner) | Live |
| Procedures (SOPs) | Written procedures; opt-in visibility to the Customer Service agent | Live ✓ (Sept 17–18) |
| Feature Requests | Requested → in progress → done; recycle bin | Live ✓ (Sept 17) |
| **Compliance** (folded group) → Recalls | Per-batch recall: quarantine stock into "Recalled", escalate, resolve | Live (**quarantine has known safety bugs, see §5**) |
| Adverse Event Reports | FDA/MoCRA log with a 15-business-day deadline, automatic incident + task | Live ✓ (Sept 17) |
| Legal Holds | Flag records to preserve; release | Live ✓ (Sept 17) |
| Business Continuity | Health of outside services, with live signals for Calendar and AI | Live ✓ (Sept 19) |
| **Everywhere** | Sidebar with search (pages and records), pins, badges, remembered last page; ⌘K palette, keyboard shortcuts, built-in guide; change-history overlay (Space / tap); light / dark / auto theme; installable on iPhone, pull-to-refresh, swipe between pages; "showing X of Y" notices | Live (phone menu ✓ on a real iPhone, Sept 26) |

### 2.2 Other pages in this repository

| File | What it does | Status |
| --- | --- | --- |
| `change-password.html` | Change your own password, or set a new one from a reset email | Live ✓ (Sept 26) |
| `manual-order-entry.html` | Staff tool to log non-Shopify (wholesale / physical) orders; **permanent, not a test file** | Live ✓ (used Sept 24) |
| `dashboard.html`, `search.html`, `index.html` | Older pages (summary / activity, global search, order form) | Live but **UNCERTAIN whether still used** (security review S1) |

### 2.3 Back end (Supabase; the drafts and SQL live outside this repo)

- **Security foundation:** row-level security, `profiles` roles (owner, administrator, employee), a recycle-bin pattern, nightly backups to the private backups repo with a monthly restore test, the security watcher, a break-glass emergency login, account numbers.
- **Change history:** 39 tables record changes into `audit_log` (28 in full; 11 "light", with field names only, for customer and formula data). The log is append-only. An hourly unusual-activity watcher (1–5am Central) also covers agent switch flips.
- **Scheduled inside Supabase:**
  - Agents #4 (:03), #6 (:05), #5 (:10)
  - calendar sync (every 6 h)
  - daily report (00:05 UTC)
  - privacy-request, adverse-event, break-glass and unusual-activity checks
- **Still on GitHub Actions** (private backups repo), kept on: nightly backup, monthly restore test, security watch, compliance calendar, credential rotation, data retention, post-deployment health check.
- **Disabled until products exist:** Shopify sync, Agents #2 / #3 / #5 (old copy) / #7 / #8, data-integrity checks.

### 2.4 The 10 agents

| # | Agent | What it does | Where / status |
| --- | --- | --- | --- |
| 1 | Invoice | Creates, re-syncs and voids invoices on order changes | DB trigger; pause enforcement verified Sept 24 [HIST]; **current on/off state [UNVERIFIED]** |
| 2 | Order Intake | Flags missing info, mismatches, duplicates | GitHub; **disabled** |
| 3 | Order Monitoring | Flags large refunds / cancellations → approval queue | GitHub; **disabled** |
| 4 | Retail/Wholesale | Links each order to a customer; flags email mismatches | **Supabase v4, live** (Sept 27) |
| 5 | Shipping/Tracking | Syncs shipments; failed / delayed tasks | **Supabase v3, live** (Sept 27) |
| 6 | Customer Notification | Logs the emails it *would* send (dry-run, no email service) | **Supabase v2, live** (Sept 26) |
| 7 | Customer Service | Drafts replies (Claude Haiku 4.5, fallback Sonnet 5); never sends | GitHub; **disabled** (no intake channel yet) |
| 8 | Supervisor | Missing invoices, stuck tasks, conflicts | GitHub; **disabled**; Supabase move planned |
| 9 | Accounting | Dashboard computation | Live |
| 10 | Tax Record | Dashboard computation | Live |

All agent statuses above are [HIST]; Claude cannot see Supabase. The live versions, fingerprints and rollback files for #4, #5 and #6 are in the old *System Documentation*, §16.

---

## 3. Built → tested → merged → confirmed live (recent dashboard work)

| Item | Built [HIST] | Tested | On `main` [REPO] | Confirmed live [HIST] / still [PENDING] |
| --- | --- | --- | --- | --- |
| Task buttons v1 | Sept 27 | 16 browser + 8 DB tests | 22a7546 (Sept 27) | ✓ Sept 27 (buttons, both moves, audit rows); replaced by v2 |
| **Task buttons v2** | Sept 27 | 32/32 (1100 and 390 px) [HIST] | **4edf5d6 (Sept 28), fingerprint matches v2** | [HIST] partly (template Sept 29): desktop layout, open → in_progress, confirmation dialog, OK → done. **[PENDING]:** refresh persists, `audit_log` check, Cancel test, iPhone, administrator account |
| Verification record | Sept 29 | – | PR #1 (merged Sept 29) | n/a (doc) |
| CODEOWNERS | Sept 29 | – | PR #3 (merged; PR #2 closed as superseded) | ✓ ruleset now requires Code Owners |
| Playwright suite + code review | Sept 29 | 65 passed / 9 skipped | PR #4 (merged) | n/a (tests don't run on the site) |
| `CLAUDE.md` | Sept 29 | tests run | **PR #5 open** | – |

**Note on the old docs' "v2 not confirmed live" (Sept 27, 10:29pm):** this is **superseded**. v2 was uploaded Sept 28 (4edf5d6), and the Sept 29 template records the live checks above.

**UNCERTAIN:** the two screenshots attached on Sept 29 show v2 at desktop and phone width in dark mode. From the images alone I can't tell whether they are live-site captures or the Sept 27 preview images. So they are **not** counted as the real-iPhone check.

---

## 4. What remains

### 4.1 Required (blocks launch or protects money / stock / safety)

| # | Task | Why | Size | Needs |
| --- | --- | --- | --- | --- |
| R1 | **Make PO "Receive delivery" all-or-nothing** (database function) | Double stock + duplicate expenses after a dropped connection (reproduced) | L | Read-only schema query → SQL draft PR → owner runs it → dashboard PR |
| R2 | Recall quarantine all-or-nothing | Can quarantine twice (reproduced) | M | Same pattern as R1 |
| R3 | Return restock all-or-nothing | Double restock (reproduced) | M | Same pattern |
| R4 | Manual adjustment in the database (fixes lost updates + below-zero race) | Silent wrong stock (reproduced) | M | Same pattern |
| R5 | Product delete must not wipe stock first | Stock row lost for an in-use product (reproduced in mock) | S | Dashboard or small DB function |
| R6 | Escape output on `search.html` / `dashboard.html` | Script injection via customer / agent text | S | **Fix in PR #7.** The pages are kept; retiring them needs the owner's approval |
| R7 | Pin + integrity-hash the Supabase library (all 6 pages) | Supply-chain risk | S | **Pending by owner's instruction.** The library server couldn't be reached from the work container, so the hash can't be verified yet. Options: check the hash in a browser, or keep a copy of the library in the repo |
| R8 | Add real products (character-exact SKUs vs Shopify) | Needed before launch | S (owner) | Old plan: after the fake-order test ✓ |
| R9 | Before launch: re-enable the disabled workflows / Shopify sync | Operations | S (owner) | Products exist |
| R10 | Before any real email service: Agent #6 is fixed (v2), and the notifications re-checked | Customer messages | – | Email service chosen |

### 4.2 Pending checks (owner-run, not code)

1. Task v2: refresh persists · `audit_log` status-only row · Cancel does nothing (needs a reopened test task) · real iPhone · administrator account (optional).
2. The administrator tries her personal calendar (open since Sept 26).
3. Returns: exercise "Mark Refunded" and restock-to-Available once.
4. After launch: confirm the order status words (cancel / refund) match the Accounting / Tax logic, and that the state field exists for Tax.
5. **Agent #1 (Invoice) on/off state: [UNVERIFIED].** It was paused for a test on Sept 24, and no source records it being switched back on. It must be ON before real orders. To check: AI Agent Activity page → Agent #1 switch (read-only; don't change anything without deciding first).

### 4.3 Should do soon (small, found in this session)

- Link-scheme allowlist (Evidence / Documents): **PR #10**
- CSV formula guard: **PR #9**
- US-evening date bugs (expense and adverse-event defaults, lot expired badge, file names): **PR #11**. The PO "Receive" expense date and the Accounting/Tax date ranges are deliberately unchanged, because they are accounting-adjacent and need the owner's decision.
- Tax receipt-list date shown a day early: **PR #11**
- Phone swipe inside wide tables changes the page: **PR #12**
- Phone tap on a purchase order opens change history: **PR #14**
- Stale agent status text (#2 / #3 / #7 / #8): **PR #8** (wording only, shown as "last recorded state"; no agent setting changed)
- Password prompt Enter-twice: **PR #13**
- Palette / search Enter opens the guide first: **owner decision** (it looks deliberate)

**New decisions for the owner (found while writing tests, recorded as current behaviour, not changed):**
- Approval Queue approve/reject doesn't check that the request is still pending, so two people could act on it at once.
- Purchase order Cancel has no confirmation. PO status changes don't check the current status.
- Uploads whose save fails are left in storage (security review S10).

### 4.4 Optional / future ideas (owner's lists)

- "Recently done + Reopen" on Tasks
- Agent run-history view
- Database-level validation for Business Rules
- Agent #8 migration to Supabase (with the in-progress dedupe)
- Task access hardening before more staff
- Invoice-status decision (issued vs draft)
- Saved read-only health queries
- A reusable fake-order kit (exists; rerun after agent changes)
- Scheduled-report email (waits on a business email)
- Customer-question intake from email
- Login / failed-login history
- Activity-log retention
- Restore-from-history
- Charts / analytics
- Buyer website accounts (waits on the public website)
- Bank / card expense sync (**owner said don't raise it; wait for the owner**)
- AI search / voice (needs a server-side key)
- `owner-login.html` modularization (plan on a branch; after R1–R4)
- The remaining Blueprint items (§7)

---

## 5. Known bugs (documented, not fixed), ranked by business impact

1. PO receive: double stock + duplicate expense on retry (R1)
2. Recall quarantine: can move more than the batch holds on retry (R2)
3. Lost updates in all four stock-changing places (R4)
4. Unescaped output on `search.html` / `dashboard.html` (R6): fix in PR #7
5. Product delete wipes stock first (R5)
6. Unpinned CDN library (R7)
7. Return double-restock; manual adjustment double-save (R3 / R4)
8. Unchecked link schemes; CSV formulas (§4.3): fixes in PRs #10 and #9
9. Dates: Tax receipt list one day early; evening dates default to tomorrow (§4.3): fix in PR #11
10. Phone: table swipe changes page; PO tap opens change history (§4.3): fixes in PRs #12 and #14
11. Minor: palette Enter → guide; Tax `in()` URL length at scale; password prompt Enter-twice (PR #13); stale agent text (PR #8)

**Evidence:** the tests and reports on the branches in §6. **Correction from the old docs:** a recall deliberately does *not* reduce the batch's remaining count. That field means "still physically here, in any bucket", so it's by design, not a bug.

---

## 6. Work done on Sept 29, 2026 (all [REPO]: open PRs, none merged, nothing deployed)

**Fixes (change dashboard behaviour; each has its own tests that fail on the old code):**

| PR | Fixes | New tests | Full suite on that branch |
| --- | --- | --- | --- |
| #7 | `search.html` / `dashboard.html` show database text as plain text (security S1 / R6) | 8 | 73 / 0 / 9 |
| #8 | Agents #2/#3/#7/#8 status shows "last recorded state (Sept 26)", not "waiting on minutes" (text only; no agent setting changed) | 2 | 67 / 0 / 9 |
| #9 | CSV exports can't create spreadsheet formulas (S4) | 4 | 69 / 0 / 9 |
| #10 | Evidence / Documents never make javascript:/data:/vbscript: links clickable; refused on save (S3) | 10 | 75 / 0 / 9 |
| #11 | Dates shown or pre-filled a day off in US evenings (display and form defaults only) | 8 | 73 / 0 / 9 |
| #12 | Phone: dragging a wide table no longer switches page | 3 | 68 / 0 / 12 |
| #13 | Password prompt sends one check even if Enter is pressed repeatedly | 4 | 69 / 0 / 9 |
| #14 | Phone: tapping a purchase order no longer opens history on top | 2 | 67 / 0 / 11 |

**Merge check [REPO]:** PRs #7–#14 plus every test PR were test-merged together, in more than one order, with **no conflicts** (after moving two small helpers on Sept 29 evening). The combined suite result is in the "Tests" row of §1.

**Tests only (verify existing behaviour; no dashboard change):**

| PR | Covers | Tests |
| --- | --- | --- |
| #15 | Pages with data, keyboard/palette/overlays, calculation helpers, request baseline, screenshots | branch suite 184 / 0 / 44 |
| #16 | Inventory safety: PO receive, recalls, adjustments, returns, product delete (reproduces the known bugs) + 2 reports | 50 (250/250 ×5) |
| #19 | Feature Flags, System Mode, Business Rules, Approval Queue | 30 (90/90 ×3) |
| #20 | Inactive account, forgot password, non-owner calendar | 16 (48/48 ×3) |
| #21 | Quality Control, Adverse Event Reports, Legal Holds | 20 (60/60 ×3) |
| #22 | Purchase orders except Receive | 20 (60/60 ×3) |
| #23 | Employee Activity filters/paging, owner Calendar views/notes | 24 (72/72 ×3) |
| #24 | Agent pause switches (mock only), Active Sessions, Customer Inquiries | 20 (60/60 ×3) |

**Documentation:** #5 (`CLAUDE.md`, now pointing here), #6 (this record), #17 (security review with fix status; S6 corrected), #18 (modularization plan + architecture map).

The branch `claude/po-receive-investigation` is superseded by #16 (same content plus more); no PR is needed for it.

**Currently doing (Sept 29, evening):** the owner is reviewing. Every item Claude can do safely is in a PR. The rest (R1–R5, R7, the decisions above) waits on the owner. Nothing is merged or deployed by Claude.

---

## 7. Completion percentages (with basis and uncertainty)

Each percentage below measures **one specific checklist only**. None of them is a "whole project" percentage.

The cross-area progress tracker (all work areas, including the public website, with one rough overall estimate) is [health-endeavors-progress.md](health-endeavors-progress.md). The short cross-project summary is [health-endeavors-current-state.md](health-endeavors-current-state.md).

| Checklist measured | Value | Basis | Uncertainty |
| --- | --- | --- | --- |
| **Blueprint 90-item addendum** (Build Now 11 + Build Soon 28 + Future 51; *extra hardening features, not the core system*) | **51 done / 90 ≈ 57%** (≈ 58–59% counting 3 partial items as half) | The owner's recount on Sept 26; nothing since has added a Blueprint item (task buttons, tests and reviews aren't on that list) | Official figure from the old docs; not re-audited here |
| **Original 69-item specification** (the owner's founding requirements list, preserved in the Blueprint checklist) | **46 done, 15 partly, 8 open**: ≈ 67% done, ≈ 77% counting partly as half | **My tally on Sept 29** of the per-item statuses written in the Blueprint checklist | Unofficial; the categorisation of "partly" is a judgement call; owner may recount |
| **Launch-required list R1–R10 in §4.1 of this record** (Claude's list, from this session's findings) | **~10 required items (R1–R10), 0 done on `main`**. R6 has a fix waiting in PR #7 (1 of 10 if merged); ~5 owner checks pending | §4.1–4.2; only merged work counts as done | Rough: R1 is large (a DB function + dashboard, several PRs); R2–R4 reuse its pattern; R5–R7 are small. Depends on the owner's pace for SQL runs and reviews. |
| **Task buttons v2 post-deploy checklist** (the 9 checks in the Blueprint checklist, Sept 27) | 4 of 9 done [HIST] | Sept 29 template | The 5 remaining are [PENDING] |

**Remaining effort, in PR-sized steps (estimate):**
- Inventory safety R1–R5: about 10 PRs (SQL draft + dashboard for each; R2–R4 are smaller once R1 sets the pattern).
- Security R6: done in PR #7 (waiting for review). R7: 1–6 small PRs once a safe way to verify the hash is chosen.
- §4.3 small fixes: 7 of 8 are in PRs #8–#14 (waiting for review). The 8th (palette Enter) waits on an owner decision.
- Review load now: 20 open PRs. Fixes #7–#14 are small (each about 1–40 lines of dashboard change). Test PRs #15, #16 and #19–#24 add no dashboard change.
- Modularization: about 15 PRs, only after R1–R4.

These are counts, not hours. Time depends on review and SQL-run turnaround.

---

## 8. Discrepancies and uncertainties found while reconciling

1. **Agent registry text on the live dashboard** says #2 / #3 / #7 / #8 are "waiting on GitHub Actions minutes (resets Oct 1)". Per the old docs they were **disabled on Sept 26 until products exist**, so they will *not* start on Oct 1. The text should be corrected (small PR).
2. **Agent #1 pause state** after the Sept 24 test: the old docs say it "needs to be switched back on before real orders". **[UNVERIFIED]** whether that happened.
3. **`RESUME_HERE_2026-09-28.md`** and other old-chat files (SQL drafts, rollback files, test packages, the platform review) were **not provided** to this session. Their contents are known only through the summaries above.
4. **The Sept 29 screenshots**: live vs preview is unclear (§3).
7. **"On `main`" vs "live":** this record says **[REPO]** only for what Claude checked in the repository. Whether GitHub Pages is serving that exact file is confirmed only by the owner's live checks ([HIST]) or a future check on the live address ([PENDING]).
5. **Git history** shows the site was created Sept 7–8 and changed Sept 13. The old docs start in detail on Sept 16. Earlier work (Task 1 foundation, Agents #1–#8) isn't dated day by day in these sources.
6. **Old docs vs repo on how deploys work:** until Sept 28 the owner uploaded files through the GitHub web UI. **Since Sept 29, `main` is protected**: changes go through PRs that the owner approves and merges.

---

## 9. Daily history (Central time)

| Date | Completed ([HIST] from the owner's documents unless marked [REPO] = git history / PRs) |
| --- | --- |
| Sept 7–8 | [REPO] Repository created; first pages uploaded |
| Sept 13 | Page update (git); last nightly GitHub backup before the Actions minutes ran out (docs) |
| Sept 16 | Sensitive-action password re-check live; calendar sync fixed (3 bugs) + repeating events; Shopify sync turned off on purpose; waitlist table |
| Sept 17 | Deploy process written down after the calendar-missing incident; privacy access logging wired; replaceable AI models; Sessions, Break-Glass, SOPs, Feature Requests, Evidence Locker, Adverse Events, Legal Holds all live |
| Sept 18 | AI model fallback (committed); internal knowledge base (SOP → agent) |
| Sept 19 | Customer Inquiries severity; Business Continuity page |
| Sept 20 | Daily Summary; Scheduled Reports steps 1–3 + Report History; Customer Inquiries review screen; sidebar + search redesign and 6 navigation extras; Accounting (Agent #9); Blueprint saved (49/90); administrator role (database) |
| Sept 21 | Inventory; Returns (first version); receipt uploads; Business Rules page |
| Sept 22 | Returns corrected and verified; account numbers; change history extended to 39 tables; Employee Activity feed + page; Record Inspector |
| Sept 23 | Apple-style redesign, progressive loading, ⌘K, guide, calendar rebuild, iPhone install; live address documented; Suppliers & Purchase Orders; products add/edit + unique SKU; append-only log; unusual-activity alerts (Central); user-deletion fix |
| Sept 24 | Batch/lot tracking; Quality Control; Recalls + cross-links; agent permission audit; Documents; System Mode; per-agent switches (Agent #1 enforced ✓); Orders delete; Tax Records (Agent #10); platform review + first fixes (hourly agents, phone menu CSS, Business Health, "X of Y"); Agent #6 moved to Supabase |
| Sept 25 | Administrator account activated; change-password page |
| Sept 26 | Forgot-password flow live; personal calendar; Agent #6 observation (32 clean runs) + pause test; **Agent #4 live in Supabase**; 7 GitHub workflows disabled; folded Compliance group; overnight switch alert + low-stock warning installed; **Agent #5 live**; delay-days 1–365 check live; fake-order end-to-end test passed; **Agent #6 v2 live**; combined 3-order test passed |
| Sept 27 | Task duplicate fix (Agent #5 v3, #4 v4) live + in-progress test; tasks access-rule check; **task buttons v1 live** and checked; v2 built and approved; paused at night (v2 not yet seen live) |
| Sept 28 | [REPO] **Task buttons v2 uploaded to `main`** (4edf5d6) |
| Sept 29 | [HIST] v2 live checks (4 of 9); [REPO] GitHub safety set up; verification record (PR #1); CODEOWNERS (PR #3; PR #2 closed); test suite + code review (PR #4); Code Owners rule on. This session: read-only verification, PR #5 (`CLAUDE.md`), the inventory-safety, regression-coverage, modularization and security branches, and this record |
| Oct 5 | [REPO] Overnight platform branch `claude/platform-overnight-implementation` (not merged): guarded updates, R7, N14 paging, agent truth, stress tests. Owner ran Query A (schema, read-only); fixes for the 3 bugs it confirmed (Deny → `rejected`, rejected = closed, document links). Owner ran Query B (read-only): **ran clean; no existing data repair required** |
| Oct 6 | [REPO] Same branch, not merged, nothing deployed: R1–R5 drafts hardened (failure injection, 19-scenario stress, 30 runs, 0 deadlocks); state-machine audit (document categories fixed; mock enforces real rules); stale-tab / silent-refusal / storage / scale / XSS / accessibility / empty-database audits with fixes and tests; Query C v2 and Query D prepared (not run). Owner review: `docs/ops/OWNER_REVIEW_2026-10-06.md` |
| Oct 6 (extension) | [REPO] Same branch, not merged, nothing deployed: master backlog (162 deduplicated items from 217 candidates, `docs/ops/MASTER_PLATFORM_BACKLOG_2026-10-06.md`); Emergency-mode honesty; silent-refusal sweep finished; session revoke check; sanitized error text; reporting boundary tests to 10,000 rows; unknown-vs-zero states; AA contrast light/dark; stress S20 (100 callers); page mutation harness (12/12 caught); helpers step 2c (API 3); R1–R5 install runbook. See the extension section of the owner review |
| Oct 6 (extension 3) | [REPO] New branch `claude/platform-overnight-extension-3` (from `37050c6`), not merged, nothing deployed:
- Second-pass audit, findings X3-01…32. P1 items fixed on the branch:
  - Expenses money total cut at 200
  - duplicate manual order on retry
  - manual order dates on the wrong day (live on `main`)
  - R1–R5 install preflight
- Test framework: a state-machine rule in every test, a failure-injection matrix, role / scale / device matrices, and session-loss handling
- Mutation checks: page 31/31, SQL 8/8 (3 untested SQL rules found and covered)
- Stress: 25 scenarios
- Query C v3 with an owner guide (not run)
- Readiness checklist, auditability, product lifecycle, rollback/backup reviews
- See `docs/ops/OVERNIGHT_PLATFORM_EXTENSION_3_2026-10-06.md` |
| Oct 6 (extensions 4 and 5) | [REPO] Branches `claude/platform-deep-readiness-extension-4` and `-5`, not merged, nothing deployed. Deep-readiness passes; details and evidence in `docs/ops/DEEP_PLATFORM_EXTENSION_4_2026-10-06.md` and `docs/ops/DEEP_PLATFORM_EXTENSION_5_2026-10-06.md` (row added in EXT6; the reports are authoritative) |
| Oct 7 (extension 6) | [REPO] Branch `claude/platform-deep-readiness-extension-6` (from `ae8e9aa`), not merged, nothing deployed. EXT5 re-verified clean on its own commit. Fixed on the branch (several live on `main`): revenue counted cancelled / refunded orders on Daily Summary, the home tile and Orders; Orders revenue covered 300 orders; sign-out left the previous data in the page; "-$0.00"; manual-order recovery could duplicate. Drafts, not installed: PO line guard revision, request keys, Query E. See `docs/ops/DEEP_PLATFORM_EXTENSION_6_2026-10-07.md` |

---

## 10. Where the details live

| Topic | Location |
| --- | --- |
| Standing rules | `CLAUDE.md` (PR #5). It tells every session to read this record alongside the rules. |
| Access verification | `docs/security/claude-access-verification.md` |
| Code-quality review | `docs/code-quality/owner-login-review.md` |
| Tests | `tests/README.md` |
| Inventory safety | branch `claude/inventory-safety-audit` → `docs/plans/inventory-safety-report.md` |
| PO receive plan | branch `claude/po-receive-investigation` → `docs/plans/po-receive-atomic-plan.md` |
| Regression coverage | branch `claude/regression-coverage` → `docs/plans/regression-coverage-report.md` |
| Modularization | branch `claude/owner-login-modularization-plan` → `docs/plans/owner-login-modularization-plan.md`, `docs/plans/owner-login-architecture-map.md` |
| Security review | branch `claude/frontend-security-review` → `docs/security/frontend-security-review.md` |
| Owner review (latest) · launch readiness | `docs/ops/OWNER_REVIEW_2026-10-06.md` · `docs/ops/LAUNCH_READINESS_2026-10-06.md` |
| Audits (2026-10-06) | `docs/ops/state-machine-audit.md`, `mutation-safety-audit.md`, `storage-safety-audit.md`, `pagination-scale-audit.md` |
| Stock functions (R1–R5) | `docs/ops/R1-R5-function-design.md`, `docs/ops/stress-test-results.md`, `docs/ops/sql/drafts/` |
| Cross-project summary · progress tracker | `docs/health-endeavors-current-state.md` · `docs/health-endeavors-progress.md` (this PR) |
| Public website (separate project) | Local website workspace → `docs/website/README.md`; never in this repository. A website repository needs the owner's approval. |
| Full back-end history, SQL fingerprints, agent details | Old-chat *Internal Operating System Documentation* and *Blueprint Checklist* (**owner's private copies; not in this repo on purpose**, since they contain sensitive details) |

**Keeping this current:** update §1, §3, §4 and §9 whenever something is merged, verified live, or decided. Put the date on each change, and when sources disagree, say which one wins and why.
