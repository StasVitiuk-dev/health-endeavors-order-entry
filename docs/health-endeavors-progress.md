# Health Endeavors — progress tracker

**Last updated:** September 30, 2026. Update whenever meaningful work is completed or scope changes.

**How to read the percentages:** they are **planning estimates, not measurements**. "Done" means merged to `main` and, where it matters, confirmed live. Work in open PRs, prototypes or documents counts only as preparation and is weighted low. Each row states its basis.

Statuses: **COMPLETED** · **IN PROGRESS** · **BLOCKED** · **NOT STARTED** · **OWNER DECISION REQUIRED**.

## Overall

**Health Endeavors overall: ≈ 38% toward a launched, operating business (uncertainty ±10 points).**

Basis: weighted average of the areas that must all exist at launch.

| Area | Weight | Estimate | Weighted |
| --- | --- | --- | --- |
| Internal platform features (row 1) | 40% | 70% | 28 |
| Launch-required fixes R1–R10 (row 2) | 15% | 5% | ≈1 |
| Store launch readiness (row 7) | 10% | 10% | 1 |
| Public website (row 8) | 25% | 31% | ≈7.75 |
| Website–platform integration (row 9) | 10% | 5% | 0.5 |
| **Total** | | | **≈ 38%** |

The weights are a judgement call: the platform is the largest body of work, and the website is the second largest.

## Work areas

