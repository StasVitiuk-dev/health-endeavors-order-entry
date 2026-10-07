# Health Endeavors — current state (cross-project summary)

**Last updated:** October 7, 2026, extension 6 (platform §1, §5, §8; website sections unchanged from Sept 30). **Keep this short.** Details live in the linked documents; update this file whenever the verified state changes materially.

Labels: **CURRENT** (verified in a repository or workspace) · **REPORTED** (from the owner's earlier chats, not re-checked) · **PROPOSED** · **OWNER DECISION REQUIRED** · **DEPRECATED**.

| Topic | Authoritative source |
| --- | --- |
| Internal platform in detail (features, evidence, bugs R1–R10, history) | [PROJECT_RECORD.md](PROJECT_RECORD.md) |
| Progress per work area, with percentages | [health-endeavors-progress.md](health-endeavors-progress.md) |
| Standing rules for Claude sessions | [`CLAUDE.md`](../CLAUDE.md) (PR #5) |
| Public website | Separate local workspace, `docs/website/README.md` there (see "Public website" below) |

## 1. Internal platform (the dashboard)

- **CURRENT:** the owner dashboard (`owner-login.html` + 5 other pages) on GitHub Pages from `main`, backed by the production Supabase project (public anon key + staff login + row-level security).
- **REPORTED:** broad operations features are live: orders, inventory with batch/lot tracking, purchase orders, returns, recalls, quality control, adverse event reports (15-business-day deadline), legal holds, customer inquiries, accounting and tax records, tasks, calendar, employee activity, audit log, security pages, and agents #4/#5/#6 running hourly in Supabase. See PROJECT_RECORD §2.
- **Branch work (not merged, not live), Oct 5–6:** `claude/platform-overnight-implementation` holds the Query A fixes, hardened R1–R5 stock-function drafts (tested locally only) and the state-machine, stale-tab, storage, scale, XSS, accessibility and empty-database audits, each with fixes and tests. Query B ran clean; no existing data repair is required. Queries C and D are prepared, not run. See `docs/ops/OWNER_REVIEW_2026-10-06.md`.
- **Extension 3 (Oct 6, not merged, not live):** `claude/platform-overnight-extension-3`, branched from the above at `37050c6`. Second-pass audit and fixes, all with tests:
  - Expenses totals were cut at 200; open returns were cut at 200.
  - A manual order retry could create a duplicate order.
  - A tab signed out elsewhere kept showing the dashboard.
  - A sold product could be deleted.
  - Search Enter opened the Guide instead of the page.
  - Raw error text leaked; some number inputs were unchecked.
  - Also added: a state-machine rule in every test, a failure-injection matrix, a role matrix and a scale matrix up to 20,000 rows; stress at 25 scenarios; mutation checks for the page and SQL; Query C v3 (runs without pg_cron, adds audit coverage) with an owner guide; an R1–R5 install preflight with package tests; and the readiness checklist.
  - See `docs/ops/OVERNIGHT_PLATFORM_EXTENSION_3_2026-10-06.md`.
  - Query C still not run, Query D not run, R1–R5 not installed, production untouched, Shopify Order Sync off.
- **Extension 4 (Oct 6, not merged, not live):** `claude/platform-deep-readiness-extension-4`, branched from extension 3 at `3d5f1cc`. Deep-readiness pass, every fix with tests:
  - Manual orders: retries now need an exact match; two tabs in the same second no longer merge; the attempt survives a reload.
  - Delivery expenses and the Accounting "Last 7 days" figure use the Central calendar day. A delivery received after 7 pm on the 30th used to land in the next month.
  - Emergency mode always tries to switch off Order Sync and pause Agent #7, even if the mode itself cannot be recorded.
  - Totals saved to the database are whole cents; refund amounts are checked; a stale feature-request button can no longer jump to done.
  - Gateway error pages and cut-off replies get plain words; lists at the 1,000-row server limit say they may be incomplete.
  - Accessibility: skip link and keyboard focus kept inside dialogs. The palette lists pages, then records, then Guide.
  - New gates: a write-path inventory, mock-vs-schema drift, numeric contract, error language, and runbook/Query C checksum checks.
  - Mutation testing: 47 page and 10 SQL mutations.
  - Database drafts (local only): R1 expense rounded to cents and a column-type preflight (new fingerprint `3df2bf7a07b451f12f9359ceca1c85df`). Also a new draft guard (17/18) for a PO-line-vs-receive race found in stress, and stress S26–S29 with data-integrity invariants.
  - See `docs/ops/DEEP_PLATFORM_EXTENSION_4_2026-10-06.md` and `docs/ops/OWNER_DECISIONS_NEXT.md`.
  - Query C still not run, Query D not run, R1–R5 and the guard not installed, production untouched, Shopify Order Sync off.
- **Extension 5 (Oct 6, not merged, not live):** `claude/platform-deep-readiness-extension-5`, branched from extension 4 at `82c2582`. Every fix has tests that fail on the old code:
  - Receive now uses the saved order: another tab's line or shipping changes were ignored. In-flight line edits are reported on both sides.
  - Money totals no longer double-count a record created mid-read; Employee Activity no longer repeats rows.
  - Manual orders: a retry never adopts a same-number order, and orders saved without items are listed on sign-in.
  - Inquiry reply drafts no longer overwrite each other; unreadable number text gets a clear message; no customer details kept in browser storage.
  - Database drafts (local only):
    - the PO line guard now also covers adding a line and changing a quantity (each broke the match in 5–6 of 20 races, even with R1)
    - the install survives a double Run
    - install tests 61, forced race orderings, SQL mutations 11
  - Evidence: failure matrix 14 actions × 14 failure kinds, state machines from one fixture, 57 page mutations.
  - Final verification: the full suite has 1,990 tests (1,329 passed, 660 skipped by design). Its one failure was a test-timing mistake, fixed and repeated clean. 57/57 page mutations caught; database checks all pass. Details in §6 of the report.
  - See `docs/ops/DEEP_PLATFORM_EXTENSION_5_2026-10-06.md`, `PO_RECEIVE_RACE_REVIEW.md`, `READINESS_GATE.md`.
  - Query C/D not run; R1–R5 and the guard not installed; production untouched; Shopify Order Sync off.
- **Extension 6 (Oct 7, not merged, not live):** `claude/platform-deep-readiness-extension-6`, branched from extension 5 at `ae8e9aa`. Extension 5 was re-verified clean on its own commit (1,990 tests, 0 failed; every skip accounted for). Fixed with tests that fail on the old code:
  - **Revenue figures (live on `main`):** Daily Summary and the home tile counted cancelled / refunded orders; Orders "Total revenue" covered only the newest 300 orders; zero showed "-$0.00".
  - **Shared computer (live on `main`):** signing out left the previous person's data in the page.
  - Manual-order recovery could create a second order; Emergency mode, error wording and other smaller fixes.
  - Drafts, not installed: PO line guard revised (now protects today's receive and needs no R1 first), request keys, Query E.
  - **Security note:** this session's GitHub connection has admin rights (owner decision X6-17); they were not used.
  - See `docs/ops/DEEP_PLATFORM_EXTENSION_6_2026-10-07.md`, `PRODUCTION_READINESS_MATRIX.md`, `CUMULATIVE_CHANGE_INVENTORY.md`.
- **Store not launched:** 0 real orders, real products not yet added, the Shopify order sync and agents #2/#3/#7/#8 switched off on purpose until products exist (REPORTED). Agent #1's on/off state is **unverified**.

## 2. Public website (customer storefront)

- **CURRENT (local only):** a Shopify Online Store 2.0 theme with working, tested code: complete homepage, product page with gallery, 360° photo viewer (synthetic frames) and related products, cart, search, forms with a server-side intake prototype, cinematic hero structure, degraded states (offline, broken images), policy page structure and a strict production-readiness gate that fails today on purpose. It lives in a **separate local workspace, not in this repository**, and is **not deployed**. Synthetic data only. Theme Check: 0 findings. Also contains an integration simulator and an end-to-end synthetic customer journey (one sale = one order/invoice/journal). Website ≈31% built (code ≈66%, visual implementation ≈35% provisional, staging ≈26%, launch ≈5%). A theme setting switches between preview mode (nothing sent) and Shopify mode (Shopify cart, search, recommendations and customer form). Shopify mode has not been verified in a real store.
- **Design:** TEMPORARY. Final colours, typography, photography and identity are to be chosen by the owner separately.
- **Content:** all placeholder; no product claims written. The legacy Sea Foam bottle is the real packaging. The current final INCI list is required from the manufacturer or lab before launch. Owner visual direction (premium, editorial, oceanic; possible whale secondary mark) is recorded as a decision to make, not a final design.
- **Owner review path:** local preview now → unpublished Shopify development-theme preview link → private staging → production domain, each only with owner approval.
- **Preservation:** dated ZIP + git bundle snapshots are sent to the owner as files, together with a whole-business `handoff/` package covering the dashboard and the website. A GitHub repository for it needs the owner's approval (proposed name `health-endeavors-website`, private).

## 3. Architecture (PROPOSED — OWNER APPROVAL REQUIRED)

- **Shopify custom theme** for the storefront (not headless). Shopify keeps cart, checkout, payments, customer accounts and order records.
- **Internal platform** stays the source of truth for physical inventory (lots, quarantine, recalls), fulfilment operations, returns handling, wholesale, accounting, complaints and quality.
- **The website never touches the internal database.** Forms go to a server-side intake endpoint (insert-only). Shopify events go to a server-side integration service with an idempotent inbox and a reconciliation poll, so a paid order can never be silently lost.
- The platform pushes only a *sellable quantity* to Shopify, and only after the stock functions are made all-or-nothing (R1–R4).

## 4. Important merged work (on `main`)

- **CURRENT:** PR #1 (access verification record), PR #3 (CODEOWNERS: owner reviews everything), PR #4 (automated dashboard test suite + code-quality review). Latest `main` commit: `d3db7bc` (Sept 29).
- Earlier features were added before branch protection existed (REPORTED as live; task buttons v2 is the most recent).

## 5. Active development (open PRs, none merged, nothing deployed)

- **Rules and record:** #5 (`CLAUDE.md`), #6 (project record + this file + progress tracker).
- **Fixes waiting for review:** #7 escape output on search/dashboard pages (R6) · #8 agent status wording · #9 CSV formula guard · #10 unsafe link schemes · #11 US-evening dates · #12 phone table swipe · #13 password prompt double submit · #14 phone PO tap.
- **Tests only:** #15, #16, #19–#24. **Reviews/plans:** #17 security review, #18 modularization plan.
- All 20 branches merged together on a scratch copy, in the recommended order: no conflicts, 404 passed (Oct 4); re-checked Oct 5.
- **Review branches (no PRs):**
  - `claude/ops-readiness`: the operations review and the read-only Queries A/B/C
  - `claude/platform-overnight-implementation`: the 20 PRs plus tested fixes for stale state, double actions, R7, report totals and agent truth, plus modularization steps 1–2. Its full suite: 553 passed, 0 failed
  - `claude/platform-overnight-extension-3`: extension 3 (see §1)
  - `claude/platform-deep-readiness-extension-4`: extension 4 (see §1)
  - `claude/platform-deep-readiness-extension-5`: extension 5 (see §1)
  - `claude/tests-only-ci`: the CI workflow, not active

## 6. Known bugs and risks (top items)

1. Stock can be double-counted or lost on retries or concurrent edits: R1–R4.
   - On `main`: unprotected.
   - On the overnight branch: protected browser-side (no double counting, no lost updates). A connection drop can still leave work half-done, so the all-or-nothing database functions are still needed: drafted, reconciled with Query A and tested locally (2026-10-06); they wait for Query C and the owner's approval to install. **Blocks** automatic Shopify stock sync.
2. Product delete wipes stock first (R5). The overnight branch refuses while stock remains. *Superseded 2026-10-06:* Query A has run and R5 is reconciled with it; extension 3 also refuses sold products and products with quality checks (`docs/ops/PRODUCT_LIFECYCLE_REVIEW.md`). The R5 install still waits for Query C and your approval.
3. Unescaped output on `search.html` / `dashboard.html` (R6): fix in PR #7, plus a broad XSS test on the overnight branch.
4. Supabase library unpinned (R7): pinned with an integrity hash on the overnight branch (not merged).
5. Approval, PO, return, recall, legal-hold, flag and agent-switch actions don't check the current state (main). Fixed on the overnight branch.
6. **New (Oct 5):** report totals undercount past 1,000 rows (N14), fixed on the branch. Refunds recorded on Returns don't reduce revenue (N4): owner/accounting decision.
6. Website risks once built: third-party apps and trackers (performance and privacy), unapproved claims, and placeholder text reaching production (a launch check will search for "PLACEHOLDER").

## 7. Safety boundaries (always)

No merging or deploying by Claude · no production Supabase, SQL, cron, RLS or permission changes · no Shopify production changes, Shopify/Gmail connectors only with task approval · no real customer messages · no secrets anywhere · no money/accounting logic changes in production · no destructive or irreversible actions · Health Endeavors and Real Estate OS stay completely separate · website code never in this repository.

**How to report to the owner (CURRENT, owner instruction, Oct 6, 2026):** the owner prefers detailed evidence in durable repository documents and concise, copy-friendly final chat responses. Put the full session report (evidence, test counts, bugs, decisions, rollback, SHAs, safety) in `docs/ops/`. Keep the final chat message to roughly 600–1,200 words in the owner's fixed structure: branch, SHAs, status, tests, fixes, findings, waiting on owner, weak spots, production / merged / deployed, report path, rollback, next action. Never leave out P0/P1, security, data-integrity, production or owner-decision items, or unresolved failures. Long chat replies are hard to copy, because the browser jumps while text is being selected.

## 8. Pending owner decisions (most important first)

0. **(EXT6) GitHub access for Claude sessions:** connect with the non-admin account, or remove the admin bypass (X6-17). Platform decisions in full: `docs/ops/OWNER_DECISIONS_NEXT.md`.
1. Review and merge order for PRs #5–#24 (the newest extension branch contains them all).
2. R1–R4: run a read-only schema query, then approve the SQL drafts.
3. Approve the website architecture and a separate website repository.
4. Visual direction, approved product copy/claims, and real photography for the website.
5. R5 product-delete behaviour · R7 verification method · approval/PO state checks · palette Enter behaviour · Agent #1 state.

Full website list: `docs/website/decisions-needed.md` (website workspace).

## 9. Next recommended work

1. Owner reviews #5 and #6, then the small fixes #7–#14 one at a time (each is a live deploy).
2. Read-only schema query → R1 (PO receive) SQL draft → owner runs it → dashboard PR; then R2–R4.
3. Approve the website repository and import the prototype; then CI (tests only).
4. Decide the visual direction and gather approved content and photos, so the theme can move from prototype to a real unpublished Shopify theme.
