# Health Endeavors — current state (cross-project summary)

**Last updated:** October 5, 2026 (platform sections §5, §6 and §8; website sections unchanged from Sept 30). **Keep this short.** Details live in the linked documents; update this file whenever the verified state changes materially.

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
  - `claude/tests-only-ci`: the CI workflow, not active

## 6. Known bugs and risks (top items)

1. Stock can be double-counted or lost on retries or concurrent edits: R1–R4.
   - On `main`: unprotected.
   - On the overnight branch: protected browser-side (no double counting, no lost updates). A connection drop can still leave work half-done, so the all-or-nothing database functions are still needed: BLOCKED ON QUERY A/B. **Blocks** automatic Shopify stock sync.
2. Product delete wipes stock first (R5). The overnight branch refuses while stock remains; the full fix needs Query A.
3. Unescaped output on `search.html` / `dashboard.html` (R6): fix in PR #7, plus a broad XSS test on the overnight branch.
4. Supabase library unpinned (R7): pinned with an integrity hash on the overnight branch (not merged).
5. Approval, PO, return, recall, legal-hold, flag and agent-switch actions don't check the current state (main). Fixed on the overnight branch.
6. **New (Oct 5):** report totals undercount past 1,000 rows (N14), fixed on the branch. Refunds recorded on Returns don't reduce revenue (N4): owner/accounting decision.
6. Website risks once built: third-party apps and trackers (performance and privacy), unapproved claims, and placeholder text reaching production (a launch check will search for "PLACEHOLDER").

## 7. Safety boundaries (always)

No merging or deploying by Claude · no production Supabase, SQL, cron, RLS or permission changes · no Shopify production changes, Shopify/Gmail connectors only with task approval · no real customer messages · no secrets anywhere · no money/accounting logic changes in production · no destructive or irreversible actions · Health Endeavors and Real Estate OS stay completely separate · website code never in this repository.

## 8. Pending owner decisions (most important first)

1. Review and merge order for PRs #5–#24.
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
