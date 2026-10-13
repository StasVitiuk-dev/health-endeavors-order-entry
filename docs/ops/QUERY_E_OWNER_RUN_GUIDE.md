# Query E: owner run guide (stock reconciliation)

**Status:** PREPARED (2026-10-07, extension 6). **Not run on production.** Claude never runs it. If and when you choose, you run it yourself; it only reads.

## What it is for

It checks that your records agree with each other:
- each product's stock against its stock history;
- each received delivery against the stock it added and the expense it logged;
- orders saved without their items (these still count as revenue).

It is the "before and after" picture to keep around any database change (R1–R5, the PO line guard, request keys).

## Why it is safe

- **One SELECT statement.** It cannot change, delete or create anything. The automatic check `sql-readonly.spec.js` rejects any writing word in it. Locally it also ran inside a "read only" transaction, which the database itself enforces.
- **No customer data in the output:** only counts, product SKUs, purchase-order numbers and order numbers with totals. No names, e-mails or addresses.
- **You can stop it at any time.** It holds no locks that block the dashboard, and nothing is left half-done.
- Tested on synthetic data: silent when everything agrees, and it found each problem planted on purpose (`local-test/reconciliation_test.sh`, 24 checks).

## How to run it (about 1 minute)

1. Supabase dashboard → **SQL Editor** → **New query**.
2. Open `docs/ops/sql/04_READONLY_E_stock_reconciliation.sql`, copy all of it, paste.
3. Click **Run**.
4. **Export → Download CSV**. Before sharing, look it over: it should contain only the three columns `section`, `check_name`, `result`.

## What NOT to click

Nothing else. Do not choose "Run with RLS disabled" or any option that changes the role. Do not edit the text.

## How to read the result

| Result | Meaning |
|---|---|
| `0` or `none` | Nothing found. The goal |
| Stock differs from history | Could be an opening balance entered before history existed, or a lost update. Compare with what you know |
| Delivery with **more than one** expense | Possible duplicate from a retry. Check on the Accounting page ("Possible duplicate delivery costs") |
| Delivery with **no** expense, or a different amount | A receive that stopped part-way, or a change after receiving |
| A line not fully received | The race fixed by the PO line guard, or a part-way stop |
| Orders with no items | An order saved before its items failed. The manual-order page lists them for the person who entered them ("Finish this order") |

## What happens after you send it

Claude explains each non-zero line in plain English and proposes the next safe step. Nothing is ever fixed directly in production without your separate approval.