| # | Area | Status | ≈ % | Done | Remaining | Blockers | Next step | Updated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Internal platform features** | IN PROGRESS | 70% | Most operations pages live (REPORTED): orders, inventory + lots, POs, returns, recalls, QC, adverse events, legal holds, inquiries, accounting, tax, tasks, calendar, activity, security pages; agents #4/#5/#6. Original 69-item spec: 46 done, 15 partly, 8 open (Claude's tally, ≈77% counting partly as half). | Partly-done spec items; Blueprint items (51/90 ≈ 57% per owner's Sept 26 recount); owner-run checks | Launch fixes (row 2) | Merge the small fixes (row 3) | Sept 29 |
| 2 | **Launch-required fixes R1–R10** | BLOCKED | 5% | 0 of 10 on `main`. R6 fix ready (PR #7); R1–R5 reproduced in tests with fix plans (PR #16) | R1–R5 database functions; R7 pin + verify library; R8 real products; R9 re-enable sync; R10 email re-check | R1–R4 need a read-only schema query + SQL the owner runs; R7 needs a safe verification method; R8–R10 owner | Owner runs the read-only schema query | Sept 29 |
| 3 | **Small fixes and safety PRs** (#7–#14) | OWNER DECISION REQUIRED (review) | 40% | 8 fixes built, each with tests that fail on the old code; all merged together cleanly on a scratch copy | Owner review, merge one at a time, check live | Review time | Owner reviews #7 | Sept 29 |
| 4 | **Automated testing (dashboard)** | IN PROGRESS | 50% | `main`: 65 tests (PR #4). Open PRs add about 340 more (#15, #16, #19–#24); combined run 405 passed | Merge test PRs; tests for the remaining pages; CI | Review time | Owner reviews #15 | Sept 29 |
| 5 | **Task buttons v2 post-deploy checks** | OWNER DECISION REQUIRED (owner-run) | 44% | 4 of 9 checks (REPORTED) | Refresh persistence, audit_log row, Cancel test, iPhone, second account | Owner time | Owner runs the checks | Sept 29 |
| 6 | **Agents / automation** | BLOCKED | 55% | #4, #5, #6 live in Supabase with pause switches (REPORTED) | #2/#3/#7/#8 off until products; #1 state unverified; #8 migration | Products (row 7) | Owner checks Agent #1's switch (read-only) | Sept 29 |
| 7 | **Store launch readiness** (Shopify products, SKUs, sync) | NOT STARTED | 10% | Fake-order end-to-end tests passed (REPORTED) | Real products with exact SKUs (R8), sync design decision (D-4), re-enable workflows (R9) | Owner; R1–R4 before automatic stock sync | Decide the sync design | Sept 29 |
| 8 | **Public website** | IN PROGRESS | 31% | Local Shopify-theme prototype with working, tested code: homepage (all sections), product page (gallery, 360° photo viewer, buy box, related products), cart, search, forms + server-side intake prototype, cinematic hero structure, degraded states, policy structure, SEO, stricter launch gate, photographer ingest pipeline. Code ≈66% · visual implementation ≈35% (provisional look, not approved branding) · staging readiness ≈26% · launch readiness ≈5%. Shopify mode (cart, checkout hand-off, search, recommendations, newsletter, truthful forms, theme-editor reloads) is implemented and tested against faked Shopify endpoints only. Per-area table: website workspace `handoff/WEBSITE_CURRENT_STATE.md` | Repository; Shopify dev theme; final design; approved copy/claims; INCI; photography + 360° frames; prices; legal text; deployed intake; integration | Owner decisions D-0, D-2, D-22, D-23; manufacturer INCI; photographer | Owner approves a private repo + unpublished Shopify dev theme preview | Sept 30 |
| 9 | **Website ↔ platform integration** | NOT STARTED | 5% | Event contracts designed (PROPOSED); local **simulator only** (webhook inbox, processor, reconciliation, inventory publishing; soak-tested with fault injection). Not connected to anything real, so it counts as preparation | Intake endpoint, order inbox, reconciliation, stock sync, platform queues | R1–R4; owner decisions D-3, D-4, D-6 | Approve the design | Sept 30 |
| 10 | **Security hardening** | IN PROGRESS | 40% | Frontend security review (PR #17); fixes for S1/S3/S4 in PRs #7/#10/#9; access verification (PR #1) | Merge fixes; R7; orphan uploads (S10); approval/PO state checks | Review; R7 method | Owner reviews #17 | Sept 29 |
| 11 | **Code structure (owner-login.html modularization)** | NOT STARTED | 5% | Plan + dependency map (PR #18) | About 15 PRs | Deliberately after R1–R4 | — | Sept 29 |
| 12 | **Documentation** | IN PROGRESS | 85% | `CLAUDE.md` rules (PR #5), project record, current-state summary, this tracker (PR #6), website docs folder, whole-business handoff package (`handoff/`, preserved with the website ZIP/bundle) | Merge PRs #5/#6; keep current; owner-facing runbooks | Review | Owner reviews #5 and #6 | Sept 30 |

## Change log for this tracker

- **Sept 29, 2026:** created. Website area added at 15% (prototype and documents only). Workstream C (visual concepts) removed from website scope by owner instruction.
- **Sept 30, 2026:** Website and integration percentages unchanged (15% and 5%) because the new work is prototype and simulator only. Documentation raised to 75% for the whole-business handoff package. Owner brand directions recorded as open decisions, not final: visual direction references, whale secondary mark (D-38), legacy Sea Foam bottle as real packaging, INCI list required from the manufacturer.
- **Sept 30, 2026 (website build phase):** Public website 15% → 25% for working, tested storefront code (360° viewer, cinematic hero structure, complete homepage, search, degraded states, policy structure, SEO, stricter gate, ingest pipeline, end-to-end synthetic journey). Overall 35% → 37%. Documentation 75% → 80% (prioritised owner decision register, launch-content checklist, review path). Platform, R1–R10, agents, testing, security, store readiness and integration unchanged (no dashboard code changed; the integration is still simulation only).
- **Sept 30, 2026 (storefront implementation phase):** Public website 25% → 30% (website code 55% → 64%; the new visual-implementation metric is ≈35%; staging 20% → 25%; launch unchanged at 5%). Overall 37% → 38%. Documentation 80% → 85% (transfer index, request register, Shopify setup guide). No dashboard code changed; the integration is still simulation only.
- **Sept 30, 2026 (focused fix phase, package v4):** Public website 30% → 31% (code 64% → 66%, staging 25% → 26%). Fixed: cart line removed when Shopify gives no maximum; cart currency; `?variant=` links; no-JS variant submission; products without media; metafields read via `.value`. Overall stays ≈38%.
