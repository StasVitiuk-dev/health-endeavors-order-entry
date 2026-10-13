# Unfinished work and workstream classification (EXT10)

> **SUPERSEDED (2026-10-11, EXT11):** the current entry point is `UNFINISHED_WORK_EXT11.md`. This file stays as history and keeps its detail; nothing in it was rewritten.

**Status:** CURRENT (2026-10-11). The EXT10 request listed about 400 workstreams. This page says, for each group, what was **done** in EXT10, what was **checked and found already covered** (by earlier extensions, with the evidence), and what **remains** with its class. No item disappears because code exists: production items stay open until PRODUCTION VERIFIED.

**Classes:** **A** Claude-safe, can be done next · **B** owner decision · **C** read-only production check · **D** owner production action · **E** outside party · **F** deliberately deferred · **DONE** (branch, tested locally) · **COVERED** (earlier extension, evidence named).

## 1. Priority items (U38, U39, U42, U43)

| Item | Result | Evidence |
|---|---|---|
| U38 phone layout | DONE: audit at 320/360/375/390/414/430/768; strategy per table; 7 wide tables are cards below 600 px | `MOBILE_LAYOUT_EXT10.md`, `mobile-cards-ext10` (9 tests), 2 mutants |
| U39 code structure | DONE (slice): change-password without inline script, strict `script-src`; helpers API 9; remaining map | `MODULARIZATION_ROADMAP.md` §6, csp + assets + helpers-unit specs |
| U42 request keys | DONE: all 18 creates + escalation; lifecycle (user, content, 10 min); 10 concurrency cases | `REQUEST_KEYS_EXT10.md`, `request-keys-ext10` (30), 12 mutants |
| U43 Query F on Home | DONE: card with 6 states, freshness, drill-down, 90-night bound; drafts 29/30; scheduling package; 50k-order timing | `NIGHTLY_CHECK_PACKAGE_EXT10.md`, `nightly-check-ext10` (16), 7 mutants, `integrity_home_test.sh` 25/25, `integrity_perf_test.sh` 10/10 |

## 2. Workstream groups

