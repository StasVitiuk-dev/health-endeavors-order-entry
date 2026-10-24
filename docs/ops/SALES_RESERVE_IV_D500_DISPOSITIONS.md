# Reserve IV — D500 candidate reconciliation (dispositions)

Status: CURRENT · Branch `claude/platform-ext20-adversarial-completion-2026-10-13`,
not merged, nothing deployed, `main` untouched · As of 2026-10-24 · For: Stas

Reconciles the externally-supplied 500-candidate package
(`DASHBOARD_CLAUDE_RESERVE_IV_500_DETAILED_TASKS.md`, sha256
`a43f6e54…d4e2a058`, 25 workstreams × 20, verified: IDs HE-D500-001…500 present,
sequential, unique) against the **actual** repository. The package is a set of
hypotheses, not confirmed gaps. Dispositions below are established from repo
evidence, per the package's own control instructions.

Disposition codes: ALREADY_COVERED · DISTINCT_GAP_CONFIRMED · INVESTIGATION_NEEDED ·
OWNER_OR_EXTERNAL_BLOCKED · NOT_JUSTIFIED · CORPUS_INCOMPLETE.

## Method & scope limitation
- Workstreams 01–02 (the current Wave D) are dispositioned **per candidate**
  from direct inspection of the five decision pages, their adapters, and the
  engines/UI.
- Workstreams 03–25 are triaged at **workstream level** here (dominant
  disposition + rationale), to be taken to per-candidate detail when their wave
  is executed. They are not certified complete or novel by this document.
- Key architectural facts that drive many dispositions (all verified this
  session):
  - The 5 decision pages render **once** at startup; `showPage()` only toggles
    the `activePage` class (no per-navigation re-render).
  - The sales UI/engines/adapters attach **no** event handlers, timers, or
    observers (grep-verified in `he-sales-ui.js` and the five engines).
  - Decision pages present fixed, small synthetic sets via static
    `salesSection`/`salesKv` view-models — **no** interactive sort, filter, or
    pagination controls.
  - Engines are pure and deterministic (Wave A), time is injected (no wall
    clock), and nothing has an external side effect.

## Workstream 01 — engine/render/navigation cost (Wave D)
| ID | Disposition | Rationale / evidence |
|----|-------------|----------------------|
| HE-D500-001 | ALREADY_COVERED | `sales-decision-perf-ext20k` D2 separates in-page engine compute from the rendered page; `sales-scale-ext20k` D1 documents pure-engine scope. |
| HE-D500-002 | ALREADY_COVERED | Fixture built once outside the timed block; navigation is show/hide, measured apart from data prep. |
| HE-D500-003 | NOT_JUSTIFIED | No progressive/paged render on decision pages; the section renders in one pass. |
| HE-D500-004 | NOT_JUSTIFIED | Decision pages have no filter controls to measure. |
| HE-D500-005 | NOT_JUSTIFIED | No sort controls; explanations are produced by the engine, not re-sorted in the UI. |
| HE-D500-006 | INVESTIGATION_NEEDED | Empty-input path exists in engines (Wave A); a dedicated empty-state *timing* case is low value given render-once. Deferred. |
| HE-D500-007 | ALREADY_COVERED | D5/D7 shows revisits are pure show/hide (no warm/cold render difference). |
| HE-D500-008 | INVESTIGATION_NEEDED | Long-string rendering is exercised by the a11y matrix at 320px/200%; a separate text-vs-numeric timing split is low value. Deferred. |
| HE-D500-009 | NOT_JUSTIFIED | Decision pages do not truncate (small fixed sets); analyzed=rendered. Large-list disclosure already handled on EXT list pages. |
| HE-D500-010 | ALREADY_COVERED | Dataset build is isolated outside every timed block in both perf and scale specs (documented). |
| HE-D500-011 | **DISTINCT_GAP_CONFIRMED → IMPLEMENTED** | Perf spec now repeats each measurement 5× and reports median+min+max; asserts only the median; near-resolution values reported as a range, never a precise speedup. |
| HE-D500-012 | ALREADY_COVERED | `sales-scale-ext20k` pairs each timing with correctness invariants; Wave A A10 adds an independent reference. |
| HE-D500-013 | ALREADY_COVERED | D1 doc + perf split map each budget to engine vs browser work explicitly. |
| HE-D500-014 | NOT_JUSTIFIED | Engines handle malformed input gracefully (Wave A) rather than rejecting before render; no separate reject timing to measure. |
| HE-D500-015 | NOT_JUSTIFIED | No incremental filter on decision pages. |
| HE-D500-016 | NOT_JUSTIFIED | Synthetic compute is sub-11ms median; no long task blocking the main thread. |
| HE-D500-017 | ALREADY_COVERED | Perf numbers recorded with project + environment caveats in the spec output and report. |
| HE-D500-018 | ALREADY_COVERED | 011 median/range implementation surfaces outliers (min/max) rather than hiding them. |
| HE-D500-019 | ALREADY_COVERED | Playwright isolates each test; no shared measurement teardown needed. |
| HE-D500-020 | ALREADY_COVERED | Report + SALES_INVENTORY reference both scale and perf specs. |

