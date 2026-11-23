# HE-P200 disposition matrix (200 acceptance items) — 2026-11-01

ONE compact matrix (grouped by the 20 workstreams, 10 items each), closing items
by reference to existing committed evidence per the package's own rule. Verdicts:
COVERED (evidence cited) · GAP (acted this session) · BLOCKED (exact prerequisite)
· DEFERRED (owner business decision). Tested tree: `claude/ext20-recovery-2026-10-31`
HEAD `cc7e440` (code frozen at `01d4170` for the integrated + mutation runs; later
commits are docs + the esc selector re-point). Diagnostic Chrome 153, NOT pinned-1194.

| Items | Workstream | Disposition | Evidence / gap |
|---|---|---|---|
| 001–010 | Current suite evidence | COVERED | SALES_RECOVERY_VALIDATION §"Current-revision integrated run": 2452P/24F/370S, real process exit; 24F = 20 visual + 1 timing + 3 fixed; forced-colors/classifier no leak (full run green for those specs); 009 = the 21 known diagnostic failures. |
| 011–020 | Mutation inventory/baseline | COVERED | MUTATION_COVERAGE: 221 applicable (`--check` on frozen tree), denominator table, baseline-healthy via full run + targeted re-runs, resume via progress JSON. |
| 021–030 | 9 mutation timeouts | COVERED | MUTATION_COVERAGE §"9 timeouts": each mapped to awaited state; recheck durations incl. X11-02 27.9s; recorded as MUTATION-INDUCED TIMEOUT (distinct), not CAUGHT, not infra; no threshold lowered. |
| 031–040 | esc selector / security | COVERED | commit 4bc5d65 + MUTATION_COVERAGE §esc: helper-unit baseline passes / mutant fails verified; rendering-XSS kept separate (xss-everywhere + dom-sinks ceiling 0); runner diff = selector+comment only; meta-spec 8/8. |
| 041–050 | Classifier correctness | COVERED | mutation-classify-ext.spec.js 8/8 (launch-fail/timeout/no-test/0-co-pass/ANSI/mixed); classify-run.js limits documented; in CI shard (ci-traps). |
| 051–060 | Prioritization invariants | COVERED (by ref) | 0 survivors among ranking mutants + specs: sales-wavea-correctness, sales-priority/progression/nextaction, sales-wavec-uncertainty, generated-determinism, property-node-ext15. No new gap demonstrated. |
| 061–070 | Concentration/pipeline | COVERED (by ref) | sales-concentration-ext20k, sales-caps*-ext20j, sales-cost; mutation survivors 0. No new gap demonstrated. |
| 071–080 | Progression/aging/dates | COVERED (by ref) | sales-progression-ext20k, local-dates, timezone-contract, malformed-data (injected asOf/clock); mutation survivors 0. |
| 081–090 | Next-action/triage/DNC | COVERED (by ref) | no-live-send (externalSideEffect:false), sales-nextaction/priority-ext20k, sales-outreach/replies-followup (DNC/decline dominance). |
| 091–100 | Approval/audit sequences | COVERED (by ref) | sales-approval-ext20k, double-submit-stale, out-of-order, sales-audit-ext20k; audit tamper-resistance limits already stated (client-local, not production auditing). |
| 101–110 | Retention/territory/creator | COVERED + DEFERRED | sales-wavee-retention/territory/creator-ext20k cover implemented behavior; owner-policy gaps (retention policy, territory ownership) remain DEFERRED (no invented business rule). |
| 111–120 | Core dashboard/orders/receiving | COVERED (by ref) | purchase-orders, po-receive, manual-order-entry, report-totals, missing-totals-ext11, unsaved-changes, double-submit-stale, error-language, empty-database; + inventory-safety SQL mutants 15/15. |
| 121–130 | Imports/exports | COVERED (by ref) | sales-import/export-ext20j, csv-export-guard, helpers-unit (formula defense), xss-everywhere; synthetic fixtures only. |
| 131–140 | DOM-sink/static security | COVERED | security-static-ext18 (ceiling 0; restore-109 regression; bare-RHS + name-concealed backstop), dom-sinks gate, supply-chain-ext18, link-scheme-check; lexical limits documented; no blanket exception. |
| 141–150 | Session/cancel/recovery | COVERED (by ref) | login-session, session-security/expiry specs, storage-safety/adversarial, out-of-order, fault-injection; mocked only, no production. |
| 151–160 | Mobile/high-contrast/a11y | COVERED + BLOCKED | forced-colors-ext20 (7 tests: inputs/palette/buttons/links/Tab-nav/status-text/opt-out); a11y-basics, zoom-400; **BLOCKED**: real WindowsHC/Safari/iPhone/VoiceOver (manual). |
| 161–170 | Visual/performance acceptance | COVERED + BLOCKED/OPEN | VISUAL_INSPECTION_LEDGER (all 20 viewed, 0 defects); **BLOCKED**: pinned-1194 pixels (cdn 403); **OPEN**: 50k-token 8s timing (iphone), unchanged; mitigations stated non-exhaustive. |
| 171–180 | CI/branch/release provenance | COVERED + BLOCKED | PUSH_APPROVAL_PACKET + validation §audit: refs, PR35 MANIFEST root cause (03eda31), downstream CI pending, tests-only workflow; **BLOCKED**: Pages/admin settings unreadable → prerequisite, not assumed deploy-free. |
| 181–190 | Recovery portability | COVERED | v8 README/checksum/patch count/base prereq; patch-route restore tree-match verified; bundle route = `git bundle verify` only (end-to-end blocked by shallow base, labeled); excludes secrets/deps; v9 below. |
| 191–200 | Owner review/finishing | COVERED + DEFERRED | HE_FINAL_ACCEPTANCE_MATRIX handoff (47/46/14, capability classes, walkthrough, manual checklist, approve/decline/defer); business facts DEFERRED; one owner decision = the feature-push packet. |

## Genuine open items (everything not COVERED above)
- **BLOCKED (environment):** pinned-1194 visual pixels (cdn.playwright.dev 403); Pages/admin settings read.
- **OPEN (acceptance):** 50k-token 8s timing bound (reference-env re-measure).
- **BLOCKED (manual hardware):** real WindowsHC/Safari/iPhone/VoiceOver.
- **DEFERRED (owner/business):** prices/MOQ/MSRP, claims, photos, provider/Gmail/publish, retention/territory policy; the feature-push decision.

No P200 item demonstrated a new product defect beyond those already fixed this
session (forced-colors focus, stale write-path manifests, stale esc selector). The
0-survivor mutation result + the full integrated run are the primary evidence that
the engine/invariant classes (051–100) are covered; adding duplicate invariant
tests was not warranted (package rule: reuse proven coverage).
