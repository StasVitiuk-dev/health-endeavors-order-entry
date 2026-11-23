# Wholesale storefront handoff — requirements for the separate website session

Status: CURRENT (2026-11-08). This is a **handoff spec**, not an implementation.
The public storefront is built in the **separate website session**, not in this
dashboard repo (per CLAUDE.md the website keeps its own `docs/website/`). This
file records what the website session must build and the constraints it must
meet, drawn from the Nov 7 brief. Nothing here authorizes building the storefront
here, buying print materials, or any production/hosting change.

## What exists on the dashboard side (reuse, don't rebuild)
- Line-sheet copy + wholesale reply drafting already live in the Sales & Growth
  engine ("Commercial & Line Sheet" panel, `he-sales-ai` line-sheet drafter,
  `out-linesheet` advisory agent), all draft-only, claim-firewalled, flag-OFF.
- The dashboard can produce an **owner-approved line sheet** (general prices,
  suggested shelf price, case sizes, minimums, ordering instructions) as a draft
  for the owner to hand off. Individual terms/invoices/order history stay in the
  dashboard behind individual accounts — never on the public storefront.

## Business card + QR
- One QR on the card → **one permanent first-party landing URL** (owner-owned
  domain; never a third-party shortener, so it can't be hijacked or expire).
- Landing page offers two routes:
  1. **Shop Sea Foam** → public retail storefront (no gate).
  2. **Wholesale for Stores** → PIN-gated wholesale price sheet (below).
- Card carries brand logo + contact only; **no changing wholesale prices on the
  card** (prices move; the card is permanent).
- Owner plans a **printed QR proof** (scan it on a real phone, confirm it resolves
  to the right landing page) before buying cards/brochures.

## Wholesale price-sheet gate (the security-sensitive part)
- **Server-side** verification of a **privately shared, rotatable 4-digit PIN**.
  The PIN is given to a store privately (not printed publicly). Never verify the
  PIN in client JS; the gate and the prices live behind a server endpoint.
- **Attempt limits:** throttle + lock after a small number of wrong tries
  (e.g. 5), per IP/session, with a cooldown — a 4-digit PIN is brute-forceable
  without limits. Log attempts for the owner.
- **Rotatable:** the owner can change the PIN; old PIN stops working immediately.
- **Cache behavior — critical:** wholesale prices must **never appear in any
  public response, CDN cache, search index, or pre-rendered HTML.** The gated
  price sheet is served only after a verified PIN, with `Cache-Control: no-store`
  (and not through a cacheable public path). Public pages and their caches
  contain general info only.
- **Public content is general only:** general prices / suggested shelf price /
  case sizes / minimums / ordering instructions. Anything store-specific
  (individual terms, invoices, order history) requires an individual account on
  the dashboard, not the storefront.
- **Mobile checks:** the gate + price sheet must work on a phone (most buyers
  scan the QR on mobile): readable price table, tap-friendly PIN entry, no
  horizontal scroll, works on iOS Safari.

## In-person two-sample plan (preserve)
- This first campaign hands samples over **in person** to interested stores — it
  is NOT a shipped-sample program. Each kit: **one Honey Milk + one Vegan sample,
  plus a photo brochure and a business card.** The storefront does not ship
  samples; in-person handoffs are tracked in the dashboard pipeline
  (SAMPLE_SENT = handoff) separately from any future carrier shipments.

## Acceptance (for the website session)
Printed-QR proof scans to the correct landing page; the two routes work; the
wholesale PIN gate verifies server-side with attempt limits and rotation; no
wholesale price is reachable without a verified PIN or appears in any cache/
index; the gate and price sheet pass on a real phone; the line sheet shows only
owner-approved general values. All prices in this handoff's examples are
**provisional** (see `NOV7_BUILD_HANDOFF_2026-11-07.md` planning inputs) and must
be confirmed by the owner before any public use.

## Blocked here / owner decisions
- The storefront build, the domain, hosting, the server-side PIN endpoint, and
  any real prices are the website session's + owner's, not this dashboard's.
- Final wholesale prices, case sizes, minimums, and the PIN itself are owner
  inputs.