## Workstream 02 — repeated navigation & resource ownership (Wave D)
| ID | Disposition | Rationale / evidence |
|----|-------------|----------------------|
| HE-D500-021 | ALREADY_COVERED | `sales-decision-perf-ext20k` D5/D7: 10 nav cycles keep DOM stable, one active page, no duplicate ids. |
| HE-D500-022 | NOT_JUSTIFIED | No sort handlers on decision pages. |
| HE-D500-023 | NOT_JUSTIFIED | No filter handlers on decision pages. |
| HE-D500-024 | NOT_JUSTIFIED | Panels are shown/hidden, not removed; no detached tables. |
| HE-D500-025 | NOT_JUSTIFIED | Sales render sets no timers/debounces. |
| HE-D500-026 | NOT_JUSTIFIED | Decision adapters bind no window-level listeners. |
| HE-D500-027 | NOT_JUSTIFIED | No resize/visibility observers in sales render. |
| HE-D500-028 | ALREADY_COVERED | Engines are pure/stateless; Wave H cross-engine + D5 show no cross-page contamination. |
| HE-D500-029 | ALREADY_COVERED | `loadSales` is independent per panel and try/catches to an ERROR shell. |
| HE-D500-030 | ALREADY_COVERED | `loadSales` catch renders the inert ERROR shell; `sales-wiring` covers DISABLED/ERROR shells. |
| HE-D500-031 | **DISTINCT_GAP_CONFIRMED → IMPLEMENTED** | New test: flag ON→OFF (reload) leaves no sales sidebar surface, one active page, and any active sales host shows the DISABLED shell (no leftover synthetic data). |
| HE-D500-032 | NOT_JUSTIFIED | Focus restoration is an app-level concern already covered by `a11y-basics`/`a11y-ext8`; sales pages open no dialogs. |
| HE-D500-033 | NOT_JUSTIFIED | Sales decision pages open no dialogs. |
| HE-D500-034 | ALREADY_COVERED | `HE.sales` modules register once; `app-modules`/`modules-ext15` gate single creation. |
| HE-D500-035 | ALREADY_COVERED | `nav-history` spec covers back/forward app-wide; sales pages use the same mechanism. |
| HE-D500-036 | ALREADY_COVERED | `modules-ext15` asserts each module is created exactly once. |
| HE-D500-037 | NOT_JUSTIFIED | Sales fixtures are synchronous; no late-resolving promise after page exit. |
| HE-D500-038 | NOT_JUSTIFIED | Render-once; no teardown path to be non-idempotent. |
| HE-D500-039 | ALREADY_COVERED | D5/D7 counts live DOM ownership (child counts / duplicate ids), not event registrations — matching this candidate's own caution. |
| HE-D500-040 | ALREADY_COVERED | D5/D7 identifies the render-once ownership pattern as the single resource-growth vector, and shows it stable. |

