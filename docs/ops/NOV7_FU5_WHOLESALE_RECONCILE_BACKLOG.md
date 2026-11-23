# FU5 — wholesale reconciliation + ordered agent backlog

Status: CURRENT · As of 2026-11-09 · For: Stas · Local/synthetic, draft-only,
nothing deployed. Branch `claude/ext20-recovery-2026-10-31` (unpushed).

Purpose of this page: before building more wholesale workflow, reconcile what the
wholesale area already has (protected pricing/QR access, packaging inventory,
reorder alerts) against the one narrow gap FU5 closed, and record the ordered
backlog for the remaining approved agent additions with explicit inputs, outputs,
approval gates and dependencies. One authoritative page per topic — this links to
the engine-layer doc rather than repeating it.

**Related (do not duplicate):**
- `SALES_GROWTH_AND_WHOLESALE_SYSTEM.md` — the 48-module engine layer + 7-page wiring.
- `WHOLESALE_STOREFRONT_HANDOFF.md` — protected B2B pricing / QR access handoff.
- `SALES_INVENTORY.md` — flag-gated pages ↔ loaders ↔ modules (regenerated).
- `SALES_OWNER_DECISION_QUEUE.md` — owner approvals still open for the sales area.
- `NOV7_RELEASE_REVIEW_ONEPAGE.md` — the 6 go-live owner decisions.

---

## 1. Reconciliation — already built vs. the FU5 gap

| Wholesale capability | State before FU5 | Evidence | Verdict |
|---|---|---|---|
| Protected wholesale **pricing / QR access** | implemented + verified (synthetic) | `WHOLESALE_STOREFRONT_HANDOFF.md`; storefront handoff is a separate component, access-gated | **Covered** — no FU5 work; storefront itself is owner/native-side |
| **Packaging inventory** (jars/labels/cartons) | implemented + verified | `he-reorder.js`, reorder-ext21, inv-wholesale-rehearsal; counts + UNKNOWN≠0 | **Covered** |
| **Reorder alerts** (reorder point / cash flow) | implemented + verified | reorder-ext21, reorder-view, `receivePartial` (inTransit→onHand, read-only) | **Covered** |
| Wholesale **lead sourcing + dedup** | implemented + verified | `he-sales-sources.js`, `he-sales-leads.js`, `he-sales-import.js` (duplicate graph) | **Covered** |
| **Editable outreach drafts, verified-facts-only** | implemented + verified | `he-sales-outreach.js` (approved-facts provenance, claim firewall, `sent:false`) | **Covered** |
| **Version-bound approval that never sends** | implemented + verified | `he-sales-approval.js` (`nextAction`), approval-binding-ext21 | **Covered** |
| **Simulated reply / opt-out** | implemented + verified | `he-sales-replies.js`, `he-sales-followup.js` (opt-out never followed up) | **Covered** |
| **SHIPPED** sample tracking (mailed samples) | implemented + verified | `he-sales-samples.js` (eligibility, budget guard, ROI ACTUAL/UNKNOWN) | **Covered** |
| **In-person (HAND-DELIVERED) sample visits** | **absent** — the genuine gap | — | **Closed by FU5** ↓ |

### What FU5 built (the one unbuilt workflow)

`assets/sales/he-sales-visit.js` + `tests/specs/sales-visit-ext21.spec.js` (4 tests,
all green). A visit is a sample **hand-delivered at a store**, distinct from a
SHIPPED sample: stock is consumed on the spot and the visit carries an outcome.

- **Records** stock consumed, sample cost, and outcome per visit.
- **Never fabricates cost:** unknown unit cost → `sampleCost:null`, `costBasis:'UNKNOWN'`
  (never a fake `$0`); `totalCost()` reports `PARTIAL/UNKNOWN` with an `unknownCount`.
- **Idempotent** by visit key (`store|date|kit` default) — an interrupted retry
  returns `{ok:false, duplicate:true}` and never double-counts stock.
