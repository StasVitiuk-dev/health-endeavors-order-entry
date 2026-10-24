# Sales & Growth — Reserve IV report (decision intelligence + deep reliability)

Status: CURRENT · Branch `claude/platform-ext20-adversarial-completion-2026-10-13`,
**not merged, nothing deployed, production untouched** · As of 2026-10-24 · For: Stas

Reserve IV deepens the Sales & Growth subsystem along reliability, owner
productivity, and **decision intelligence**. This report records what has
landed so far and gives a continuation prompt; Reserve IV is a large standing
program and this is an honest checkpoint, not a claim that every item is done.

## CONTINUATION SESSION — 2026-10-24 (Waves A, B, H9)
Resumed from verified checkpoint `25d4fd0` (branch/HEAD/main/tree all reconciled
against the ledger before any change). Four more small reversible commits, each
tested, all gates green, flag default-OFF, `main` untouched:

- `8164659` **Wave A — decision-engine correctness**. Probed the 5 engines and
  fixed the real defects found: concentration no longer shows a deal id as a
  pretend customer or collapses account-less deals into one fictitious account
  (known-accounts-only for the top-account share + dependency flag), counts a
  repeated deal id once (`duplicateIdsDropped`), and reports dropped
  non-positive values; progression reads a future date as UNKNOWN (not age
  0/FRESH), flags `inconsistentDates` when a stage predates creation, has a
  stable `stalled` tie-break, and averages only known ages; priority de-dupes
  repeated lead ids. Confirmed no engine reads the wall clock (A2), none mutate
  inputs (A9), and concentration totals/HHI match an independent reference
  (A10). New spec `sales-wavea-correctness-ext20k` (11).
- `96d6545` **Wave B — approval integrity** (B3/B4/B5). New `he-sales-approval`:
  fingerprints the approval-material fields, so any edit voids the approval and
  a DNC/opt-out after approval wins; approval is never a send (`sent:false`); a
  suppressed/claim-blocked draft can't be approved. Spec (8).
- `d1cc6d0` **Wave B — adversarial reply safety** (B6/B7). Proves injection/HTML/
  opt-out/huge/unicode reply text can never make the reply-triage or next-action
  engines act or report an external side effect, send/ship steps stay owner-gated
  ("BY HAND"), and opt-out still routes to suppression review. Spec (5).
- `49fdef2` **Wave H9 — audit trail**. New `he-sales-audit`: append-only,
  stage-typed evidence (SUGGESTION/REVIEW/APPROVAL/SIMULATED_OUTCOME), frozen
  entries, `lifecycleOrderOk`, integrates the approval fingerprint; surfaced on
  the existing Audit & Explainability page (no new page). Spec (7).

Counts now: **47 pages · 45 `assets/sales` modules · 38 sales specs.** The
original Reserve IV body below remains accurate for the prior session.