| Group (from the request) | EXT10 outcome | Class of what remains |
|---|---|---|
| Home checks consolidation, freshness, actionability | COVERED (EXT8/9: per-check source, UNKNOWN, "Checked at", stale after 15 min) + DONE (nightly card) | — |
| Backup status Home slot | Home shows "Backups: not verified here" (never green); real status needs the private backups job | B+D (U16) |
| Read-only production check center / result intake | DONE: `PRODUCTION_READONLY_VERIFICATION_EXT10.md` (V1–V12, fingerprints, expiry), `evidence/README.md` | C |
| Query C, D, G local models; RLS fix package per Query G failure | COVERED (EXT7–9 local tests); fix drafts need the real output | C → A |
| R1–R5 switch attack tests (missing, wrong fingerprint, malformed, permission denied, timeout, stale switch, old tab, version mismatch) | COVERED (EXT9 `stock-functions` 18 tests + `hard-walls`); old tab: the switch is read at every press | — |
| R1 end-to-end synthetic; PO fallback audit; PO recovery playbook | COVERED (EXT9 install package 61/61; partial-failure report lists what to finish); operator card §6 | D (install) |
| R2–R4 tests; partial-return packet; adjustment reason quality | COVERED (tests); DONE (packet §1); reason is required text in the operator card (not enforced) | B (D-ops-5) |
| R5 lifecycle / deactivate UX; R6/R7; R8–R10 | COVERED (EXT5–9) / R8–R10 owner or provider | D / E |
| Inventory invariant suite; integrity report | COVERED (Query E/F, invariants.sql) + DONE (nightly card, perf test) | D |
| Lost-update sweep, conflict UX, two-tab helper | COVERED (EXT3–9 `updateIfUnchanged`, stale specs); DONE: two-context request-key helper `tests/helpers/request-keys.js` | — |
| Out-of-order / abort tokens; double-submit sweep | COVERED (EXT8 tokens) + DONE (nightly card token; stuck-button sweep found X10-01) | — |
| Expenses / history completeness; pagination | COVERED (EXT8/9 Show more) | — |
| Search quality, cancellation, provenance; empty states; error taxonomy; retry storms | COVERED (EXT3–8 specs: search-palette, empty-database, error-language, failure-recovery) | — |
| Offline, timeout, session expiry during write, cross-tab logout, cache after logout, sleep, permission loss | COVERED (auth-chaos, session-expiry-midway, session-failures, login-session) | — |
| Audit coverage map, fail-closed, injection/length, correlation IDs | COVERED (AUDITABILITY_REVIEW, xss-everywhere, numeric-contract); correlation IDs = request keys now | C (V2 §10) |
| Incidents, approvals, tasks (status canon, reopen, stuck, assignee race) | COVERED (state-machine, owner-control-center, tasks); DONE: escalation once (I-21) | — |
| Customer questions / CS draft safety / escaping | COVERED (no-live-send, capped-reads, xss) | — |
| Duplicate detection (customers, products, suppliers) — no auto-merge | COVERED (Query F F06–F09, nightly card); no merge built (policy) | B (merge policy, not requested) |
| PO search / lines / precision / transitions; returns completeness / duplicates | COVERED (purchase-orders, numeric-contract, state-transitions) | — |
| Refund boundary; N4 simulator; accounting read-only | COVERED (refund-policy, hard-walls) + DONE (simulator §3 of decision packets) | B+E (N4) |
| Currency warning, negative zero, rounding, date-only | COVERED (accounting-oracle X8-19, money specs, local-dates) + DONE (X10-03: unreadable amount → "—") | — |
| "This week" side by side; DST / midnight | DONE (packet §2); DST covered by timezone-contract | B (X8-D2) |
| Performance 25k–50k; fetch duplication; cancellation; DOM; leaks | COVERED (large-data-ext9, performance-scale, resource-leaks) + DONE (nightly check at 50k orders: 0.3 s) | — |
| Modal lifecycle, toasts, confirmations, destructive language | COVERED (a11y, ui-chrome, safety) | — |
| Recycle bin restore integrity; hard-delete inventory | COVERED (write-path inventory: every delete classified) | — |
| DB constraints / indexes / query plans | COVERED (draft 23) + DONE (indexes on run log; Home reads index-backed) | D |
| RPC permissions, error contract, idempotency | COVERED (EXT9 `callStockFunction` kinds; R-functions idempotent) | C (V4) |
| SQL migration idempotency, prechecks, postchecks, rollback realism, order lock | COVERED + DONE for 29/30 (install → rollback → reinstall, already installed, wrong order, refuses while on) | D |
| Production bundles, one-feature activation, canary, post-deploy checks, rollback triggers, evidence binder | DONE: `PRODUCTION_CHANGE_PACKAGE_EXT10.md` §2–6 | D |
| Feature flag inventory, fail-closed, old tab | COVERED (guarded-toggles, stock-functions) + DONE (nightly switch probe) | — |
| Agents #1–#10 (state, packets, off-state proof, dry-run wall, observability) | COVERED as far as possible (agent-truth, hard-walls); real state needs V2; agent code is outside this repository | C / E |
| D1–D11 implementation pass; alert fatigue | D1 (nightly check) DONE in branch; others design only | B |
| Backup owner check UX; restore drill; DR card | COVERED (V1 §1, restore_drill.sh 6/6, RECOVERY doc) | C / D |
| Staging: watermark, guards, demo, tour | COVERED (EXT8 build + tests); the staging copy now includes EXT10 changes automatically | B (U26) |
| Role UI review; dangerous controls; read-only mode | COVERED (role-matrix); DONE: nightly card hides results from staff | B (U23/U24) |
| Accessibility automation (keyboard, zoom 200/400 %, forced colours, focus, announcements) | COVERED (a11y-basics, a11y-ext8, layout-sweep 320 px @200 %) + DONE (phone cards keep table roles) | D (manual: U34/U35, M-38) |
| Browser storage, logout cleanup, console privacy, redaction, secret negative test | COVERED (storage-safety, login-session, safety secret scan) | — |
| CSP, clickjacking, referrer, external resources, dependencies, Supabase pinning | COVERED (csp, library-pin) + DONE (strict `script-src` on change-password) | A (U46) |
| Escaping centralisation | COVERED (`esc` everywhere; xss-everywhere) | — |
| CSV injection classes, round-trip, large export, filenames; import surface | COVERED (csv-export-guard, helpers-unit; no import surface exists) | — |
| Numeric / string limits, null vs empty, Unicode normalisation | COVERED (numeric-contract, helpers-unit esc bidi) + DONE (fmtMoney unreadable vs missing) | — |
| Business rules validation, two-tab, flag edit conflict, safe defaults, config health | COVERED (admin-pages, guarded-toggles) | — |
| Operator action history, recent changes, deterministic Needs Attention | COVERED (Activity page, Home checks with fixed thresholds) | B (thresholds) |
| Low-stock readiness (no auto-ordering), duplicate watcher, automation health, month-end checklist, daily summary (not sent), operator checklist | COVERED / DONE as read-only views and docs (operator card); **no automatic purchasing, sending or accounting** | B |
| Self-test / deep readiness commands, change impact, sharding, isolation, order dependence, flake tracking, screenshot value, review index | COVERED (tests/README, skip-report, mutation runner) + DONE (X10-11 load-sensitive spec recorded; 12-screenshot review set) | A (X10-11) |
| Draft SQL static review, SECURITY DEFINER, RLS bypass, auth/actor trust, key actor binding | COVERED (sql-drafts-static: no definer functions, policies allow-listed) + DONE (actor binding analysis, X10-06) | F (X10-06) |
| Future Shopify contract (external ID uniqueness, sync off proof, reconciliation, paid-order-never-lost, invoices, shipping dedupe, notification wall) | COVERED as far as the dashboard goes (UNIQUE (channel, external_order_id) exists in the schema; sync off proof; no send path) | F (R9) |
| Retention (recycle bin, audit) | questions only | B |
| Session security, staff permission matrix, owner-only action map | COVERED (PERMISSION_RLS_MAP_EXT9) | C (V5) |
| P0–P11 review; 17 decisions by phase; 10-minute action pack; result intake | DONE (`OWNER_UNBLOCK_CENTER_EXT10.md`, change package) | B / D |
| Evidence validity, frozen SHA linkage, drift checks, pre-merge checklist, post-merge state, phase labels, pause points | DONE (change package §1, §4–6; readonly §1–2) | — |
| Readiness score models | DONE (report §7) | — |
| GitHub least privilege, branch protection checklist | COVERED (V10, X6-17) | D (U03) |
| PR description refresh, changeset size, commits | DONE (new draft PR; logical commits) | — |
| Dead code, TODO review, known bug reconciliation | DONE: no new TODO; stray `isLatest` removed (X10-02); backlog reconciled (X10-01…11) | — |
| Doc link and command checks; version headers | DONE for EXT10 docs (every EXT10 doc has a Status line and date) | — |
| Quick references (operator, incident, data conflict, manual stock, PO receive, returns) | DONE (`OPERATOR_QUICK_REFERENCE_EXT10.md`) | — |
| Privacy, screenshot redaction, synthetic identifiability | COVERED + DONE (EXT10 screenshots use SYNTHETIC names, `@example.test`) | — |
| Test database cleanup, namespacing, interrupted recovery | COVERED (each local test makes its own throwaway copy and drops it) + DONE (29/30 and perf tests follow the same rule) | — |
| Mobile regression suite | DONE (`mobile-cards-ext10`) | D (M-38) |
| State ownership, URL/filter/modal state, unsaved changes, validation map, malformed records, unknown status | COVERED (nav-history, unsaved-changes, mock-realism, state-machine) | — |
| 403/404/409 UX, network/stale indicators, visibility refresh, realtime/polling | COVERED (session-failures, error-language, attention freshness) | — |
| Generated HTML safety, rel noopener, inline handlers, URL injection, PII in query strings, export permission | COVERED (xss-everywhere, link-scheme-check) + DONE (change-password has no inline handlers) | A (U46 other pages) |
| Bulk actions; print privacy | not built (no request to build bulk actions; "don't invent") | F |
| Copy review, UNKNOWN vs zero, blank vs N/A, terminology | COVERED + DONE (X10-03) | — |
| Regressions to recheck (cancelled vs refunded … unescaped output) | re-run by the full suite on the frozen commit (accounting-oracle, tax-oracle, local-dates, csv, library-pin, nav-history, phone-po-tap, xss-everywhere …) | — |
| Rollback testing (install → rollback → reinstall, partial failure, wrong order, already installed) | COVERED for drafts 10–28 + DONE for 29/30 | — |
| Staff / owner training notes; change approval and AI action boundaries | DONE (operator card §8) + COVERED (hard-walls) | — |

