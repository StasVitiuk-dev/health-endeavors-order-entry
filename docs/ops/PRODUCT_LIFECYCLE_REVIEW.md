# Product lifecycle review: delete, deactivate, reactivate

**Status:** CURRENT (2026-10-06, extension 3, branch `claude/platform-overnight-extension-3`). Branch only; not live.

## How a product can be removed today

| Action | Where | What it does | Reversible |
|---|---|---|---|
| **Deactivate / Reactivate** | Inventory → Edit product | Sets `is_active` false/true, only while it still has the value the page showed (guarded) | Yes |
| **Status** (draft / active / discontinued) | Inventory → Edit product → Save | Saved with the other product fields, only while the status is still the one the form opened with (fixed in X3-01) | Yes |
| **Delete** | Inventory → Edit product → Delete (two presses) | Permanently removes the product and its (all-zero) stock row, only if nothing uses it | **No** |
| **Delete via R5** (`delete_unused_product`, draft, not installed) | Database function | Same checks inside one transaction | **No** |

## What delete checks, and what it protects

| Reference to the product | How it is linked | Dashboard delete (browser) | R5 (database draft) |
|---|---|---|---|
| Stock row (`inventory`) | Foreign key | Refused if any bucket ≠ 0 (fresh read); removed only while every bucket is still 0; put back if the product delete then fails | Same, in one transaction |
| Purchase-order lines | Foreign key | Refused (checked first) | Refused |
| Lots | Foreign key | Refused | Refused |
| Stock history (`inventory_adjustments`) | Foreign key | Refused | Refused |
| Recalls | Foreign key | Refused | Refused |
| **Order lines (`order_items`)** | **SKU text only, no foreign key** | **Refused since EXT3 (was allowed)** | **Refused since EXT3 (was allowed)** |
| **Quality checks** | `quality_checks.product_id`; whether it has a foreign key is unknown (Query A did not cover the table) | **Refused since EXT3** | Not checked (table not in the verified schema): **QUERY C** |
| Returns | Through the order line (SKU) | Covered by the order-line check | Covered |
| Expenses | No product link | — | — |
| Documents | Supplier or general only (`related_type`) | — | — |
| Tasks | `related_type` / `related_id` free text, no foreign key | Not checked: a task could point at a deleted product (low impact; it just shows an id) | Not checked |
| Change history (`audit_log`) | Keeps a copy of the deleted row | Kept: the delete itself is recorded | Kept |
| Reports | Accounting/Tax use orders and expenses, not products | Unaffected | Unaffected |

## Findings

| Id | P | Class | Finding | Outcome |
|---|---|---|---|---|
| X3-13 | P2 | SAFE NOW | **A sold product could be deleted.** Order lines name the product by SKU text, so the database's foreign keys don't stop the delete. Its sales history would then point at nothing, and a later return of it could not be restocked ("no product with that SKU") | Dashboard and R5 now refuse with "already sold". R5 test in `16_…` (fails on the old function); dashboard test in `product-lifecycle.spec.js` |
| X3-14 | P3 | SAFE NOW (dashboard) / QUERY C (database) | Quality checks referencing the product were not consulted | Dashboard refuses. Query C section 9 will show whether the database also has a foreign key |
| X3-15 | P3 | DEFER | Tasks can name a deleted product by id (free text) | Low impact; not changed |
| X3-16 | P3 | OWNER DECISION | **Should permanent delete exist at all?** Today it is limited to products that were never used (never ordered, stocked, received, recalled or checked), i.e. typing mistakes. Everything else must be deactivated. Recommendation: keep it limited to that, as now. An alternative is "archive only" (no hard delete); that is your call | Not changed |

## Proven by tests

- Browser: refused while stock exists; refused while in use (each reference type); employee refused before anything is sent; stale stock (arrived after the page loaded) never thrown away; stock row put back when the product delete fails; sold product refused (EXT3).
- Database (R5 draft):
  - lock order product → stock row (no deadlock with receive or quarantine: stress S8, S15, S20);
  - permission check before anything;
  - any non-zero bucket counts as stock;
  - foreign-key refusal rolls the stock-row delete back;
  - sold product refused (EXT3).
