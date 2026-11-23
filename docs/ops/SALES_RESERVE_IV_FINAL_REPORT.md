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

Then, same session:
- `44ed46e` **Wave H1–H8 — cross-engine consistency**: one synthetic dataset
  through all engines proving consistent identity/account/aging/stage/
  suppression. Spec (6).
- `a828023` **Wave D — decision-page responsiveness & nav stability**: documented
  that `sales-scale-ext20k` is pure-engine only (D1); new
  `sales-decision-perf-ext20k` separates in-page engine compute from the page
  (D2) and proves 10 navigation cycles across the 5 decision pages leave DOM
  stable with no re-render accumulation (D5/D7, render-once architecture).
- D500 reconciliation (this pass): verified the external 500-candidate package
  (sha256 `a43f6e54…`, IDs 001–500 present/sequential/unique) and reconciled it
  against the actual repo in `SALES_RESERVE_IV_D500_DISPOSITIONS.md`.
  Workstreams 01–02 dispositioned per-candidate: 2 distinct gaps confirmed +
  implemented — **HE-D500-011** (repeated measurement / median+range, no false
  precision) and **HE-D500-031** (flag ON→OFF toggle leaves no stale sales
  surface); the rest ALREADY_COVERED or NOT_JUSTIFIED by the verified
  render-once / no-handler / static-section architecture. Workstreams 03–25
  triaged at workstream level (genuine Wave C/E/F/G/I candidates flagged
  INVESTIGATION_NEEDED for their waves; no 500-gap or novelty claim made).
  Note: new commits from this pass drop the `[skip ci]` marker (the repo has no
  CI workflows, so it was a no-op; omitted to comply with the current script).

Counts after that pass: **47 pages · 45 modules · 39 specs.**

## CONTINUATION SESSION — 2026-10-27 (Waves C, E, F, G, I)
Resumed from verified checkpoint `17c82e2`. Independent-work pass to leave only
owner/legal/external decisions. Small reversible commits, each tested, gates
green, flag default-OFF, `main` untouched. New commits **omit `[skip ci]`** (the
repo has no CI workflows; the marker was a no-op).
- `6bac391` **Wave C (WS04/C5)** — mobile decision-value integrity: at 320px+200%
  the owner-critical signal on each of the 5 decision pages stays visible and
  un-clipped, no sideways scroll; no sales row clips by overflow/ellipsis.
  (C6/C7 text-not-colour already proven at `17c82e2`.) Test-only.
- `be8203e` **Wave E (E4)** — retention honors suppression: a DNC/opt-out
  customer is excluded from every actionable candidate list (reorder/win-back/
  review) and surfaced separately; still segmented, never proposed for contact.
  Real fix + spec.
- `578bc92` **Wave E (E6)** — territory no longer treats sparse data as low
  potential: unscored territories are `rankable:false`/`whitespaceScore:null`/
  UNKNOWN, excluded from the white-space ranking and shown in a `needsData`
  ("needs scoring, not low potential") section. Real fix + spec + page section.
- `a64634d` **Wave E (E8/E9/E10)** — creator honesty evidence (attribution
  always UNKNOWN; code use ≠ demand; no rights/payment/claim assumption).
- `d6f0e7d` **Wave F** — new `he-sales-incidents`: classifies anomaly flags into
  deduped incidents (capability/evidence/mode/next-action), acknowledge≠resolved,
  reconcile-on-next-scan, disconnected-provider-never-healthy. Engine + spec.
- `21c1dee` **Waves G + I** — `SALES_CRM_DATA_MODEL_DRAFT.md` (design only, no
  SQL) and `SALES_IA_REVIEW.md` (47-page review; consolidations proposed,
  nothing removed).

Counts now: **47 pages · 47 `assets/sales` modules · 45 sales specs.** The
original Reserve IV body below remains accurate for the first session.

## OWNER ACTION PACKET (what is left — all yours, ordered by dependency)
Genuine owner/legal/external decisions; none is Claude's to do, each blocks the
next step, and local preparation for each is DONE.
1. **Approve the real commercial facts** (wholesale price, MOQ, MSRP, approved
   claims, certifications). *Blocks:* Commercial & Line Sheet / Wholesale
   Readiness stay BLOCKED; the claim firewall can't pass real claims without an
   approved list. *Recommendation:* set with your manufacturer/lab + legal;
   start with price + MOQ + one approved claim set. *Prepared:* pages + claim
   scanner already gate on these and show them pending. *Unlocks:* readiness/
   commercial pages and realistic line sheets.
2. **Legal/claims review** of body-care marketing language. *Blocks:* approving
   any outreach/content draft for real use. *Recommendation:* lawyer sign-off on
   the approved claim list from (1). *Prepared:* firewall + drafts are
   claim-scanned and blocked-on-fail (assists, does not certify).
3. **Decide on a sales Gmail** and **whether to ever enable sending.** *Blocks:*
   any real outreach (there is no send path today). *Recommendation:* keep send
   OFF until (1)+(2); connect a dedicated address, review, then decide.
   *Prepared:* provider contract + no-send/disconnected invariants tested.
4. **Provider API keys** (optional). *Blocks:* AI drafting beyond free
   deterministic templates. *Recommendation:* optional — templates work without
   keys. *Prepared:* provider-neutral router + hard budget stop.
5. **Website inquiry feed** decision (separate repo — not touched here).
   *Blocks:* real lead intake. *Recommendation:* decide source + format with the
   website owner. *Prepared:* importer + duplicate review (never auto-merge).
6. **Review + merge/deploy** this branch (only you can). *Blocks:* anything
   going live (`main` is untouched). *Recommendation:* review, confirm the flag
   stays default-OFF on merge, then merge when ready. *Prepared:* 47 pages, gates
   green; rollback = per-commit revert or flag-OFF.

**After (1)–(6)** the only remaining engineering is wiring approved facts and (if
enabled) a real send path — both small and owner-gated.

## SAFE-LOCAL EXHAUSTION (honest)
After Waves A–I, the demonstrated independent gaps are addressed. Remaining D500
candidates are ALREADY_COVERED, NOT_JUSTIFIED by the render-once/no-handler/
static architecture, or OWNER_OR_EXTERNAL_BLOCKED (see
`SALES_RESERVE_IV_D500_DISPOSITIONS.md`). Further local work would be low-value
confirmatory tests or speculative features without a consumer — explicitly out
of scope per the instruction. **Safe-local work is effectively exhausted**;
what remains is the OWNER ACTION PACKET above. Unresolved engineering risk:
none in shipped (flag-OFF) behavior; the only risk is in the owner/external
steps (real claims/prices, send enablement), which are gated by design.

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
