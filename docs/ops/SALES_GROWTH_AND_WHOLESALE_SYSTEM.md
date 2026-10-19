# Sales & Growth / Wholesale system — engine layer

Status: CURRENT (local engine, draft-only) · Branch work, not merged, nothing
deployed · As of 2026-10-19 · For: Stas

This is a NEW subsystem added on top of the mature Health Endeavors dashboard. It
turns the platform from operations/security/compliance into also
sales + wholesale + growth — **without** sending anything, giving away samples,
making claims, moving money, or weakening existing safety. Health Endeavors is a
**body-care / skincare** brand (not a supplement/drug); all content safety is
built around that.

**What exists today:** the deterministic/provider-neutral ENGINE layer as pure,
unit-tested modules under `assets/sales/`, not yet wired into a shipped page.
Nothing here connects to Gmail, Shopify, production Supabase, or real stores.

## Modules (`assets/sales/`)

| Module | Purpose | Safety |
|---|---|---|
| `he-sales-ai.js` | Provider-neutral AI drafter | Only a free deterministic **template** provider is configured; Claude/OpenAI are declared but throw "owner must enable" (no network). Every result is a DRAFT, `sent:false`. |
| `he-sales-leads.js` | Wholesale lead model + **deterministic** scoring | Explainable 0–100 score (category fit weighted for body-care), reasons included; strict "serious prospect" gate. No AI. |
| `he-sales-pipeline.js` | 21-state wholesale pipeline state machine | Illegal transitions throw; `OWNER_APPROVED` and `SAMPLE_APPROVED` require explicit owner approval; `DECLINED`/`DO_NOT_CONTACT` suppress contact. Moving a card never sends. |
| `he-sales-claims.js` | **Claim firewall** for all content | Blocks therapeutic/medical claim families + obfuscation (zero-width, letter-spacing); fails closed via `assertClean()`; no false positives on safe cosmetic copy. |
| `he-sales-samples.js` | Sample safety system | Eligibility funnel; owner-actor-required approval; monthly **budget guard** (synthetic default 8) with audited override; `SENT` impossible before `APPROVED`; ROI separates ACTUAL/UNKNOWN. |
| `he-sales-outreach.js` | Outreach draft builder | Qualification gate; **approved-facts-only** provenance; runs the claim firewall and fails closed; records facts/sources/version; never sends. |
| `he-sales-replies.js` | Reply classifier | Deterministic; `UNKNOWN` is first-class (ambiguous never → INTERESTED); safety labels (unsubscribe/bounce/OOO/declined) win; reply text is data, never obeyed. |
| `he-sales-followup.js` | Follow-up planner | Opt-out/declined/bounced/do-not-contact never get one; newer reply supersedes; max 3; minimum gap. Never sends. |
| `he-sales-cost.js` | AI cost control + model routing | Routine work routes to tier `none` (no AI); cheap vs strong tiers; opt-in second opinion; per-day/month budgets with a hard stop. |
| `he-sales-import.js` | Lead import + duplicate graph | Normalizes names/domains/emails/phones; preserves raw + source; flags likely duplicates (email/domain/phone/name+city); never invents or silently merges. |
| `he-sales-gmail.js` | B2B mailbox **contract + double** | READ/DRAFT/SEND are separate switches; real default NOT_CONNECTED + SEND off; `send()` refuses without send-cap + connection + owner approval + non-duplicate + non-suppressed. No real Gmail. |
| `he-sales-analytics.js` | Read-only analytics | Safe denominators (unknown/zero → null, not fake 0%); funnel SIMULATION; sample economics (break-even, max sensible spend). No money movement. |
| `he-sales-fixtures.js` | Synthetic data kit | Deterministic fake stores (example.com, `SYN-` ids, `synthetic:true`), reply spread, messy import rows. No real data. |
| `he-sales-ui.js` | Page view-models + sink-free render adapter | Pure, label-tagged (ACTUAL/ESTIMATED/SIMULATED/UNKNOWN/OWNER_INPUT_REQUIRED) view models for all 7 pages with OK/EMPTY/LOADING/ERROR/DISABLED states, feature-flag OFF by default; `render(vm, h)` uses the injected `h()` builder only (no innerHTML). |

## Activation wiring (DONE — 7 pages, behind a default-OFF flag)

The engine + view-models are now **wired into the shipped `owner-login.html`**,
but only behind a feature flag that is **OFF by default**. With the flag off
there is no sidebar group, no link, and every sales panel renders only an inert
DISABLED shell — so the page-sweep specs, the Trusted-Types ratchet and the
DOM-sink gate never see a sales page and the live dashboard is unchanged. The
wiring, as built:

1. **Flag** — `salesGrowthOn()` in `assets/app/he-config.js` reads the browser
   switch `localStorage['he_sales_growth'] === 'on'` (default off), fails closed
   on any storage error, and is read once at page load. To turn the pages on in
   a browser: `localStorage.setItem('he_sales_growth','on')` then reload; to turn
   them off: `localStorage.removeItem('he_sales_growth')`.
2. **Nav** — a collapsible `Sales & Growth` group is pushed onto `SIDEBAR_GROUPS`
   **only when the flag is on**, with seven pages: Growth Command Center,
   Wholesale Leads, Pipeline, Sales Approvals, Samples, Sales Analytics, Sales
   Agent Activity.
3. **Sections** — seven empty `<section class="panel" id="sales*Panel">` hosts in
   `owner-login.html` (filled by the loader; no inline markup).
