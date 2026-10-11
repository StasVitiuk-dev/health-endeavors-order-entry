# Numeric field contract (number boxes and money)

**Status:** CURRENT on branch `claude/platform-deep-readiness-extension-4` (2026-10-06, extension 4, workstreams Y and Z). Not live until merged. Enforced by `tests/specs/numeric-contract.spec.js` (static) plus page and unit tests.

## Rules

1. Every number box has a **step** and a **lower limit**. The exceptions are the signed stock change and business-rule values, which are checked in code.
2. Every number box has an **upper limit**: a `max` attribute, or a `numberInputError` check in code. That check always applies a max: the one given, or 1,000,000,000 by default.
3. **Money is whole cents.** Prices, shipping, tax, expenses and refunds are refused with 3 or more decimals. **Unit costs** (product cost, PO line unit cost) may use up to 4 decimals, e.g. $0.125 a cap.
4. **Totals saved to the database are rounded to cents**: the PO grand total (logged as the delivery's expense) and the manual order total. Displayed money always goes through `fmtMoney`.
5. Blank is refused unless the field is optional. A blank box never becomes 0.
6. Quantities that go into stock are **whole numbers**: stock changes, PO lines linked to a catalogue product (checked before receiving), and manual order quantities.

## Field table

| Page / box | Min | Max | Decimals | Checked where |
|---|---|---|---|---|
| Add product: cost / retail / wholesale | 0 | 1,000,000 | 4 / 2 / 2 | code (EXT4; it had only browser checks with no max) |
| Edit product: cost / retail / wholesale | 0 | 1,000,000 | 4 / 2 / 2 | code |
| Stock change (Inventory) | −1,000,000 | 1,000,000 | whole | code |
| Low-stock alert level | 0 | 1,000,000 | whole | code |
| Expense amount | > 0 | 10,000,000 | 2 | code + browser |
| PO line quantity / unit cost | > 0 / 0 | 1,000,000 / 10,000,000 | any (catalogue lines must be whole to receive) / 4 | code |
| PO shipping / tax | 0 | 10,000,000 | 2 | code |
| Refund amount (Returns) | 0 | 1,000,000 and ≤ the line's value | 2 | code (EXT4; 10.009 used to be saved) |
| Business rule value | 0 | per-rule limits, else 1e9 | per rule | code |
| Manual order: quantity | 1 | 100,000 | whole | browser (form) |
| Manual order: price / shipping / tax | 0 | 1,000,000 | 2 | browser (form) |

## Fixed in extension 4

- **PO grand total in floating point:** 3 × $0.10 was saved as an expense of 0.30000000000000004. It is now rounded to cents.
- **Refund amount:** 3-decimal and huge values were accepted. Now whole cents, at most 1,000,000.
- **Add product:** no upper limit, and it differed from the edit form. Now the same checks.
- **Manual order form:** upper limits added.

## Known limits

- Whether the database columns are `numeric(12,2)` or plain `numeric` is **not verified**. Query C covers column types only for some tables. The dashboard now never sends more than cents for money it calculates.
- The manual order page relies on the browser's form checks (min, max, step). A script that bypasses the form would get through; row-level security and database rules are the real guard.