## 3. Remaining Claude-safe items (class A)

| ID | What | Why not now |
|---|---|---|
| U46 | strict script policy on search, dashboard, manual order and owner pages | large moves; do right after the merge to avoid conflicts |
| U47 / X10-05 | request key on manual orders | same; manual order page has its own duplicate match today |
| X10-11 | make the load-sensitive report-totals waits robust | test-only; passes serially and in the frozen full run |

## 4. Manual device item added

**M-38** (add to `MANUAL_DEVICE_CHECKLIST_EXT9.md` section A): on a real iPhone with VoiceOver, open Orders and Tasks: each card reads "Customer, SYNTHETIC…" once (not "Customer Customer"). If doubled, Claude switches the label to an `aria-hidden` element.

## 5. Second EXT10 mission (operations scale, reliability, usability): classification

| Group (missions) | Outcome |
|---|---|
| Daily journey, Needs Attention, priority explanation, Home summary (1–4, 57–60) | DONE: Home checks are the attention view (WHAT / WHY / AGE / SEVERITY / PAGE / **NEXT STEP**); journey findings fixed (`OPERATIONS_CENTER_EXT10.md` §6). A second "attention" page was not built (would duplicate) |
| Daily checklist, summary generator (5, 6, 230–232) | DONE as routines (operations center §2–4). Daily Summary page already exists (no revenue invention); no e-mail |
| Automation / agent health, UNKNOWN first-class (7–10, 252–256) | DONE: AI Agents page states + "Off — on purpose"; schedule unreadable = Unknown (X10-14); Home failed/stale and unknown rows. No start/stop added beyond the existing switches |
| Agent failure inbox (9) | DESIGN (maps §10 issue keys); needs agent source to wire (AGENT SOURCE) |
| Reconciliation center / queue / dedupe / resolution (11–14) | COVERED read-only by Query E/F + Home checks + nightly card; a separate centre with ACKNOWLEDGED/RESOLVED states needs a new table (PRODUCTION WRITE/DEPLOY, owner approval) — design in maps §8/§10 |
| Inventory exceptions, low stock, reorder view, history, provenance (15–20) | DONE: negative stock, received-not-stocked, low stock, level not set (CONFIG REQUIRED), deactivated with stock; history and provenance exist (adjustments: who/when/why/lot); no auto-ordering |
| PO centre, exceptions, receipt recovery, request lookup, receipts (21–25, 70, 336–338) | DONE: receipt-unknown lock + read-only check (X10-13), honest received line (X10-12); request keys = operation receipts (maps §7) |
| Returns centre, separation, partial preview (26–28) | DONE in docs (maps §6, decision packet §1); no policy implemented |
| Customer questions, drafts, timelines (29–35) | COVERED: questions queue (waiting first, older reachable, EXT8); no send path. Timelines: NOT BUILT (data relations exist only partly; would mostly show nothing reliable) — DEFERRED |
| Deep links, cross-entity nav, back, URL safety (36–39) | COVERED (EXT8 page deep links, Back); entity-level links DEFERRED (records have no stable record view) |
| Filters, saved filters, counts (40–44) | COVERED (EXT8 tokens + Show more); saved filters NOT BUILT (no clear need; shared-computer privacy) |
| Record finder, quick command, favourites, recently viewed (45–48) | COVERED (search palette, pins); recently viewed NOT BUILT (privacy on shared computers) |
| Tasks, approvals, incidents queues (49–56) | COVERED (EXT7/8): open never hidden behind closed, recently done, reopen; no bulk actions exist (none invented) |
| System status, environment badge, version, diagnostics, error IDs (63–69) | DONE: System status + diagnostic summary (X10-17); staging banner (EXT8); error reference = request key where present |
| Network recovery, safe retry (71–72) | COVERED (offline bar, visibility refresh of reads; writes never repeated automatically) |
| Rule / flag history, switch UI, dependencies, fallback, deprecation (73–83) | DONE: ON/OFF + "Needs first" per high-risk switch; Query H detects impossible combinations; legacy fallback reviewed (switch OFF = today's path, documented as not atomic; removal after production verification — DEFERRED, PRODUCTION) |
| SQL rollout simulation, wrong steps, prod/staging guard, write warnings (84–89) | DONE (change package §2b–2f; static header test; System status environment) |
| Query interpreter, redaction, versioning (90–92) | DONE (`interpret-query-results.js`, 9 tests) |
| Backup workflow, expiry, restore states, DR (93–96) | COVERED + DONE in docs (V1 expiry 7 days; local drill ≠ real restore) |
| Schema doc, write/read/side-effect maps, transaction boundaries, eventual consistency, repair philosophy (97–104) | DONE (`OPERATIONS_MAPS_EXT10.md` §1–5) |
| Data quality centre, watchers, orphans, invalid statuses, fixtures (105–114) | COVERED read-only (Query F, Home, DB constraints) + DONE maps §8; duplicate customers BLOCKED (owner key), duplicate invoices BLOCKED (agent source) |
| Scale 10×, 100 products, suppliers, years of history, budget, pagination, counts (115–125) | DONE: X10-15 fixed; scale-ext10b; budget in maps §12; server pagination DEFERRED |
| Operator speed, keyboard, focus, announcements, mobile/tablet journeys, accessibility (126–144) | COVERED by existing a11y/mobile suites + full suite at 390 px; real VoiceOver NOT VERIFIED |
| Business rules / flags UX, settings organisation, config export/diff (145–153) | COVERED (units in rule labels, EXT4); config export NOT BUILT (System status covers the safe part) |
| State machines and server guards (154–162) | COVERED (`STATE_MACHINES.md`, generated and tested; DB CHECKs; conditional updates) |
| Expenses, tax, accounting provenance, exports, CSV (163–175) | COVERED (EXT6–9 oracles, csv guard); X10-03 unreadable amount |
| Security headers, frames, referrer, CSP reporting, dependencies (176–184) | COVERED (EXT8/9) + change-password strict policy |
| Malformed data, escaping, URL/phone/email links, notes, clipboard, print, titles, shared computers (185–196) | COVERED (xss-everywhere, link-scheme-check, storage-safety); diagnostic copy shows its text before copying |
| Multi-user, permission harness, roles, onboarding/offboarding, access review (197–204) | COVERED (role-matrix, concurrency specs); onboarding/offboarding notes below |
| GitHub / CI safety (205–210) | VERIFIED: `.github/` has only CODEOWNERS; no workflow files; no auto-merge possible from this repository's config; CI draft inactive |
| Suites, evidence, checksums, drift (211–221) | DONE: high-risk set (report), Query H, SQL fingerprints in V-table |
| Runbooks (221–229) | DONE (operations center §7) |
| Growth readiness, do-not-build, future extension points (233–241) | DONE (maps §12; multi-location not supported by schema; no ERP features built) |
| Shopify intake contract (242–251) | DONE as contract (maps §11); no website work |
| Source labels, provenance, human override (257–261) | PARTLY: tasks/incidents have no source column today — adding one is a schema change (PRODUCTION WRITE/DEPLOY); maps §10 rule 9 |
| Owner decision centre, N4, lawyer, provider, agent source (262–272) | DONE (decision packets §6) |
| PR relationship, review package (273–284) | DONE in the PR body |
| Visual consistency, components, CSS, z-index, modals (285–309) | COVERED by existing suites; no redesign (design neutral) |
| Copy, help text, UNKNOWN explanations (310–312) | DONE (status vocabulary, operations center §5) |
| DB health, latency, fetch reduction, caching, refresh (313–330) | COVERED (latest-request tokens, one Home load, 5-min visible refresh); System status read |
| Telemetry, audit vs error log (331–335) | DONE as contract (maps §9) |
| Automation principles, schedules, issue keys, dry run (357–381) | DONE as rules (maps §10); nothing activated |

### Remaining by category (requested labels)

| Category | Items |
|---|---|
| CLAUDE SAFE | U46 strict policy on 5 pages; U47 manual-order key; X10-11 load-sensitive test waits; entity deep links / timelines when a record view exists |
| OWNER DECISION | decision centre §6 (17 rows); duplicate-customer key (U50) |
| PRODUCTION READ | V1–V13 |
| PRODUCTION WRITE / DEPLOY | P0–P11; reconciliation-centre table; task/incident source column; legacy path removal after R1–R5 verified |
| ACCOUNTANT | N4, orders without items |
| LAWYER | legal hold vs delete (if unsure), claims queue D8 |
| PROVIDER | e-mail service (R10) |
| AGENT SOURCE | agent failure tests, failure inbox wiring, duplicate invoice watcher, Agent #1 behaviour |
| DEFERRED | server pagination, saved filters, recently viewed, customer/order/PO/product timelines, config export |

### Staff onboarding / offboarding / access review (missions 201–203)

Onboarding: create the account in Supabase Auth (owner), set `profiles.role`, give `OPERATOR_QUICK_REFERENCE_EXT10.md`, walk the 5-minute morning check together. Offboarding: set the profile inactive, revoke sessions (Sessions page), remove the Auth user, review Query G for leftover grants. Quarterly access review: Supabase → Authentication users vs `profiles` roles; GitHub collaborators (V10). Claude makes no account changes.