4. **Render dispatch** — `loadSales(pageId)` in `assets/owner-login-app.js`
   (registered in `PANEL_LOADERS`) builds the view model from the engine +
   synthetic fixtures and renders it with the shared safe DOM builder `h()`
   (no innerHTML — inherits Trusted Types). When the flag is off it renders only
   the DISABLED shell and never instantiates the data engine, so even a direct
   hash link to a sales page is a safe, empty no-op. A missing/broken engine
   module degrades to a plain "could not load" message in that one panel.

The sales engine files load on every page (`assets/sales/he-sales-ui.js`,
`he-sales-fixtures.js`, `he-sales-leads.js`, `he-sales-pipeline.js`, each with a
content-hash `?v=`) but are pure, self-registering module factories: with the
flag off they define modules and do nothing else.

Proof it is safe: `tests/specs/sales-wiring-ext20j.spec.js` (desktop + iPhone)
asserts flag-off = no group / no links / DISABLED shells / one active page / no
console Trusted-Types error, flag-on = group + seven navigable pages rendering
SIMULATED data with the existing dashboard still working, and no duplicate ids.
The `render()` adapter in `he-sales-ui.js` now covers every page shape (command
sections, record rows, pipeline columns, samples budget/ROI) using `h()` only.

### Advisory agent registry (`assets/sales/he-sales-agents.js`)

The Sales Agent Activity page is backed by a real roster of **advisory** agents
(`he-sales-agents.js`), not stubs. Each agent is **OFF by default** and can only
*advise* — its capabilities come from a fixed safe set (observe, score, flag,
draft, summarize, simulate, classify, dedupe, rank, plan). An agent can never
send a message, approve an outreach, approve/reserve/ship a sample, move money,
or change production; those capabilities are not expressible and `assertSafe()`
throws (fails closed) if any agent is enabled-by-default, not OFF, or holds a
forbidden capability. The page renders every agent with honest health (a
never-run agent is UNKNOWN, never a fake "healthy"). Tested in
`tests/specs/sales-agents-ext20j.spec.js`. Enabling one later (owner-only) still
only lets it produce drafts/flags for human review.

**Still a reviewed step, NOT done:** the remaining dedicated pages from the full
plan (Lead Detail, Retention, Content Opportunities, Territory & Expansion,
Campaign Lab, Sales Data Quality — several of their agents already exist in the
roster above, just without their own page), page styling/polish, and wiring any
agent to real (non-synthetic) data. Those attach the same way, behind the same
OFF flag.

## Safety model (how giving-away / spam / claims are made impossible)

- **No send:** there is no code path that sends an email/SMS/DM. `he-sales-gmail`
  `send()` is hard-refused (SEND capability off, not connected). Drafts only.
- **No auto-sample:** samples require a serious pipeline stage, an owner actor,
  and fit the monthly budget (or an audited override). Code/AI can only *flag* a
  candidate.
- **No claims:** every draft passes the claim firewall and fails closed. Safe
  cosmetic language passes; disease/treatment/inflammation/etc. is blocked.
- **No owner impersonation:** two pipeline transitions (outreach approval, sample
  approval) require `ownerApproved===true`; AI/code can propose, never approve.
- **Untrusted input:** lead names, pasted notes and replies are treated as data;
  prompt-injection in them yields at most an inert draft or a benign label
  (proved in `sales-adversarial-ext20j.spec.js`).
- **Cheap by design:** deterministic code does counting/sorting/scoring/dedupe/
  metrics with zero AI calls; only drafting/classification route to a paid tier,
  with budgets and a hard stop.

## Tests (`tests/specs/sales-*.spec.js`, Node-only, synthetic)

ai · leads · pipeline · claims · samples · outreach · replies+followup · cost ·
import · gmail · analytics · adversarial. All pass locally. They cover: legal/
illegal state transitions, owner-approval gates, budget guard + override, ROI
actual/unknown, claim obfuscation + prompt injection, UNKNOWN-first reply
classification, follow-up suppression, dedupe, send-disabled guards, safe
metric denominators, and cost routing / hard budget stop.

## Not built yet / owner-gated (do NOT assume done)

- **UI pages** (Growth Command Center, Wholesale Leads, Pipeline board, Approval
  inbox, Samples, Sales Analytics, Agent Activity): the engine is ready to wire
  into `owner-login.html`; the page wiring is a separate reviewed step.
- **Dedicated sales Gmail**: owner chooses the address and approves read/draft;
  SEND stays a separate future decision. No real account connected.
- **Real monthly sample budget**, wholesale price, MOQ, MSRP, shipping terms,
  line-sheet facts, claims, certifications: owner/legal.
- **Website + Shopify** contracts (abandoned-cart, newsletter capture, inquiry):
  dashboard-side interfaces only; the website is a separate repo, untouched.
- **Provider keys** (Claude/OpenAI): configured securely by the owner later.

## Rollout order (safe)

1. (local, done) engine modules + tests.
2. wire read-only pages behind a feature flag; owner reviews a PR (live deploy).
3. owner picks the sales mailbox + approves READ+DRAFT (SEND still off).
4. owner sets the real sample budget, outreach caps, and approved product facts.
5. a single manual "copy approved draft → owner sends it themselves" step.
6. only later, and only if the owner wants it, an approved scheduled sender with
   caps + pause switch (same pattern as the existing Supabase agents).

## Rollback

Every module is additive and isolated under `assets/sales/` with its own spec;
none is loaded by a shipped page yet, so reverting any `sales:` commit removes
that module with no effect on the live dashboard.
