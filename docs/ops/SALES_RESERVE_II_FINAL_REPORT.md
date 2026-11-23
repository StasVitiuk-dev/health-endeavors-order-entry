# Sales & Growth — Reserve II final report

Status: CURRENT · Branch `claude/platform-ext20-adversarial-completion-2026-10-13`,
**not merged, nothing deployed, production untouched** · As of 2026-10-20 · For: Stas

This reports the owner-authorized local capability expansion (Reserve II) that
built genuinely new Sales & Growth capabilities on top of the flag-OFF
subsystem. It is a companion to `SALES_GROWTH_AND_WHOLESALE_SYSTEM.md` (how the
system works) and `SALES_INVENTORY.md` (the generated module/page/spec list).

## Git

- **Starting SHA:** `2bc0aef` (Sales PART I + advisory agents already in place).
- **Commits in this reserve:** 11 (plus this report's commit), each small and
  reversible, all pushed to the feature branch. Highlights:
  engine waves (retention/territory/data-quality; content/campaign/forecast;
  lead-detail/lost-deals/anomaly/workload; benchmark/scorecards/providers/safety;
  readiness/sources/queue; creator/sample-advisor/changes; privacy; simulator),
  two page-wiring waves, a prompt-injection safety suite, a large-data load
  spec, and a generated inventory.

## What was added

- **New engine modules (22 this reserve; ~37 under `assets/sales/` in total):**
  retention, territory, data-quality, content, campaign-lab, forecast,
  lead-detail dossier, lost-deals, anomaly, owner-workload, benchmark/gold
  harness, agent scorecards, provider matrix, safety-center, commercial/
  line-sheet readiness, lead-source & store-type performance, owner daily queue,
  creator prospecting, sample candidate ranking + fraud watch, what-changed +
  weekly/monthly review, privacy center, and an end-to-end lifecycle simulator.
  All pure, synthetic, dual-mode, on the `window.HE.sales` namespace (kept out of
  the app's 19-module graph).
- **New flag-OFF pages (21 this reserve; 28 sales pages in total):** Lead Detail,
  Retention, Content Opportunities, Territory & Expansion, Campaign Lab, Sales
  Data Quality, Sales Forecast, AI Cost Center, Sales Safety Center, Lost Deal
  Analysis, Sales Anomaly Center, Owner Workload, Agent Scorecards, Owner Daily
  Queue, Wholesale Readiness, Lead Source Quality, Creator Prospects, Sample
  Candidate Ranking, What Changed, Weekly Review, Sales Privacy Center.
- **Advisors/agents:** the 32-agent advisory roster (all OFF) remains; the new
  scorecards/benchmark/anomaly modules observe and grade them, never run them.
- **Simulators:** an end-to-end lifecycle simulator and an inbound-event
  (website/Gmail/DNC) ingestor, both proving zero side effects.
- **Tests (25 `sales-*.spec.js` files):** per-module unit specs, a prompt-
  injection/adversarial suite, a large-data (10k/50k) load spec, an inventory
  freshness spec, and the 28-page wiring spec (desktop + iPhone).
- **Tooling/docs:** generated `SALES_INVENTORY.md` + freshness guard; this
  report; updates to the system doc, project record and current-state.

## Verification (all green)

- Trusted Types ratchet **0**; DOM-sink gate **0 dangerous / 0 reviewed**;
  app-module graph **19** (sales stays off it); asset content-hashes valid;
  `css:check`, `secrets:scan`, `docs:check`, `sql:lint` OK.
- Write-path matrix/inventory and module map regenerated after every wiring wave
  (line-number shifts only — **no new write paths**, confirming every sales page
  is read-only).
- Broad browser matrix (general / nav / a11y / Trusted-Types / no-live-send /
  page-sweep / device-matrix / responsive / empty-database) green at each wave.
- Large-data: 10k-lead scoring/aggregation/data-quality and a 50k engine-only
  pass all within time budgets.
- **Bugs found/fixed during the reserve:** the EXT15 module-graph tooling and
  verify-moves baseline tripped on the new `HE.modules.create`/factory usage
  (fixed by moving the sales engine onto a separate `HE.sales` namespace and
  extending the verify-moves allowlist); stale `?v=` hashes and write-path line
  numbers after each edit (fixed by regenerating). No product defects in shipped
  dashboard behavior; the live app is unchanged with the flag off.

## Safety confirmation

main untouched · no merge · no deploy · production untouched · Gmail disconnected
· zero messages sent · Shopify untouched · customer data untouched · no sample
shipped/approved by code · no prices/money changed · no secrets · no backups ·
no Real Estate. The feature flag defaults OFF; with it off there is no sidebar
group, no reachable page, and the engine is not even instantiated. Safety
invariants are enforced in `he-sales-safety.assertInvariants` (fails closed) and
re-proved by the prompt-injection suite and the lifecycle simulator.

## Is meaningful safe-local work exhausted?

**Not entirely — but the remaining reserve items are now one of three kinds, none
of which is new safe-local engineering of real capability:**

1. **Thin page-views over modules already built + tested** (e.g. separate SEO/
   FAQ/blog/newsletter/social planner pages over `he-sales-content`; a separate
   Revenue Scenario / Order-Size / Inventory-constrained page over
   `he-sales-forecast`; Settings / Owner Decision Center / Readiness Center pages
   over `he-sales-safety`/`he-sales-readiness`). The capability and its tests
   exist; another page is largely presentation. These can be added on request.
2. **Owner/external/production-gated** (connect a real sales Gmail, enable send,
   set real price/MOQ/MSRP/claims/certs, provider API keys, website inquiry
   feed, merge, deploy). These are decisions and external actions, not code I
   can or should do locally.
3. **Already delivered** across the reserve (adversarial/prompt-injection,
   large-data, chaos-style suppression, a11y/mobile/device matrices, provider
   fallback/chaos, cost controls, DNC protection, provider abstraction,
   synthetic integration/orchestration).

So the genuinely-new safe-local *engine* work is effectively complete; what
remains is either presentation over existing engines (available on request) or
owner/external/production steps. If you want specific additional pages from
category 1, name them and I will wire them the same way, behind the same OFF
flag.