## GIT
1. Starting SHA (verified before coding): `115026e`
2. Final SHA (this report's commit): see `git log -1`
3. Reserve IV commits so far: 9 code/test/doc commits — each small and
   reversible (`git revert <sha>` removes one piece cleanly):
   - `f819de2` Wave 1 — per-page accessibility depth (a11y matrix + helper + sync)
   - `3a01d87` prioritization engine v2 (explainable + sensitivity)
   - `b2fa4cf` deal progression & aging engine
   - `b81231d` pipeline concentration & quality-risk engine
   - `1f3ea85` wire the first 3 engines as flag-OFF owner pages (→ 45 pages)
   - `cdf28ce` this report + project-record entry
   - `17ead5f` next-best-action v2 engine + page (→ 46 pages)
   - `1e0b12c` decision-intelligence engine scalability matrix (1k/10k/50k)
   - `c5f7411` reply triage lab engine + page (→ 47 pages)
4. main SHA: `d3db7bc`
5. main touched? **No**
6. ahead/behind: ahead of main only; 0 behind
7. clean? Yes after each commit
8. pushed? Yes

## SAFETY
Production touched? No · Gmail connected? No · messages sent? No · Shopify
touched? No · customer data? No · samples shipped? No · money/prices changed? No
· secrets? No · backups? No · Real Estate? No · website repo? No · merge? No ·
deploy? No · production SQL? No. Everything is LOCAL + SYNTHETIC +
FEATURE-BRANCH, behind the default-OFF `he_sales_growth` flag. With the flag off
there is no sidebar group, no reachable page, and the engine is not
instantiated. The new engines are pure (no DOM, no network) and read-only: they
rank, age, and flag; they contact no one and write nothing.

## DECISION INTELLIGENCE (new this reserve)
Five genuinely-new pure engine modules, each with its own spec, plus an
owner page for each:
- **Prioritization engine v2** (`he-sales-priority` → *Prioritization Lab*):
  explainable weighted ranking over 6 factors (two cost-like/inverted), with a
  per-factor contribution breakdown and a **sensitivity** pass that re-ranks
  when a single preference weight shifts and reports churn, stability, and
  whether the top pick changed. Deterministic tie-break; weights renormalized;
  empty/invalid input safe.
- **Deal progression & aging** (`he-sales-progression` → *Deal Progression &
  Aging*): per-lead total age, time-in-stage, aging bucket
  (FRESH/AGING/STALE/COLD), soft-SLA **stall** detection, aging histogram, and a
  funnel progression map. Time is injected (`asOf`) → deterministic; missing
  timestamps read UNKNOWN, never a fabricated age; terminal deals are DONE,
  never stalled.
- **Pipeline concentration & quality risk** (`he-sales-concentration` →
  *Pipeline Risk & Concentration*): top-1/3/5 share, per-deal and per-account
  HHI, and risk flags (SINGLE_DEAL_DEPENDENCY, SINGLE_ACCOUNT_DEPENDENCY,
  THIN_PIPELINE, EMPTY_PIPELINE) rolling up to LOW/MEDIUM/HIGH. Weighted value is
  caller-supplied; invents no revenue.
- **Next-best-action v2** (`he-sales-nextaction` → *Next-Best-Action*):
  recommends the ONE next step per lead with a reason, owner-decision flag, and
  confidence. Safety-gated — a declined/DNC/opt-out lead can only be told to
  STOP; approve is never send; samples never ship automatically;
  `externalSideEffect` is always false.
- **Reply triage lab** (`he-sales-replylab` → *Reply Triage Lab*): batch-runs
  replies through the existing classifier and surfaces a confidence
  distribution, a least-certain-first human-review queue, and a
  suppression-review bucket. `noAutoAction` always true; the owner confirms
  every suppression. `uncertainShare` is a calibration signal.

A scalability matrix (`sales-scale-ext20k`) proves all four ranking/analysis
engines stay correct and under a time budget at 1k/10k/50k rows, so wiring
them to a large pipeline can never hang the page.

## DEEP RELIABILITY / A11Y (new this reserve)
- **Reusable sales-pages helper** (`tests/helpers/sales-pages.js`): one
  id→title list for all 45 pages + a flag-enabler, so every deep matrix is
  parameterized over ONE list instead of 45 copy-pasted specs. A **sync spec**
  fails if the list drifts from the live `SALES_TITLES` or a host `<section>`
  is missing.
- **Per-page a11y matrix** (`sales-a11y-ext20k`): with the flag ON, drives
  every sales page and checks — in one pass per concern — accessible names,
  globally-unique ids, visible headings, data-table `<th>`, WCAG AA contrast in
  light AND dark, no sideways scroll at 320 px with text at 200 %, and 24 px
  phone tap targets. This is coverage the broad a11y specs never reach (they
  only see the flag-OFF dashboard). The matrix auto-covers every new page as it is added.

## OWNER SYSTEM
**47 flag-gated sales pages** (was 42): the 5 decision-intelligence pages join
the Reserve I–III owner operating system (command center, queues, approvals,
pipeline, forecast, scenario/campaign labs, analytics suite, prep pages,
reporting/export, audit/settings/safety/decision/readiness/privacy centers).

## TESTS
- Sales engine modules: 43 · spec files: 34.
- Gates green on this head: dom-sinks (0 dangerous), app-modules (19),
  verify-moves (byte-identical baseline `3a40095`), assets-hash,
  generated-determinism, SALES_INVENTORY freshness, Trusted-Types (ceiling 0),
  sales-wiring (flag OFF inert / flag ON renders).
- New engine specs: priority 7, progression 8, concentration 7 — all pass.
- Regression this reserve: a11y matrix + 3 engine specs + pages-strict +
  empty-database + a11y-basics → 65 passed / 21 skipped, both desktop and
  iPhone projects.

## DOCS
This report; regenerated `SALES_INVENTORY.md`, write-path inventory/matrix,
module map; `PROJECT_RECORD.md` history. Rollback is per-commit (revert any
`sales:` commit) and per-flag (OFF disables everything).

## REMAINING (honest)
Reserve IV lists far more than one session can land. What shipped is the
highest-value new capability (decision-intelligence engines + pages) plus the
reusable a11y depth. Still open, all flag-OFF/synthetic and safe to continue:
deeper mobile matrices across more breakpoints; table/list scalability at
10k–50k on the new pages; next-best-action v2; reply-classification confidence
UI; follow-up sequence designer; outreach personalization + red-team; sample
economics v2; retention/territory/creator v2; agent benchmark/caching/override
UX; incident center + postmortem; CRM retention design; data-model drafts (no
production SQL); release/rollback matrix; property/mutation expansion. None is
owner-facing capability that is blocked — they are depth, and each wires the
same way behind the OFF flag. Owner/external/production-gated items (Gmail,
send, real commercial facts, provider keys, website/production, merge/deploy)
stay gated and are not Claude's to do.

## CONTINUATION PROMPT
To continue Reserve IV: resume from the final SHA on this branch (clean,
pushed, `main` untouched). Pick the next engine (e.g. next-best-action v2) or
the next matrix (scalability on the 3 new pages), build it pure + tested, wire
any new page via the same dance (nav entry, host `<section>`, SALES_TITLES +
SALES_VIEWS adapter + PANEL_LOADERS, salesEngine ref, recompute `?v=` hashes,
regenerate write-paths/module-map/SALES_INVENTORY, extend the sales-pages helper
+ sync count + wiring SALES_IDS), keep all gates green, and commit `[skip ci]`
small and reversible. Flag stays default-OFF; nothing is merged or deployed.
