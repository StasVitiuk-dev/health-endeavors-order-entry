# Trusted Types hardening — Inventory and Returns screens

Status: **CURRENT** (2026-10-18). Local/branch work, not deployed. One focused, reviewable change to the Inventory screen only. No production, no merge, no business-behaviour change.

## What changed

`loadInventory()` in `assets/owner-login-app.js` built its markup as HTML strings assigned to `innerHTML` (the dropdown of products, the product rows with their edit forms, and the stats tiles). Every dynamic value was already HTML-escaped with `esc()`, so there was no injection defect — but string-to-`innerHTML` assignment is blocked under Trusted Types enforcement regardless of escaping.

The three `innerHTML` sinks were converted to the existing safe DOM builder `h()` + `replaceChildren()` (the EXT19 helper that uses `createElement`/`setAttribute` and adds data as text nodes, and refuses `on*`/`srcdoc` attributes). The screen now builds real nodes; data can never become markup.

- `invProduct` dropdown → `h('option', …)` nodes
- product rows (name, badges, lots, threshold input, the hidden Edit-product form) → `h(...)` tree
- `inventoryStats` tiles → `h(...)` nodes

Classes, `data-*` attributes, input values/placeholders and element structure are byte-for-byte equivalent, so the existing event wiring (`.closest('[data-product-id]')`, `.querySelector('.prodEdit')`, `.peName`, `.saveThresholdBtn`, etc.) works unchanged.

## Measured result

| | before | after |
|---|---|---|
| `innerHTML`/`insertAdjacentHTML` in `loadInventory()` | 3 | **0** |
| DOM sink gate (whole app) | 52 reviewed interpolations, 0 dangerous | 51 reviewed, 0 dangerous |
| Inventory dynamic data rendered as HTML strings | yes (escaped) | no (text nodes) |

## Tests (all on the current branch)

- `inventory-safety.spec.js`, `stock-functions`, `write-path-inventory` behaviour, `search-dashboard-escaping`, `product-lifecycle`: **pass** (55 + 25 across the two runs; 0 failed).
- The write-path matrix/JSON/inventory artifacts were regenerated (`node tests/tools/write-paths.js --md/--json/--inventory-md`): the only diff is line-number shifts — same 105 write paths, same tables, operations and guards, confirming no write behaviour changed.
- Gates: DOM sink gate PASS, regex audit PASS, type gate PASS (0 gated), inline-styles PASS, docs PASS, status manifest PASS.
- Asset version hashes refreshed in `owner-login.html` (`refresh-asset-versions.js`).

## Appearance / behaviour

No visual change (same classes and CSS), same event wiring, same keyboard/responsive behaviour, same data semantics. Hostile product names/SKUs/lot numbers render as literal text (they did before too, via `esc()`); now they are never parsed as HTML at all.

## Remaining before Inventory is fully Trusted-Types-enforceable

The app does not yet install a Trusted Types policy / `require-trusted-types-for` header, and other screens still use `innerHTML`. So enforcement is not turned on yet — this change makes the **Inventory render** enforcement-ready, one screen as scoped. The adjustments sub-panel (`loadInventoryAdjustments`) and other screens remain for later, one at a time.

## Rollback

Single-commit change. To revert: `git revert <this commit>` on the branch (restores the previous `innerHTML` rendering and the prior asset-version hash), or re-checkout the previous `assets/owner-login-app.js`, `owner-login.html` and the three `docs/ops/WRITE_PATH_*`/`MUTATION_WRITE_PATH_INVENTORY.json` files. No database or production effect either way.

## Recommended next single screen

**Returns** — it has a similar row+decision-button render with dynamic customer/order text and is adjacent to the already-converted write paths, so the same `h()` pattern applies with modest risk.


---

## Returns screen (EXT20G, 2026-10-18)

Same pattern applied to `loadReturns()` in `assets/owner-login-app.js`: its 3 `innerHTML` sinks — the order dropdown, the stats tiles, and the return rows with their per-status action controls (Approve/Reject, disposition select + Mark Received, refund input + Mark Refunded, Close) — were converted to the `h()` builder + `replaceChildren()`. All values were already `esc()`-ed; now they are text nodes.

Classes, `data-*` attributes (`data-return-id`, `data-status`, `data-line-value`, `data-item-sku`, `data-quantity`, `data-order-label`), input placeholders and structure are identical, so the existing handlers (`.decideReturnBtn`, `.markReceivedBtn`, `.markRefundedBtn`, `.advanceReturnBtn`, `.dispositionSelect`, `.refundAmountInput`) work unchanged.

- Returns `innerHTML` sinks: 3 → 0
- DOM sink gate: still PASS, 0 dangerous; 7 now-stale reviewed entries removed from `dom-sinks-reviewed.json` (43 reviewed remain)
- Tests: search-dashboard-escaping + write-path-inventory pass; write-path artifacts regenerated (105 paths unchanged, line-number shifts only); security:quick PASS; type/styles/status/docs/changelog gates green; asset versions refreshed.
- Rollback: `git revert` the Returns commit.

Recommended next single screen: **Purchase Orders**.
