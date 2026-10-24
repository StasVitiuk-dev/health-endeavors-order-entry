# Sales & Growth — Reserve IV report (decision intelligence + deep reliability)

Status: CURRENT · Branch `claude/platform-ext20-adversarial-completion-2026-10-13`,
**not merged, nothing deployed, production untouched** · As of 2026-10-24 · For: Stas

Reserve IV deepens the Sales & Growth subsystem along reliability, owner
productivity, and **decision intelligence**. This report records what has
landed so far and gives a continuation prompt; Reserve IV is a large standing
program and this is an honest checkpoint, not a claim that every item is done.

## GIT
1. Starting SHA (verified before coding): `115026e`
2. Final SHA (this report's commit): see `git log -1`
3. Reserve IV commits so far: 5 code/test commits + this report — each small and
   reversible (`git revert <sha>` removes one piece cleanly):
   - `f819de2` Wave 1 — per-page accessibility depth (42-page a11y matrix + helper + sync)
   - `3a01d87` prioritization engine v2 (explainable + sensitivity)
   - `b2fa4cf` deal progression & aging engine
   - `b81231d` pipeline concentration & quality-risk engine
   - `1f3ea85` wire the 3 new engines as flag-OFF owner pages (→ 45 pages)
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
Three genuinely-new pure engine modules, each with its own spec, plus an
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
  only see the flag-OFF dashboard). The matrix auto-covers the 3 new pages.

## OWNER SYSTEM
**45 flag-gated sales pages** (was 42): the 3 decision-intelligence pages join
the Reserve I–III owner operating system (command center, queues, approvals,
pipeline, forecast, scenario/campaign labs, analytics suite, prep pages,
reporting/export, audit/settings/safety/decision/readiness/privacy centers).

## TESTS
- Sales engine modules: 41 · spec files: 31.
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
