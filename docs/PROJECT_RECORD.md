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
| Oct 7 (extension 7) | [REPO] Branch `claude/platform-deep-readiness-extension-7` (from `444e00c`), not merged, nothing deployed. Fixed on the branch (two live on `main`): Tax Records by-state split and case-sensitive cost estimate; open tasks / approvals / incidents hidden behind closed ones; a different person's sign-in elsewhere left the previous data in the tab; unknown service status shown as Operational; plus Recently finished + Reopen, "?" tiles, unsaved-typing question. No new SQL draft. GitHub admin credential re-checked (X6-17 still open). See `docs/ops/DEEP_PLATFORM_EXTENSION_7_2026-10-07.md` |
| Oct 10 (extension 8) | [REPO] Branch `claude/platform-deep-readiness-extension-8-2026-10-07` (from `f868903`), not merged, nothing deployed. Fixed on the branch (all live on `main`): waiting questions hidden behind answered ones, older orders unreachable for returns/search, capped lists without a count, Back leaving the dashboard, back-cache sign-in, two "This Week" windows, product and PO totals lost updates, out-of-order replies on 5 pages, missing CSP on 5 pages. New: Home Checks card (17 checks, UNKNOWN distinct from fine), Query F (read-only, not run), local restore drill, staging review copy (synthetic; URL needs owner choice). GitHub admin credential re-checked (X6-17 still open). See `docs/ops/DEEP_PLATFORM_EXTENSION_8_2026-10-07.md` |
| Oct 10 (extension 9) | [REPO] Branch `claude/platform-deep-completion-extension-9-2026-10-10` (from `8aa24a9`), not merged, nothing deployed. Stock buttons ready for R1–R5 behind per-button switches (off; cannot turn on before the function exists); request keys on 5 create forms behind a switch; fixed calendar lost updates, per-page currency warnings (X8-19), older expenses unreachable, framing (clickjacking), stale Home checks, CSV edge cases; hard-wall tests (no send path, accounting read-only). Prepared: Query G, drafts 21–28 with rollbacks and local tests. Owner one-pager `docs/ops/OWNER_UNBLOCK_CENTER_EXT9.md`. GitHub admin credential re-checked (X6-17 still open). |
| Oct 11 (extension 11) | [REPO] Branch `claude/platform-ext11-final-readiness-2026-10-11` (from `56a927c`), not merged, nothing deployed. Fixed: orders without a total counted as $0 (X11-01); return receive / recall quarantine after a lost connection now read the record back and say whether the stock step ran (X11-02, X11-03); missing report figures shown as 0 (X11-04); received return labelled "Restocked" when the restock had not run (X11-06). System status shows installed database steps and switch safety (X11-05). Merge-before-SQL test profile; one-sitting read-only session interpreter with backup intake and evidence expiry. Owner docs: `OWNER_UNBLOCK_CENTER_EXT11.md`, `PRODUCTION_READINESS_BOARD_EXT11.md`, `OWNER_CHECKS_EXT11.md`, `ENGINEERING_CATALOG_EXT11.md`. X6-17 still open. |
| Oct 11 (extension 12) | [REPO] Branch `claude/platform-ext12-preproduction-simulation-2026-10-11` (from `ad9a0ab`), not merged, nothing deployed, **no page code changed**. Added local tools that connect to nothing: owner-evidence intake (`tests/tools/evidence.js`), deployment simulator (`tests/tools/deploy-sim.js`), incident map (`tests/tools/incidents.js`); 39 Node tests; 12/12 tool mutants caught. Docs: `START_HERE_EXT12.md`, `OWNER_EVIDENCE_GUIDE_EXT12.md`, `DEPLOYMENT_SIMULATION_EXT12.md`, `INCIDENT_SIMULATION_EXT12.md`, `OPERATOR_TRAINING_EXT12.md`, `OWNER_DECISION_STATUS_EXT12.md`. No owner evidence received. X6-17 still open. |
| Oct 11 (extension 13) | [REPO] Branch `claude/platform-ext13-owner-attention-final-audit-2026-10-11` (from `bd574df`), not merged, nothing deployed, **no page code changed**. Fixed: evidence intake treated an undated result as fresh forever. Corrected: legal-hold option 2 description in EXT11/EXT12 docs. Found: all 23 older open PRs (#5–#27) are contained in #28. New: `OWNER_ATTENTION_SESSION_EXT13.md` (owner entry), `PLATFORM_MATRICES_EXT13.md`, `SOURCE_OF_TRUTH_MAP_EXT13.md`, `RELEASE_REVIEW_EXT13.md`, `DATA_MODEL_DICTIONARY_EXT13.md`, `OPERATIONS_HANDBOOK_EXT13.md`, `POST_LAUNCH_BACKLOG_EXT13.md`, `OWNER_SESSION_PROMPTS_EXT13.md`; doc checker (`npm run docs:check`). 30 old entry documents marked. No owner evidence received. |
| Oct 12 (extension 14) | [REPO] Branch `claude/platform-ext14-deep-engineering-2026-10-11` (from `cc9a142`), not merged, nothing deployed. Page code frozen at `3a40095`. Changed: owner page program moved to `assets/owner-login-app.js` with a strict script policy and a 'program did not load' message; diagnostic summary copies only known role words (leak found by new fuzz test). SQL: drafts/11 refuses while a stock switch is ON; drafts/13 reports missing totals; new rollback drafts/31; test SQL moved to `local-test/draft-tests/`; `MANIFEST.json` + `npm run sql:lint`. New: `.github/workflows/ci.yml` (tests only, inactive until merged), staging scenarios + offline zip, status manifest + validator, crash-safe mutation runners, screenshot policy (6 duplicates removed). Found: the repository secret check had failed since EXT12 (fixed). Docs: `ENGINEERING_REPORT_EXT14.md`, `RELEASE_REVIEW_EXT14.md`, `CI_GUIDE_EXT14.md`, `START_HERE_EXT14.md`, `CURRENT_PLATFORM_STATE_EXT14.md`. No owner evidence received. |
| Oct 12 (extension 15) | [REPO] Branch `claude/platform-ext15-modularization-csp-2026-10-12` (from EXT14 `e51f9ed`), not merged, nothing deployed. Page code frozen at `66a9918`. Changed: owner program split into 16 modules in `assets/app/` + registry (moved unchanged, `verify-moves.js` proof, 14 named edits); owner page `style-src 'self'` (325 inline styles → classes, computed styles identical); fixes: nightly blank count no longer PASS, unclear agent switch = Unknown, failed AI month-spend read = '?', offline bar no longer covers the menu. CI: actions pinned to verified SHAs, duration-balanced shards, static job no longer runs a browser spec (every PR #29 run had failed), pushes compare with main, browser job has full history; DB stress harness retries only refused connections (cause of the intermittent CI DB failure). Tests: final full suite 1,991 passed / 0 failed / 0 flaky; GitHub CI all green on `3980d99`; 12/12 EXT15 mutants. Docs: `*_EXT15.md` (8). No owner evidence received. |
| Oct 12 (extension 16) | [REPO] Branch `claude/platform-ext16-overnight-systems-hardening-2026-10-12` (from EXT15 `f2b2d33`), not merged, nothing deployed. Page code frozen at `bc8ce5e`. Changed: every dashboard page now refuses inline styles and inline scripts (manual order page script moved to `assets/manual-order-entry.js`); PO receiving runs through an explicit operation state machine (`assets/app/he-ops.js`; server calls unchanged); admin and compliance pages moved into modules (program 6,214 lines, 19 modules); automatic shrinking of failing random-test sequences. Intermittents: INT-2 (offline-bar check) explained and fixed (test timing during the sidebar slide); INT-5 (GitHub Ctrl-C runner test) caused by 17 stale mutants, repaired, with a test that every mutant applies; **INT-4 explained, not fixed**: rare deadlock between draft `delete_unused_product` and a delivery receive (drafts/10, not installed), reproduced by `docs/ops/sql/local-test/s29_lock_cycle_repro.sh`, fix scheduled for EXT17; INT-3 open. Also found: draft receive of an order with no lines fails with "division by zero" (EXT17). Test speed measured: session reuse −5.6%, 3 workers −7% (both off). Docs: `*_EXT16.md` (8). No owner evidence received. |
| Oct 12 (extension 17) | [REPO] Branch `claude/platform-ext17-deep-reliability-2026-10-12` (from EXT16 `bcf4f25`), not merged, nothing deployed. Draft SQL (drafts/10, not installed): INT-4 deadlock fixed (delete re-checks under the product lock; forced reproduction 5/5 clean, old 2/2 deadlock); an order with no lines can be received (was "division by zero"); below zero in any bucket gives the plain message (the friendly check ran after the update and was dead code; found by the new inventory property model). New reviewed fingerprint `f6d9c2c8be690710eeb721041f6779d9`. Dashboard: manual stock adjustment has an explicit state + read-back (a lost reply plus a second press used to add the stock twice: +5 became +10); "stock saved, history refused" now says the stock WAS changed; sidebar works with full, blocked or junk browser storage. Testing: DB property model (1,800 operations, self-test), chaos up to 1,000 steps, 60-minute soak, storage, 400% zoom, session-reuse isolation; 5 test-harness flaws fixed. Trusted Types measured (86 locations), not adopted. Docs: `*_EXT17.md`. No owner evidence received. |
| Oct 13 (extension 18) | [REPO] Branch `claude/platform-ext18-security-reliability-2026-10-12` (from EXT17 `9b589bf`), not merged, nothing deployed. Defensive security round, local only. Real bugs fixed (each fails on the old code): values named like built-in JavaScript properties (`__proto__`, `constructor`, `toString`) broke Sales tax by state (a customer-typed shipping state showed "—" or vanished), the Accounting duplicate purchase-order check, Tax category labels and the cost estimate (now prototype-free lookups); after a sign-out in another tab while a save was still on its way the page claimed the change "was not sent" (now: may or may not have been saved). Script policy narrowed from the whole CDN to the one pinned library file on all 6 pages. Error text capped before slow patterns (7 quadratic regexes). New gates in CI: static security check, DOM sink gate (52 hand-reviewed values, dangerous sinks 0), slow-regex audit, secret-file firewall; `npm run security:quick` / `security:deep`. Local RLS contract + audit completeness/immutability (63 checks); findings F1/F2 for Query G (audit insert privilege; audit read by any signed-in user), nothing changed in production. INT-6 (new multi-tab tests timing out under load) found and fixed. Docs: `*_EXT18.md` (10). No owner evidence received. |
| Oct 13 (extension 19) | [REPO] Branch `claude/platform-ext19-preproduction-completion-2026-10-12` (from EXT18 `5f645d3`), not merged, nothing deployed. Real bug fixed: System mode and the agent switches read `profiles.full_name`, which the real table does not have (Query A: `display_name`), so "changed by" never showed a name; found by the new schema contract (every table/column the page names vs the real-shape schema; the mock now refuses unknown columns). Safe element builder `h()`; sidebar and skeletons built without HTML parsing (Trusted Types reports 168 → 86). Whole program type-gated (27 files, 0 gated defects; dead code removed). Machine-readable high-risk operation contract (7 operations) checked against the code. Local storms at 100/150/250 callers: exactly once, 0 deadlocks. Mutation runner reports "no test ran". Final evidence on frozen code `31cf21f`: full local suite 2,112 passed / 0 failed / 350 skipped; GitHub CI green; mutants 213/213; DB suite 30/30. Two one-off failures in the earlier full run are registered as open intermittents (INT-7 palette speed, INT-8 document upload). Docs: `*_EXT19.md`. No owner evidence received. |
| Oct 17 (extension 20) | [REPO] Branch `claude/platform-ext20-adversarial-completion-2026-10-13` (from EXT19 `b433037`), not merged, nothing deployed. **Real bug fixed (INT-7, product):** each palette keystroke called scrollIntoView (whole-page layout, 93% of keystroke time with 10,000 inventory rows) and searchEverything built every match then kept 30; keystroke p50 37.5 → 2.5 ms, 4× slower CPU max 284 → 35 ms. **INT-8 (test race)** reproduced on demand and fixed. INT-3 open with in-flight evidence. Trusted Types 86 → 56 (ratchet test). Database concurrency measured: old psql storms reached only 3–6 simultaneous calls; new pgbench test measured up to 250/250 simultaneous, exactly once, 0 deadlocks; over-limit fails loudly. Query G G08/G09 answer F1/F2; new read-only Query A2; schema drift detector; CI postgres image pinned to registry digest; agent-boundary invariants; Back/Forward never resend. Harness false-green found and fixed (race-test setup errors were swallowed). Docs: `*_EXT20.md`. No owner evidence received. |
| Oct 18 (production) | [LIVE, owner-run] Read-only Queries G, G2, G3 run by the owner on production. Tables: RLS on for all 61; audit log readable by the owner only (F2 effectively option A); F1 confirmed as WARN. **FIX 1A applied by the owner:** `revoke all on public.activity_timeline from anon` (the view had been readable by visitors who were not signed in). Owner-reported check: `visitors_can_still_read = false`. SQL, rollback and details: `docs/ops/PRODUCTION_CHANGE_LOG.md`. Owner re-ran Query G2 after the fix: `activity_timeline` now WARN (was FAIL), the other 15 views PASS, the P1 item still WARN (fix prepared, not applied). **FIX 2 applied by the owner:** a guard trigger on `profiles` so only the owner can change a role or break-glass access (and only the owner, or an administrator for someone else, can deactivate/reactivate/delete an account). Verified by the owner's Query G3: trigger present, source matches the tested SQL; dashboard loads normally (owner-reported). **FIX 1B applied by the owner:** `activity_timeline` set to `security_invoker`. Final Query G2 after it, checked by Claude row by row: all 17 views PASS (earlier '16' came from G04; `needs_attention` was not in G04), profiles guard present. Security-fix round complete and checked. Read-only G04 review written (`docs/ops/G04_VISITOR_RIGHTS_REVIEW.md`): visitors can only add rows to 3 form tables; the default rights are a missing second lock, not an open hole. Query D run by the owner (read-only): 32 owner-rights functions (E=8, D=2, C=9, B=4, A=9). Review in `docs/ops/QUERY_D_FUNCTION_SECURITY_REVIEW.md`: the 9 trigger-only functions are safe, but 10 functions can be called by not-signed-in visitors with no caller check (LOW-HIGH, provisional). FIX 3 prepared and tested locally (23/23), not applied, kept private until applied. Next read-only step: Query D2 (real bodies + scheduled jobs) to confirm severity. | **EXT20B (local):** RLS self-escalation search across all tables found profiles was the only sensitive self-editable table (now guarded); `personal_calendar_events` self-edit is benign. `approval_requests` has no separation-of-duties rule (any active staff can approve; OWNER DECISION). profiles 3-trigger ordering/atomicity tested (10/10). See `docs/ops/EXT20B_AUTHORIZATION_MODEL.md`. **EXT20B owner pack:** `docs/ops/OWNER_PRODUCTION_VERIFICATION_NEXT.md` (next-step sequence, rollback catalog, dependency graph, decision register, approval separation-of-duties options A/B/C as OWNER DECISION). Read-only drift check `sql/11_READONLY_security_fix_drift_check.sql` (confirms FIX 1A/1B/2 still in place; tested locally PASS-and-FAIL). Change-log evidence validator `npm run changelog:check` (3/3 entries complete). Safari window-shrink investigated: normal macOS/Safari minimum, not a dashboard min-width. Bug hunt: 0 new defects. **EXT20C:** Query D2 interpreter built + tested on 4 synthetic fixtures (never passes an incomplete/wrong-project result); drift-check mutation test 9/9 (every single-fact regression detected); fresh direct reads of updateIfUnchanged/changeStock/agent-switch — 0 new defects.
| Oct 19 (EXT20J local hardening) | [REPO] Same branch `claude/platform-ext20-adversarial-completion-2026-10-13`, not merged, nothing deployed, production untouched, Query D2 not run. **Trusted Types endgame:** every dynamic HTML sink and the 4 remaining static overlay scaffolds converted to the safe DOM builder → 0 innerHTML, report-only violations 56 → 0 with a live probe (ratchet `trusted-types-ext20.spec.js`, ceiling 0). **Real bug fixed (local, visual):** per-calendar colours were dead because JavaScript residue had leaked into `owner-login.css` during the EXT15 inline-style→class conversion; fixed the CSP-safe way (CSSOM) — **VISUAL CHANGE, owner visual approval still required** (`docs/ops/EXT20J_RESERVE_VII_REVERTABILITY.md` explains why a forward-fix, not a git revert, is the way to undo it). New guard `npm run css:check` (JS-residue / brace / paren / unclosed-comment scanner). **Branch-level tooling (Reserve VII):** `tests/tools/branch-archaeology.js` (classifies all ~460 commits by kind/subsystem/risk), `tests/tools/merge-rehearsal.sh` (disposable-worktree merge rehearsal: 0 conflicts, merged tree identical to HEAD, gates pass), owner review package + revertability analysis (`docs/ops/EXT20J_RESERVE_VII_*`). **Verification tooling (Reserve VIII):** measured transition coverage + exhaustive illegal-transition proof for the he-ops machine (`state-coverage-ext20.spec.js`; VALIDATING is table-reachable but API-unreachable, pinned); generated-artifact determinism + freshness (`generated-determinism-ext20.spec.js`) — caught and fixed stale `:NNNN` line numbers in WRITE_PATH_MATRIX / MUTATION_WRITE_PATH_INVENTORY / WRITE_PATH_INVENTORY (content unchanged). Gates green (TT 0, css:check, dom-sinks 0/0, sql:lint, docs:check, secret scan). 0 new product defects. Remaining work is owner-gated (calendar visual approval, Query D2, policy decisions, real devices, PR review, merge, deploy). |
| Oct 19 (Sales & Growth engine) | [REPO] Same branch, not merged, nothing deployed, production untouched, **nothing sent, no samples approved/shipped**. New product scope: a Sales / Wholesale / Growth ENGINE + presentation layer added as 14 pure, unit-tested modules under `assets/sales/` (not yet wired into any shipped page): provider-neutral AI drafter (free deterministic template; Claude/OpenAI gated), deterministic lead scoring, 21-state wholesale pipeline (owner-approval gates on outreach + sample), claim firewall (body-care, fails closed), sample safety system (eligibility funnel + owner-actor approval + monthly budget guard + ROI), outreach draft builder (approved-facts-only + firewall), reply classifier (UNKNOWN-first), follow-up planner (suppression), AI cost control + model routing (deterministic-first, hard budget stop), lead importer + duplicate graph, B2B Gmail connector contract + double (SEND hard-disabled, no real account), read-only analytics (safe denominators, funnel simulation, sample economics), a synthetic data kit, and label-tagged page view-models + a sink-free render adapter for all 7 pages (feature-flag OFF; not wired into owner-login.html — activation seam documented). 13 `tests/specs/sales-*.spec.js` (incl. an adversarial/prompt-injection pass) pass locally. Product is BODY-CARE/SKINCARE (not a supplement). Owner-gated: UI page wiring, real Gmail + send decision, real sample budget/wholesale price/MOQ/claims, provider keys. Doc: `docs/ops/SALES_GROWTH_AND_WHOLESALE_SYSTEM.md`. |
| Oct 19 (Sales & Growth PART I wiring) | [REPO] Same branch, not merged, nothing deployed, production untouched, **nothing sent**. The Sales engine is now **wired into `owner-login.html` behind a feature flag that is OFF by default** (`salesGrowthOn()` in `he-config.js`, browser switch `localStorage['he_sales_growth']`). With the flag off there is no sidebar group, no link, and each of 7 new panels renders only an inert DISABLED shell without instantiating the data engine — so the live dashboard, the Trusted-Types ratchet (ceiling 0), the DOM-sink gate (0/0) and every page-sweep spec are unchanged. With the flag on, a collapsible **Sales & Growth** group appears with 7 read-only/draft-only pages (Growth Command Center, Wholesale Leads, Pipeline, Sales Approvals, Samples, Sales Analytics, Sales Agent Activity) rendering clearly-labelled SIMULATED fixture data via the shared safe DOM builder `h()` (no innerHTML). 4 sales engine files added to the page `<script>` manifest (content-hashed); `render()` adapter generalised to every page shape. New spec `tests/specs/sales-wiring-ext20j.spec.js` (desktop+iPhone, 8 tests) proves flag-off invisibility/inertness and flag-on behaviour; existing suites still green (assets, modules-ext15, TT, general, nav-history, a11y-basics, pages-strict, no-live-send, css/secrets/docs gates). Still owner-gated / not done: remaining pages (Lead Detail, Retention, Content, Territory, Campaign Lab, Data Quality), styling, ~50 advisory agents, and everything from the engine row above. |
| Oct 19 (Sales & Growth PART II — advisory agents) | [REPO] Same branch, not merged, nothing deployed, **nothing sent**. Added a real **advisory agent registry** (`assets/sales/he-sales-agents.js`, 32 agents across Leads/Pipeline/Approvals/Samples/Analytics/Content/Retention/Territory/Data-Quality) that backs the Sales Agent Activity page instead of 4 stubs. Every agent is OFF by default and **advisory-only**: capabilities are drawn from a fixed safe set (observe/score/flag/draft/summarize/simulate/classify/dedupe/rank/plan); none can send, approve, reserve, ship, charge, delete or contact — `assertSafe()` fails closed. Honest health (never-run = UNKNOWN). Loaded on the `window.HE.sales` namespace (not the app module graph). New spec `sales-agents-ext20j.spec.js` (6 tests) + strengthened `sales-wiring` (asserts the real roster renders). Gates green (TT 0, dom-sinks 0/0, app-modules 19, assets hashes, write-path + module-map regenerated). |
| Oct 19 (Sales & Growth Reserve II) | [REPO] Same branch, not merged, nothing deployed, **nothing sent**. Owner-authorized local capability expansion. Added **14 new pure engine modules** (retention, territory, data-quality, content, campaign-lab, forecast, lead-detail dossier, lost-deals, anomaly, owner-workload, benchmark/gold harness, agent scorecards, provider matrix, safety-center) on the `window.HE.sales` namespace, each synthetic/advisory/draft-only with its own spec (`sales-caps2/3/4/5-ext20j.spec.js`, 31 tests). Then **wired 9 more flag-OFF pages** (Lead Detail, Retention, Content Opportunities, Territory & Expansion, Campaign Lab, Sales Data Quality, Sales Forecast, AI Cost Center, Sales Safety Center) — 16 sales pages total, all rendered via `he-sales-ui.render` sections with full truth labels. Safety invariants enforced in code & tested (`he-sales-safety.assertInvariants` fails closed: no send mode, Gmail/production DB not connected, samples owner-only, claim firewall + DNC always on; global kill switch; per-agent pause; budget guard). Claim firewall blocks unsafe content/campaign drafts (can't reach APPROVED). `sales-wiring-ext20j` extended to all 16 pages (desktop+iPhone). Gates green (TT 0, dom-sinks 0/0, app-modules 19 — sales stays off the app module graph, assets hashes, write-path + module-map regenerated, secrets clean). Still owner-gated: real Gmail/send, real budgets/prices/MOQ/claims, provider keys, merge/deploy. |
| Oct 20 (Sales & Growth Reserve II complete) | [REPO] Same branch, not merged, nothing deployed, **nothing sent**. Expanded to **~37 `assets/sales/` engine modules and 28 flag-OFF pages** (added readiness, sources, queue, creator, sample-advisor, changes, privacy, and an end-to-end lifecycle simulator since the mid-reserve record above). Added a prompt-injection/adversarial safety suite (untrusted text stays data; injections never yield an action label; obfuscated claims still caught), a large-data load spec (10k/50k engine passes within budget), a generated `SALES_INVENTORY.md` + freshness guard, and the lifecycle simulator proving a full import→score→draft→claim-check→owner-approval→SIMULATED-contact→reply→follow-up→sample run has **zero side effects** and that a DNC/unsubscribe event suppresses everything immediately. 25 `sales-*.spec.js` files. Gates green (TT 0, dom-sinks 0/0, app-modules 19, assets hashes, write-path + module-map regenerated, css/secrets/docs/sql, broad browser matrix). Final report: `docs/ops/SALES_RESERVE_II_FINAL_REPORT.md`. Remaining items are thin presentation over existing engines (on request) or owner/external/production-gated. |
| Oct 20 (Sales & Growth Reserve III — owner OS) | [REPO] Same branch, not merged, nothing deployed, **nothing sent**. Built the owner-facing presentation/workflow layer over the engines: **42 sales pages** total (added Content Planner, Commercial & Line Sheet, Sales Settings & Controls, Owner Decision Center, Reporting Center, Scenario & What-If Lab, Outreach Studio, Reply & Follow-up Center, Export Center, Meeting & Deal Prep, Sample Operating System, Agent Lab, Audit & Explainability, Owner Briefs). One new engine helper: `he-sales-export.js` (CSV formula-injection guard + privacy field-drop; `sales-export-ext20j.spec.js`). All read-only/synthetic, composing existing engines; the owner can understand→prioritize→review→approve→plan→simulate→analyze→prepare→document→export→audit with zero external side effects. Non-local steps (Gmail/send/website/production/legal/merge/deploy) are never shown green. 42-page `sales-wiring` spec (desktop+iPhone), broad browser matrix, large-data and adversarial suites all green; gates green (TT 0, dom-sinks 0/0, app-modules 19, assets hashes, write-path + module-map + inventory regenerated, css/secrets/docs/sql). Final report: `docs/ops/SALES_RESERVE_III_FINAL_REPORT.md`. |
| Oct 24 (Sales & Growth Reserve IV — decision intelligence) | [REPO] Same branch, not merged, nothing deployed, **nothing sent**, production untouched (`main` d3db7bc). Started from verified checkpoint `115026e`. Added **3 new pure decision-intelligence engines** (each with its own spec): `he-sales-priority` (explainable weighted ranking v2 + preference **sensitivity** — churn/stability/top-change), `he-sales-progression` (deal aging buckets, soft-SLA **stall** detection, funnel progression map; injected `asOf`, UNKNOWN for missing timestamps), `he-sales-concentration` (top-N share, per-deal/per-account **HHI**, single-deal/single-account/thin/empty risk flags → LOW/MEDIUM/HIGH). Wired all 3 as flag-OFF read-only/synthetic owner pages → **45 sales pages** (Prioritization Lab, Deal Progression & Aging, Pipeline Risk & Concentration). Reliability: a reusable `tests/helpers/sales-pages.js` (one 45-page id→title list + flag enabler) with a drift **sync** guard, and a **per-page a11y matrix** (`sales-a11y-ext20k`) that drives every sales page flag-ON for names/ids/headings/table-headers/AA-contrast(light+dark)/320px-200%-no-scroll/24px-tap — coverage the broad a11y specs never reach. 41 `assets/sales` modules, 31 `sales-*.spec.js`. Gates green (TT 0, dom-sinks 0/0, app-modules 19, verify-moves, assets hashes, generated-determinism, inventory freshness, sales-wiring); regression 65 passed/21 skipped both projects. Report: `docs/ops/SALES_RESERVE_IV_FINAL_REPORT.md`. Reserve IV is a standing program; remaining depth (more mobile/scalability matrices, next-best-action v2, CRM retention, etc.) stays flag-OFF/synthetic; owner/external/production items stay gated. |
| Oct 24 (Sales & Growth Reserve IV — continuation: correctness + safety + audit) | [REPO] Same branch, not merged, nothing deployed, **nothing sent**, production untouched (`main` d3db7bc). Resumed from verified checkpoint `25d4fd0`. **Wave A (decision-engine correctness):** probed the 5 decision-intelligence engines and fixed the real defects — concentration no longer shows a deal id as a pretend customer or collapses account-less deals into one fictitious account (top-account share + SINGLE_ACCOUNT_DEPENDENCY count KNOWN accounts only), counts a repeated deal id once (`duplicateIdsDropped`) and reports dropped non-positive values; progression reads a future date as UNKNOWN instead of age-0/FRESH, flags `inconsistentDates` when a stage predates creation, stable `stalled` tie-break, averages only known ages; priority de-dupes repeated lead ids. Confirmed no wall-clock use (A2), no input mutation (A9), totals/HHI vs independent reference (A10). **Wave B (safety):** new `he-sales-approval` ties an approval to a fingerprint of its material fields so any edit voids it and a post-approval DNC wins, approval is never a send, suppressed/claim-blocked drafts can't be approved; adversarial-reply spec proves injection/HTML/opt-out/huge/unicode text never makes an engine act or bypass the owner. **Wave H9:** new append-only `he-sales-audit` trail distinguishes SUGGESTION/REVIEW/APPROVAL/SIMULATED_OUTCOME (frozen entries, lifecycle-order check, approval fingerprint), surfaced on the existing Audit & Explainability page (no new page). 45 `assets/sales` modules, 38 sales specs, still 47 pages. New specs: wavea-correctness 11, approval 8, waveb-adversarial 5, audit 7. Gates green (dom-sinks 0/0, app-modules 19, verify-moves, assets hashes, generated-determinism, inventory freshness, Trusted-Types, sales-wiring). Report updated: `docs/ops/SALES_RESERVE_IV_FINAL_REPORT.md`. Remaining Reserve IV depth (mobile breakpoints C, render/responsiveness D, retention/territory/creator v2 E, incident F, CRM data-model G, IA subtraction I) stays flag-OFF/synthetic; owner/external/production items gated. Also this session: Wave H1–H8 cross-engine consistency spec (one dataset, consistent identity/account/aging/stage/suppression); Wave D decision-page responsiveness — `sales-scale-ext20k` documented pure-engine-only (D1), new `sales-decision-perf-ext20k` separates in-page engine compute from the page (D2) and proves repeated navigation keeps DOM stable (D5/D7, render-once). Verified the external 500-candidate package (sha256 a43f6e54…, IDs 001–500) and reconciled it in `docs/ops/SALES_RESERVE_IV_D500_DISPOSITIONS.md`: Workstreams 01–02 per-candidate (2 distinct gaps confirmed+implemented: HE-D500-011 repeated-measurement/no-false-precision, HE-D500-031 flag ON→OFF leaves no stale surface; rest ALREADY_COVERED or NOT_JUSTIFIED by render-once/no-handler/static architecture), Workstreams 03–25 triaged at workstream level with genuine Wave C/E/F/G/I candidates flagged. No 500-gap/novelty/production claim. New commits omit `[skip ci]` (repo has no CI workflows). Counts: 47 pages / 45 modules / 39 specs. |
| Oct 27 (Sales & Growth Reserve IV — independent-work completion C/E/F/G/I) | [REPO] Same branch, not merged, nothing deployed, **nothing sent**, `main` d3db7bc untouched. Resumed from verified `17c82e2`. Finished the genuinely-remaining independent waves, leaving only owner/legal/external decisions. **Wave C:** mobile decision-value integrity — at 320px+200% the owner-critical signal on each of the 5 decision pages stays visible/un-clipped (sales rows carry no overflow/ellipsis). **Wave E:** two real fixes — retention now excludes DNC/opt-out customers from every actionable candidate list and surfaces them separately (E4); territory no longer treats sparse data as low potential (unscored → UNKNOWN/null whitespace, `needsData` section, E6); creator honesty evidence (E8/E9/E10). **Wave F:** new `he-sales-incidents` classifies anomaly flags into deduped incidents (capability/evidence/mode/next-action), acknowledge≠resolved, disconnected-provider-never-healthy. **Waves G+I:** `SALES_CRM_DATA_MODEL_DRAFT.md` (design only, no SQL) and `SALES_IA_REVIEW.md` (47-page review; consolidations proposed, nothing removed). 47 modules, 45 specs, still 47 pages. New commits omit `[skip ci]` (repo has no CI workflows). Gates green (dom-sinks 0/0, app-modules 19, verify-moves, assets, determinism, inventory, Trusted-Types); final changed-state regression 84 passed/15 skipped both projects. Report updated with an **OWNER ACTION PACKET** (6 owner/legal/external items, each with recommendation + what-it-unlocks) and a safe-local-exhaustion statement. Safe-local independent work is now effectively exhausted. |
| Oct 11 (extension 10) | [REPO] Branch `claude/platform-ext10-operations-hardening-2026-10-11` (from `f9e4850`), not merged, nothing deployed. Phone card layout for wide tables (U38); request keys on all 18 create paths + escalation once, with key lifecycle (U42); nightly integrity check on Home with honest states + drafts 29/30 (U43); change-password without inline scripts, helpers API 9 (U39). Fixed: feature-request Add button stuck (X10-01), evidence without a file reported as failed after saving (X10-02), unreadable amounts shown as $0.00 (X10-03). Second mission (same branch): Home next steps + checks for low-stock level not set, retired products with stock, agents unhealthy/unknown; agents off on purpose labelled; receipt-unknown lock with read-only check; System status + diagnostic summary; switch dependencies; complete lists past the reply limit; Query H drift check + result interpreter. Fixed: X10-12 (stock-added claim on short lines), X10-13 (Receive offered again), X10-14 (unreadable schedule shown as stale), X10-15 (silent truncation), X10-21 (blank search/dashboard on library refusal), X10-22 (mislabelled tax export), X10-23 (squeezed phone rows), X10-24 (System status cut off on phones). Owner one-pager `docs/ops/OWNER_UNBLOCK_CENTER_EXT10.md`; operations `docs/ops/OPERATIONS_CENTER_EXT10.md`. X6-17 still open. |

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
