# Sales & Growth — information-architecture review (Reserve IV Wave I)

Status: CURRENT (review + PROPOSALS) · Branch work, not merged · As of 2026-10-27
· For: Stas

Reviews the 47 flag-gated Sales & Growth pages for overlap, clarity, and
navigation. **This is analysis + recommendations; it removes nothing.** Per the
rule: do not remove established functionality just to shrink the inventory, and
remove dead links/code only after proving they are genuinely unused. Each page
below has a clear owner question; none was found to be dead or a broken link.

## Does each page answer a clear owner question?
Yes — grouped by the owner's job-to-be-done:
- **See & prioritize:** Growth Command Center, Owner Daily Queue, Owner Briefs,
  Prioritization Lab, Next-Best-Action.
- **Review & approve:** Sales Approvals, Reply & Follow-up Center, Reply Triage
  Lab, Sample Operating System, Content Planner.
- **Plan & simulate:** Pipeline, Forecast, Scenario & What-If Lab, Campaign Lab,
  Outreach Studio.
- **Analyze:** Sales Analytics, Lead Source Quality, Territory & Expansion, Lost
  Deal Analysis, Retention, Pipeline Risk & Concentration, Deal Progression &
  Aging, Anomaly Center, Agent Scorecards, AI Cost Center.
- **Prepare:** Meeting & Deal Prep, Lead Detail, Wholesale Readiness,
  Commercial & Line Sheet.
- **Document & export:** Reporting Center, Export Center.
- **Audit & control:** Audit & Explainability, Sales Settings & Controls, Owner
  Decision Center, Sales Safety Center, Sales Privacy Center.

## Overlap clusters (candidate consolidations — PROPOSALS, owner decides)
1. **Reply handling:** *Reply & Follow-up Center* (operational queue) and *Reply
   Triage Lab* (confidence/triage view) overlap. Proposal: keep both but add a
   one-line cross-link; do **not** merge (they serve operate-vs-calibrate). No
   change made.
2. **Samples:** *Samples*, *Sample Operating System*, and *Sample Candidate
   Ranking* form a 3-page cluster. Proposal: the Operating System page could host
   the ranking as a section; a merge would reduce 3→2. Deferred — owner should
   confirm they don't rely on the standalone ranking page first (I8).
3. **Agents:** *Sales Agent Activity*, *Agent Scorecards*, *Agent Lab* overlap
   on agent insight. Proposal: consider a single "Agents" page with tabs.
   Deferred — tabbing needs interaction work and owner confirmation.
4. **Risk/aging/prioritization:** the new decision pages (Prioritization,
   Progression, Concentration, Next-Best-Action) are intentionally distinct
   (different owner questions); verified consistent by the Wave H cross-engine
   spec. No consolidation recommended.

## Navigation to the next useful action
- The Owner Daily Queue + Next-Best-Action already route the owner to the next
  step. Recommendation (future, small): a persistent "needs you now" count in
  the Command Center header. Not implemented (would touch the command adapter).

## Misleading completion / readiness language — check (I4)
- Audited the decision/readiness/settings pages: non-local steps (Gmail, send,
  real commercial facts, provider keys, website/production, merge/deploy) are
  shown as pending/`OWNER_INPUT_REQUIRED`, never "done". The Territory page now
  labels unscored territories "needs scoring, not low potential" (Wave E). No
  misleading completion language found to remove.

## Dead links / stale counts / unused code (I7)
- The generated `SALES_INVENTORY.md` + `sales-inventory` freshness gate confirm
  every loaded module exists and every page has a loader/title; the wiring spec
  confirms no duplicate panel ids and flag-OFF inertness. No dead sales links or
  orphaned sales panels were found. No removal performed.

## Decision
The inventory is coherent and each page earns its place. The only justified
subtractions (samples 3→2, agents 3→1-with-tabs) **require owner confirmation**
that the standalone pages aren't relied upon, and a small interaction change —
so they are recorded here as proposals, not executed. The desired outcome (a
more useful system, not merely a smaller one) is better served by the
cross-links and the "needs you now" count above than by deleting working pages.