## Workstreams 03–25 — workstream-level triage (per-candidate detail deferred to each wave)
| WS | Area (Reserve IV wave) | Dominant disposition | Rationale |
|----|------------------------|----------------------|-----------|
| 03 | Large-result interaction / bounded rendering (D) | NOT_JUSTIFIED (decision pages) / INVESTIGATION (EXT list pages) | Decision pages show small fixed sets; large-list bounding is already handled on the EXT order/lead pages. |
| 04 | Mobile tables / narrow-layout integrity (C) | INVESTIGATION_NEEDED | a11y matrix already checks 320px/200% no-scroll + tap targets; decision-critical-value-at-narrow-width deserves a focused check. Candidate Wave C work. |
| 05 | Focus / sort / filter / dynamic announcements (C) | PARTLY NOT_JUSTIFIED | No sort/filter on decision pages; focus/live-region depth is a genuine Wave C item for interactive EXT pages. |
| 06 | Accessible uncertainty / info hierarchy (C) | INVESTIGATION_NEEDED | "Uncertainty not by color alone" is a real Wave C check for UNKNOWN/risk labels; worth a focused test. |
| 07–08 | Retention chronology / eligibility / economics (E) | INVESTIGATION_NEEDED | `he-sales-retention` exists; the unknown-vs-inactive and hypothetical-reorder-timing distinctions need an evidence review before extending. |
| 09–10 | Territory identity / comparison (E) | INVESTIGATION_NEEDED | `he-sales-territory` exists; sparse-data-≠-low-potential and explicit-denominator claims need review. |
| 11–12 | Creator rights / attribution (E) | INVESTIGATION_NEEDED + OWNER_OR_EXTERNAL_BLOCKED | `he-sales-creator` exists; rights/expiry/commercial terms are unresolved owner dependencies by design. |
| 13–14 | Incident classification / recovery (F) | INVESTIGATION_NEEDED | `he-sales-anomaly` exists; incident-vs-validation and dedup-noise behavior need review before building. |
| 15 | Diagnostic privacy / evidence minimization (F/G) | ALREADY_COVERED (partly) | `he-sales-privacy` classifies fields; a diagnostics-don't-leak-contents check may be a small add. |
| 16–17 | CRM identity / schema evolution / deletion (G) | DESIGN-ONLY (synthetic) | Data-model DESIGN with synthetic examples only; no production SQL or migration. Candidate Wave G doc work. |
| 18 | Event idempotency / ordering (G/H) | INVESTIGATION_NEEDED | Follow-up supersession exists (`he-sales-followup`); out-of-order event modeling is a synthetic design/test item. |
| 19 | Information architecture / page consolidation (I) | INVESTIGATION_NEEDED | 47-page inventory review for overlap/dead links; subtract only after proving genuinely unused. |
| 20 | Progressive disclosure / owner comprehension (C/I) | INVESTIGATION_NEEDED | Explanations-without-hover is partly covered by a11y; comprehension layering is a Wave I item. |
| 21 | Deterministic boundaries in v2 consumers (D/E/G) | ALREADY_COVERED (pattern) | Wave A established the unknown-vs-zero / injected-time / no-mutation discipline; extend to any new v2 consumer as built. |
| 22 | Approval integrity at new integration points (B/E/F/G) | ALREADY_COVERED (primitive) | `he-sales-approval` fingerprint/invalidation is the reusable primitive; apply at each new point rather than a new system. |
| 23 | Audit consumption / explanation / history integrity (H/F/G) | ALREADY_COVERED (primitive) | `he-sales-audit` append-only stage-typed trail + Audit page; extend consumers as needed. |
| 24 | Feature flags / packaging / final changed-state gates (C/D/I) | ALREADY_COVERED | Flag default-OFF proven (wiring + new 031 toggle); gates (dom-sinks, verify-moves, assets, determinism, inventory, TT) run each wave. |
| 25 | Owner completion / rollback / honest exhaustion (I/G/F) | ONGOING | This report + PROJECT_RECORD + per-commit rollback satisfy it; "honest exhaustion" is asserted only from evidence. |

## Honest status
- **Confirmed + implemented this pass:** HE-D500-011, HE-D500-031 (2 distinct
  gaps). The rest of Workstreams 01–02 are ALREADY_COVERED or NOT_JUSTIFIED by
  the verified render-once / no-handler / static-section architecture.
- **Not claimed:** that all 500 are confirmed gaps, that the subsystem is
  globally novel, or that any of this is production-ready. Workstreams 03–25
  hold genuine candidate Wave C/E/F/G/I work (flagged INVESTIGATION_NEEDED) that
  needs per-candidate inspection in its wave; several E/creator and G items are
  owner/external-blocked by design.
- **Next safe action:** take Workstream 04/06 (Wave C — mobile decision-value
  integrity at narrow width; uncertainty-not-by-color) to per-candidate detail,
  reusing the a11y matrix helpers; build only demonstrated gaps.
