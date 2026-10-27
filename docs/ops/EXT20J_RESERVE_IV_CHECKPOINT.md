# EXT20J Reserve IV — classification + durable checkpoint

Status: **CURRENT** (2026-10-18). Local feature-branch engineering only. No production, no merge, no deploy. This file classifies the Reserve IV program queue (Programs 1–248) against the evidence already in this repository, records the durable checkpoint, and names the genuinely-new safe-local work. It does not choose any owner decision and does not run or prepare any production action.

## Durable checkpoint

| Field | Value |
|---|---|
| Repository | `StasVitiuk-dev/health-endeavors-order-entry` (public) |
| Branch | `claude/platform-ext20-adversarial-completion-2026-10-13` |
| HEAD | `6d0480b` (origin in sync) |
| main | `d3db7bc` — **not touched, not merged** |
| Tree | clean |
| Commits this session | 10 (the Trusted Types screen cascade + its doc + two test-guard updates) |
| Trusted Types dynamic sinks (dashboard) | **0** — DOM sink gate: 0 reviewed interpolations, 0 dangerous; `dom-sinks-reviewed.json` allowlist empty |
| Node gates | DOM sink / static-security / regex / styles / status / docs / schema-contract: PASS |
| Broad suite | run sharded as the one final broad suite (Program 237): shard 1/4 610 passed (2 stale expectations fixed), shard 2/4 593 passed/0 failed; shards 3–4 running |

### Session commit list (95ccdd3 → 6d0480b)
`c981cde` Home business-health tiles · `44e2aef` activity feed + change-detail · `bce094f` activity people strip · `e5db8c8` record inspector · `115f6cf` order-lookup · `5a03889` Guide body · `6034216` command palette · `621c767` calendar · `493f7b6` TT inventory doc · `6d0480b` two test-guard updates.

## Production / security status — unchanged by this branch (record only, do not flip)

FIX 1A/1B/2 live · Query G/G2/G3 completed · Query D reviewed · **Query D2 NOT RUN** · FIX 3 NOT APPLIED · F1 NOT APPLIED · R1–R5 NOT APPLIED · approval separation OWNER_DECISION · aunt role OWNER_DECISION · merge NOT APPROVED · deploy NOT APPROVED. This branch changed none of these; it is client-render (Trusted Types) engineering only.

## How the queue was classified

Every program was placed in one bucket. The large majority are **ALREADY_PROVEN** — the tooling, tests and docs the program describes already exist in this repo from EXT3–EXT20, so per the queue rule they are cited and skipped, not rebuilt for a count. Representative evidence is named per group below; the file inventory under `tests/tools/`, `tests/specs/` (141 specs) and `docs/ops/` (~180 docs) is the backing index.

### DO_NOW (genuinely new after tonight's cascade)
- **P1 Trusted Types endgame** — DONE this session: every dynamic screen converted, 0 dynamic sinks. Evidence: `docs/ops/INVENTORY_TRUSTED_TYPES_HARDENING.md` (completion section), the 10 commits above.
- **P2 TT enforcement simulation** — the report-only ratchet exists (`tests/specs/trusted-types-ext20.spec.js`, CEILING 56). Tonight's cascade should drop the measured violation count; the one remaining new action is to **re-measure and lower the ceiling** to lock in the gain. Pending (needs the browser suite free).
- **P4 sink ratchet** — the gate already fails any new/unreviewed dynamic sink and flags stale allowlist entries (`tests/tools/dom-sinks.js --gate`, meta-tested in `security-static-ext18.spec.js`); the allowlist is now empty, so the ratchet floor is 0. Verified this session.