- **Maps outcome onto the sample lifecycle** (advisory, never auto-applied):
  `ORDERED→CONVERTED`, `DECLINED→NO_ORDER`, `FOLLOW_UP→FOLLOW_UP_DUE`, `PENDING→RECEIVED`.
- **Advisory / read-only:** it never sends and never writes production stock. The
  missing safe write is **named, not faked**: `MISSING_WRITE_CONTRACT` =
  `adjust_inventory (R4)` — a safe hand-delivered-sample stock decrement, not in
  the local build.

**Still a model, not a page.** Like the other engine modules it is unwired by
design (sales-wiring-ext20j / sales-inventory-ext20j confirm an unwired new model
is fine and SALES_INVENTORY stays accurate). Wiring it into a UI panel behind the
`he_sales_growth` flag is a follow-up, listed in the backlog below (W-0).

---

## 2. Ordered agent backlog (approved additions not yet built as workflows)

Order = highest leverage × lowest dependency first. Every item is **engine-first,
flag-OFF, draft-only, never-sends**, and gated on owner approval before any real
output. "Engine exists" means the pure module is present; "workflow" means the
sourced→draft→approve→(simulated)act loop a person would actually run.

| # | Item | Inputs | Outputs | Approval gate | Dependencies | Status |
|---|---|---|---|---|---|---|
| **W-0** | Wire the **in-person visit log** into a panel | kit id, store, jars, unit cost, outcome | visit rows, stock-consumed + cost (ACTUAL/UNKNOWN), suggested sample-state | owner enables `he_sales_growth`; `adjust_inventory (R4)` before any real stock write | `he-sales-visit.js` (FU5), `he-reorder.js` | **✅ BUILT + WIRED** |
| **W-1** | **Content repurposing** (one asset → channel variants) | approved source copy/asset, channel, brand voice | draft variants, `sent:false`, each run through claim firewall | owner approves each variant; no publish path | `he-sales-content.js`, `he-sales-claims.js` | **✅ BUILT (engine)** |
| **W-2** | **Ad variants** (headline/body A/B drafts) | approved offer facts, audience, budget cap (synthetic) | ranked draft ad copy, no spend, claim-clean | owner approves + no ad-account connection (spend stays off) | `he-sales-campaign.js`, `he-sales-content.js`, `he-sales-cost.js` | **✅ BUILT (engine)** |
| **W-3** | **Feedback / review analysis** (themes, risk flags) | synthetic reviews/replies, product tags | theme clusters, sentiment (UNKNOWN≠0), claim-risk flags | owner reviews before any reply drafted; replies never sent | `he-sales-reviews.js`, `he-sales-replies.js`, `he-sales-anomaly.js` | **✅ BUILT (engine)** |
| **W-4** | **Creator / boutique scouting** (sourced + deduped) | category, region filters, synthetic directory | scored creator/boutique leads with reasons + dedup | owner approves outreach; contact suppression honored | `he-sales-creator.js`, `he-sales-sources.js`, `he-sales-leads.js` | **✅ BUILT (engine)** |
| **W-5** | **Retention** (re-order nudges, churn risk) | order history (synthetic), cadence | at-risk accounts, draft nudges `sent:false` | owner approves each nudge; opt-out/do-not-contact excluded | `he-sales-retention.js`, `he-sales-followup.js` | **✅ BUILT (engine)** |

### Build status — FU6 wave (as of 2026-11-13)

All local/synthetic, default-OFF, draft-only; no push/merge/deploy. New engine
modules are unwired by design except W-0, which is wired behind `he_sales_growth`.

