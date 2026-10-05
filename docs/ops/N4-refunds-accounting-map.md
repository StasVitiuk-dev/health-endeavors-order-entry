# N4: how orders, returns, refunds and the money pages interact today

**Status:** map and prepared options, 2026-10-05. **The accounting policy is the owner's decision.** The dashboard ships with today's behaviour.

## 1. Where each number comes from

| Page / tile | Reads | Counts as revenue | Refunds |
|---|---|---|---|
| Accounting | `orders` (`total`, `status`, `placed_at`), `expenses` | Orders not deleted, whose status is not "cancel…" and not "refund…" (unless "partial") | Only through `orders.status`. A fully refunded order is listed under "Cancelled / refunded (excluded)". A "partial" refund keeps the **full** total and is listed under "needs review". |
| Tax Records | Same as Accounting, plus `tax_total`, `raw_data.shipping_address.province` | Same rule (shared `classifyOrderStatus`) | Same |
| Business Health, Daily Summary | `orders` (`total`, `status`) | Status is not exactly `cancelled` (**a different rule**: refunded orders still count) | None |
| Returns page | `returns` (`status`, `refund_amount`, `refunded_at`), `order_items` | — | "Mark Refunded" records `refund_amount` on the return. **No money page reads it.** |

## 2. The gap

- A refund recorded on the Returns page **never reduces revenue**. For manual and wholesale orders, nothing changes the order's status, so profit is overstated by every such refund.
- Business Health / Daily Summary use "exactly `cancelled`", while Accounting/Tax use the keyword rule. A `refunded` order counts as revenue on the home tiles but not on Accounting. Unifying them is part of the same decision.
- A partial refund keeps the full order total on Accounting and Tax (flagged for review only).

## 3. Prepared options (both implemented and tested; switch = one line)

`ACCOUNTING_REFUND_POLICY` in `owner-login.html`:

| Option | Behaviour | Risk |
|---|---|---|
| `status_only` (**current**) | Revenue changes only via `orders.status` | Overstates profit by refunds recorded only on Returns |
| `subtract_return_refunds` | Also subtracts `returns.refund_amount`, dated by `refunded_at`. Never subtracts a refund on an order that the same list already excludes by status. An extra tile shows the refunds subtracted. | A refund for an order placed in an earlier period reduces this period (cash-basis style). A Shopify refund that also sets the order status partially refunded would be counted once by status (full total kept) and once by Returns. |

**Tests:**
- `tests/specs/refund-policy.spec.js`: unit tests for both options, plus a browser test of each option on the Accounting page
- `docs/ops/sql/drafts/13_DRAFT_report_totals.sql`: the same rule in SQL, for when totals move into the database (BLOCKED ON QUERY A/B), with local tests in `14_…`

## 4. Questions for the owner (or the accountant)

1. Should Returns refunds reduce revenue (option B)? If yes: in the period of the refund, or of the original sale?
2. Should Business Health / Daily Summary use the same exclusion rule as Accounting?
3. Partial refunds: keep "full total + needs review", or subtract the recorded refund amount?
4. When Shopify sync arrives: which is the source of truth for refunds, Shopify's refund events or the Returns page? (One must not double the other; see `integration-service-architecture.md`.)