### ALREADY_PROVEN (cite current evidence, move on)
- **P3 sink manifest** — `tests/tools/dom-sinks.js` + `dom-sinks-reviewed.json` keyed by file+whitespace-collapsed expression (resilient to line shifts); gate meta-tested.
- **P5 DOM builder fuzz / P109 audit display / P97 compliance fuzz** — `tests/specs/trusted-types-ext20.spec.js` (2,000 hostile toast messages), `security-static-ext18.spec.js`, `he-ui.js` `h()` which refuses `on*`/`srcdoc` and text-ifies all children.
- **P6 DOM clobbering / P7–P9 safe link/URL** — `isSafeLink()` in `he-ui.js` (unsafe link → muted text), frontend-security-review.md, `DOM_CSP_SECURITY_EXT18.md`.
- **P10–P14 capability/authorization + aunt/owner-lockout/approval models** — `AUTHORIZATION_CONTRACT_EXT18.md`, `EXT20B_AUTHORIZATION_MODEL.md`, `ROLE_PERMISSION_MATRIX.md`, `PLATFORM_MATRICES_EXT13.md`; role tests in `role-matrix`/`authorization` specs.
- **P15–P22 approval + auth state machines, A→B isolation, multi-tab, storage** — `STATE_MACHINES.md`/`_EXT19.md`, `AUTH_SESSION_SECURITY_EXT18.md`, `session-failures.spec.js`, `login-session.spec.js`.
- **P23–P38 mutation result / retry / request keys / inventory model / concurrency / lock order / DB taxonomy** — `IDEMPOTENCY_AND_RETRY_POLICY.md`, `REQUEST_KEYS_EXT10.md`, `CONCURRENCY_MATRIX.md`, `DATABASE_CONCURRENCY_EXT19/20.md`, `failure-recovery.spec.js`, `out-of-order.spec.js`, the local-PG DB suite.
- **P39–P47, P56 profile triggers / audit / RLS analyzer / SECURITY DEFINER / privilege diff / drift** — `tests/tools/rls-analyzer.js`, `schema-drift.js`, `QUERY_D_*`, `PERMISSION_RLS_MAP_EXT9.md`, `DATABASE_SECURITY_EXT18.md`, `auditability-review`.
- **P48–P54 Query D2 interpreter / SQL classifier / result validator / secret / PII / project-id defense** — `tests/tools/query-d2-interpret.js`, `interpret-query-results.js`, `secret-scan.js`, `sql-lint.js`.
- **P55–P64 posture / evidence state machine / script hashing / production ledger** — `tests/tools/evidence.js`, `deploy-sim.js`, `PRODUCTION_CHANGE_LOG.md`, `PRODUCTION_CHANGE_PACKAGE_EXT9/10.md`.
- **P65–P82 owner tracker / readiness engine / diff risk / test manifest / mutation registry / false-green / CI validation** — `READINESS_GATE.md`, `PRODUCTION_READINESS_MATRIX.md`, `MUTATION_TESTING_REPORT.md`, `tests/tools/ci-impact.js`, `ci-shards.js`, `skip-report.js`, `status-validate.js`, `ci-traps-ext15.spec.js`.
- **P83–P108 Home truth / search auth+scale+race / CSV / documents / agents** — `owner-control-center.spec.js`, `missing-totals-ext11.spec.js`, `search-palette.spec.js`, `csv-export-guard.spec.js`, `agent-truth/registry/safety` specs, `AUTOMATION_AND_AGENT_ARCHITECTURE.md`.
- **P109–P137 privacy / storage / logging / responsive / zoom / modal / a11y / resource ownership / offline** — `storage-safety-audit.md`, `PERFORMANCE_AND_RESOURCES.md`, `device-matrix.spec.js`, `a11y-ext8.spec.js`, `layout-sweep-ext9.spec.js`, `ui-chrome.spec.js`.
- **P138–P149 synthetic scale + performance baselines** — `performance-scale.spec.js`, `scale-ext10b/matrix/urls.spec.js`, `TEST_PERFORMANCE_EXT15/16.md`.
- **P150–P160 module decomposition / globals / lifecycle / formatters** — `MODULARIZATION_ROADMAP.md`, `APPLICATION_MODULE_MAP_EXT15.md`, `app-modules.js`/`app-graph.js`, 19 extracted modules.
- **P161–P174 supply chain / secret self-test / build content / environment / release manifest** — `SUPPLY_CHAIN_SECURITY_EXT18.md`, `supply-chain-ext18.spec.js`, `secret-scan.js`, `STATUS_MANIFEST_EXT14.json`.
- **P175–P180 doc authority / contradiction scanner / current-state / owner start / decision register** — `doc-check.js`, `SOURCE_OF_TRUTH_MAP_EXT13.md`, `OWNER_DECISIONS_NEXT.md`, `START_HERE_EXT*.md`.
- **P202–P213 fresh bug hunts** — standing practice each EXT round; this session's bug hunt surfaced the calendar-colour CSS defect (recorded for owner) and 2 stale test expectations (fixed).
- **P214–P246 changed-code mutation + final waves + commit/push discipline** — mutation registry + the gates run per commit this session; many-small-commits + feature-branch-push discipline followed (10 commits, pushed).

### OWNER_DECISION (model/cards exist; do not choose)
P12 aunt role, P13 final-owner lockout, P14 approval separation, P179 decision register — supporting models in `EXT20B_AUTHORIZATION_MODEL.md`, `OWNER_DECISIONS_NEXT.md`, `N4_DECISION_ONE_PAGE.md`.

### PRODUCTION_REQUIRED (tooling ready; do not run)
P48 Query D2 (interpreter ready, **not run**), P181 D2 card, P182–P190 FIX3/F1/R1–R5 packages (`R1-R5-INSTALL-RUNBOOK.md`, `QUERY_D_*`), P191 G04 plan (`G04_VISITOR_RIGHTS_REVIEW.md`), P192 Queries C–H matrix (`QUERY_C/E_OWNER_RUN_GUIDE.md`). All owner-run; this branch only keeps the read-only tooling and cards current.

### REAL_DEVICE_REQUIRED (test contracts exist; cannot complete locally)
P194 aunt account, P195 phone, P196 Safari, P197 Firefox, P198 VoiceOver/NVDA/TalkBack — `MANUAL_DEVICE_CHECKLIST_EXT9.md`.

### MERGE / DEPLOY (owner only)
P199–P201 PR package / branch-vs-main diff / commit history — `OWNER-REVIEW-PACKAGE.md`, `pr-merge-order.md`. P181/199+ merge and deploy: NOT APPROVED.

## Genuine safe-local work remaining after this
Only the TT enforcement ceiling re-measure (P2) is a new, non-duplicative safe-local action; everything else is already proven, owner-gated, production-gated, or real-device-gated. The queue is therefore near safe-local exhaustion: once the broad suite confirms green and the ceiling is lowered, the honest next real step is an owner read-only or owner-decision action, not more local engineering.