| # | What was built | New module / spec | Commit | Tests |
|---|---|---|---|---|
| W-0 | Visit log surfaced as the "In-Person Sample Visits" panel (default-OFF, read-only; stock/cost/outcome, R4 named, in-person≠shipped) | wiring + `sales-wiring`/`sales-pages-sync` updates | `2b02bc4` | wiring+content+a11y+mobile matrices green; visit model 4 |
| W-1 | Content repurposing: approved asset → caption/short-video/newsletter drafts; attribution, editable versions, missing-input states; source-as-data (injection + zero-width blocked) | `he-sales-repurpose.js` + `sales-repurpose-ext21` | `5c73c2c` | 5 + inventory 3 |
| W-2 | Ad variants: hooks/headlines/creative briefs; review-by-variant; approval binds to wording+facts and invalidates on change; no campaign/spend | `he-sales-advariants.js` + `sales-advariants-ext21` | `2a513b0` | 5 + inventory 3 |
| W-3 | Feedback analysis: route packaging/quality/safety to a human; conflict + duplicate detection; PII guard; testimonial gate (provenance+permission+wording+PII) | `he-sales-feedback.js` + `sales-feedback-ext21` | `a4a68d7` | 5 + reviews 5 + inventory 3 |
| W-4 | Creator sample-offer draft: shortlist with source+fit evidence; UNKNOWN engagement kept; gifting/stock/contact DISABLED (R4 named) | `he-sales-creatoroffer.js` + `sales-creatoroffer-ext21` | `cc6c95d` | 5 + creator 4 + inventory 3 |
| W-5 | Retention reorder-reminder drafts: explicit surfaced cadence; consent/opt-out/recent-order/duplicate/cap/supersede guards; claim-checked | `he-sales-retentionreminder.js` + `sales-retentionreminder-ext21` | `d4916a6` | 5 + retention 3 + followup 7 + inventory 3 |

**Update Nov 14:** W-1…W-5 are now wired as default-OFF Sales & Growth pages (`074e3ab`),
each with a browser test. The owner decisions were made on Nov 14
(`OWNER_DECISIONS_2026-11-14.md`). All real output (publishing, sending, spend, gifting,
stock writes) still stays blocked on provider/device approvals and the owner's merge.

**Scanner (FU4) follow-up check:** the standalone Scan Shipment entry point is
present (`scanEntryButton`/`paintScanEntry`, behind `scanShipmentOn`) and
multi-package-per-order each-confirm + independent tracking/email failure are
covered (`fu4-scan-journey-ext21`). No concrete open local scanner gap found at
this checkpoint; if one surfaces, record it here with the smallest synthetic case.

**Cross-cutting gates (apply to every row above):**
1. Feature flag `he_sales_growth` OFF by default — no sidebar, no link, inert panel until owner enables.
2. Claim firewall (`he-sales-claims.js`) `assertClean()` fails closed on all generated copy.
3. Provider-neutral: Gmail/Shopify/AI providers declared but NOT_CONNECTED / "owner must enable"; no network.
4. `sent:false` / `simulated:true` on every outward artifact; money and sending stay off.
5. Approved-facts-only provenance for any claim; UNKNOWN is first-class (never a fake number).

**Named missing production contracts (not faked):**
- `adjust_inventory (R4)` — safe stock decrement for hand-delivered samples (W-0).
- Gmail SEND cap + connection + owner approval (W-1..W-5 outreach) — see `he-sales-gmail.js`.
- Ad-account connection + spend authority (W-2) — absent by design.

---

## 3. Verification at this checkpoint

- FU3 + FU4 + FU5 specs: **12 passed** (desktop project), pure Node, synthetic.
- `sales-wiring-ext20j`, `sales-inventory-ext20j`: green — new unwired model is consistent, `SALES_INVENTORY.md` accurate.
- Browser override NOT present in `tests/playwright.config.js` (clean working tree).
- Recovery export refreshed at this checkpoint (see recovery artifact note in the release package).

## 4. Next steps (all local/synthetic, none requires a push)

1. W-0: wire visit log into a flag-gated panel + delegated listener + `?v=` hash (follow the loader pattern).
2. Then W-1..W-5 in order, each engine→workflow, flag-OFF, with the gates above.
3. Owner decisions that unblock real output stay in `SALES_OWNER_DECISION_QUEUE.md` and `NOV7_RELEASE_REVIEW_ONEPAGE.md` (6 open) — left open by design.
