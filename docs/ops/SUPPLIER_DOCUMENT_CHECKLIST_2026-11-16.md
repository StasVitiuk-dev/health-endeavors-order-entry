# Supplier document checklist

Status: CURRENT · 2026-11-16 · For: Stas · Staging only (made-up data, read-only).
Built from your decision of Nov 16. Switch: "Supplier documents" on the Feature
Flags page (off by default); the section appears on the Suppliers page.

## The checklist (as configured now)

| Applies to | Document | One copy per | Expected when |
|---|---|---|---|
| **Every purchase** | Quote or order confirmation | purchase order | the order has been placed (ordered, shipped or received) |
| | Supplier invoice | purchase order | the order has shipped or arrived, or any payment has been made |
| | Packing slip | purchase order | the order has arrived |
| **Lotion lab** | Approved ingredient list | formula | always |
| | Batch or lot record | batch | always |
| | Certificate of analysis | batch | always |
| **Bottles and pumps** | Component specification | component | always |
| **Printed labels or direct bottle printing** | Approved artwork | artwork | always |
| | Printer proof | artwork | always |

A draft, cancelled or deleted purchase order asks for nothing ("where applicable").

## How a supplier gets its list

- Every supplier gets the purchase documents for each of its purchase orders.
- A supplier's **kind of work** adds the rest. By default it follows the supplier
  type already on the Suppliers page: *lab* → lotion lab; *packaging* → bottles
  and pumps. The other types (supplier, manufacturer, freight, other) get the
  purchase documents only.
- A supplier can be given its own list of kinds, so one company can be both
  "bottles and pumps" and "direct bottle printing", and a label printer (which
  has no supplier type of its own today) can be given "labels / printing".

## What the screen shows

- For each supplier: how many documents are **missing**, how many are **awaiting
  review**, and how many are approved.
- By default only the documents that need work; "Every document" adds the
  approved ones with who reviewed them and when.
- Each line is one of:

| Shown as | Meaning |
|---|---|
| Missing | nothing is on file |
| Awaiting review | a copy has arrived and nobody has reviewed it |
| Rejected — needs a new copy | reviewed and refused, with the reason; counts as missing |
| Expired — needs a new copy | approved, but past its valid-until date; counts as missing |
| Approved | reviewed and approved, with the reviewer's name and the date |

A document only counts as approved when it carries **who** approved it and
**when**. One marked "approved" with no name on it is shown as awaiting review.
Reviewing is for the owner or an administrator; a rejection must say why.

## It is configurable

The checklist is a short list of data, not code paths: a document can be added,
removed or moved to another kind of supplier, and a new kind can be added. A
checklist that is broken (a document with no name, the same document listed
twice, an unknown kind) is refused outright rather than half-used.

## Example in staging (made-up suppliers)

| Supplier | Kinds | Missing | Awaiting review | Approved |
|---|---|---|---|---|
| SYN Lotion Lab | lotion lab | 3 | 2 | 5 |
| SYN Bottles & Pumps Co | bottles and pumps + direct bottle printing | 3 | 1 | 2 |
| SYN Label Printer | labels / printing | 1 | 0 | 1 |
| **Total** | | **7** | **3** | **8** |

## Tests

- `tests/specs/supplier-docs-ext21.spec.js` — 11 tests of the rules.
- `tests/specs/supplier-docs-wiring-ext21.spec.js` — 5 tests of the screen:
  switch off shows nothing; the journey; names and contrast in light and dark;
  phone size.

## What I need from you

1. Is the list above complete? Anything to add for every supplier (for example
   an insurance certificate or a W-9)?
2. Which documents expire, and after how long (for example a certificate of
   analysis does not; an insurance certificate does)?
3. Who may review a document: only you, or also an administrator? (Now: both.)
4. Should a purchase order be blocked from "received" while its packing slip is
   missing, or only flagged? (Now: only flagged.)

## Not done yet

- **Storage.** These records are not in the database. The existing documents
  table knows a supplier and a fixed category, not a purchase order, a batch or
  a review. Storing them needs its own database draft, which I will write once
  you confirm the list.
- Uploading a file from this screen, and the "review" button itself (the rule
  is built and tested; the screen is read-only for now).
- Formulas, batches, components and artworks come from the example data; in
  production they would come from products, lots and purchase orders.

## Storage (added later on Nov 16)

Storing these documents, with owner-only review enforced by the database, is
described in `SUPPLIER_DOCUMENT_STORAGE_2026-11-16.md` (drafts/36, not installed).
