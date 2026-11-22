# Review item 1 of 4 — SQL draft 32: invoice storage (revised Nov 22)

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · revised 2026-11-22 after your review
Nothing here has been run in production. I never run it myself: you run it, after approving it.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/32_DRAFT_invoices.sql` (install) | 950 | `7569c1ca765cc175` |
| `docs/ops/sql/drafts/33_DRAFT_rollback_invoices.sql` (undo) | 75 | `5fff855b59dc5064` |

Previous version (Nov 16): `7e819373a4b9479c` / `65862e5a46ddea54`, now replaced.
Before running, the file you paste must show the same fingerprint
(Terminal: `shasum -a 256 32_DRAFT_invoices.sql`).

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by
you. Tested only on throwaway local copies with made-up data.

## What changed after your review (Nov 22)

| Your point | What the revised draft does | Shown by |
|---|---|---|
| **Audit history** | Production's own audit trigger (the one on `tasks`, read at install time) is attached to invoices, payments and the number counter, so every insert, change and delete lands in `audit_log` with who and when. A readable history table, `invoice_events`, records creation, each draft change (which fields), issue (number, terms, who approved credit), void (reason), every payment and reversal (amount, method, reference) and every status change. Nobody can write, change or delete that history by hand, owner included. The creator and creation time are set by the database and can never be changed; each change records who made it. If the audit trigger on `tasks` is missing or of an unexpected kind, the install stops before changing anything. | test sections "the history", "who made it and when", "safe install" |
| **Invoice contents and amounts** | Lines must be in the supported format: at most 200, only the known fields; a SKU or a description; a whole-number quantity from 1 to 100,000; a unit price in whole cents from 0 to 1,000,000; a discount no larger than the line is worth; a line total exactly quantity × price − discount. The lines must add up to the subtotal; the order discount cannot exceed the subtotal; a confirmed tax must equal the rate × the taxable amount (shipping included only when it is taxed), rounded to the cent exactly as the dashboard rounds. Before issue: at least one line, and billing details with a name and an address (address lines, or a city and state). | test sections "invoice contents", "before issue" (19 refusal cases) |
| **Net 14 approval** | Enforced inside the guard, which every write goes through, so a direct change of the row is held to the same rule as `issue_invoice()`. Net 14 needs an explicit credit approval given at the moment of issue; the database records who gave it (the person issuing, never a typed name) and when, and the approval and terms can never change afterwards. A credit approval typed into a draft is cleared. | test section "Net 14 on every path" |
| **Invoice numbering** | HE-2026-0001 … HE-2026-9999, then HE-2026-10000 with all five digits. Each year has its own counter, so the first invoice of a new year is HE-YYYY-0001 whatever the previous year reached. | test section "numbers past 9,999" |
| **Permissions** | Staff now see only invoices they created, or invoices for orders they can see (the orders table's own rules decide that, as with supplier documents). They can start a draft only for an order they can see. Payments are visible to the owner and administrators only. See "What staff can see" below. | test section "staff see what they created …" |
| **Safe installation** | Before creating anything, the install compares any existing invoice table with the exact expected columns (name, type, required) and rules. If one differs, it stops, changes nothing, and names what differs (a missing or extra column, a different type, a missing rule). The expected list is checked against a fresh install by the test, so it cannot drift. | test section "safe install" |
| **Rollback** | Refuses, removing nothing, while any issued, paid or void invoice exists. Also refuses while any **draft** exists, unless deleting the drafts is authorized in the same session with `set he.rollback_delete_draft_invoices = 'yes, delete the drafts';` (the message says how many). It first takes the strongest lock on the invoices table: an issue already in progress finishes first and is then seen and refused; a new issue waits. | test section "rollback" (including an issue running at the same time) |

## Payment status: how it works now

The first version allowed "partially paid" and "paid" to be typed without any
amount or reference. The revised draft removes that:

- A payment is recorded with `record_invoice_payment()`: amount, date received,
  method (check, ACH, card, cash, wire, other) and reference (check number,
  transfer reference). Owner or administrator only.
- The invoice's **amount paid** and **status** follow the recorded payments
  automatically: nothing paid = issued; part paid = partially paid; all paid = paid.
  Typing a status or an amount paid is refused.
- A payment above what is still owed is refused. Each submission carries a
  request key, so pressing Save twice, or again after a lost reply, records once.
  Ten payments sent at the same moment are taken one at a time and never exceed the total.
- A payment entered in error is corrected by a **linked reversal** with a written
  reason. The original payment stays on record; the status goes back accordingly.
  Payments are never edited or deleted.
- An invoice with payments cannot be voided: reverse the payments first, or issue a
  credit note.
- Every payment and reversal appears in the invoice history and in `audit_log`.

This fits the dashboard's reconciliation view (blueprint #37, matching issued
invoices to payments), which today works on example data only.

## What staff can see (your question)

An invoice row holds:
- who is billed and where it ships (name, address, and anything else typed into
  the billing details);
- the account reference and the order link;
- every line (SKU, description, quantity, unit price, discount, lot number);
- subtotal, discounts, shipping, tax rate and place, total;
- whether it is tax-exempt, with the exemption document text (which can include
  a certificate number);
- terms, due date, who issued it and who approved credit;
- the amount paid so far;
- for a void invoice, the reason.

| | First version (Nov 16) | Revised (Nov 22) |
|---|---|---|
| Staff | every invoice | invoices they created, and invoices for orders they can see |
| Payments (method, reference) | not modelled | owner and administrators only |
| Owner, administrators | everything | everything |

Today, staff can see every order (they work the orders), so in practice they
still see the invoices for all orders. That is consistent: an invoice holds little
that the order does not, except the billing address, the unit prices and
discounts, the exemption document text, the terms and the amount paid.

If you want staff not to see some of those (for example the exemption document or
the amount paid), it can be done by column. That is a separate decision; it is
not in this draft.

**To confirm before production:** the exact rules on production's `orders` table.
The local copy uses a stand-in (every active staff member sees every order).

## Migration order and dependencies

- Needs, in production: `auth.uid()`, `is_owner_or_admin()`, `is_active_staff()`,
  the `orders`, `tasks` and `audit_log` tables, and the audit trigger on `tasks`.
  If one is missing, it stops and changes nothing.
- Depends on no other draft; independent of drafts 34 and 36.
- Run it only when you are ready to issue real invoices, which also needs the tax
  setup. Installing earlier is harmless but brings nothing.
- Safe to run twice (the second run checks the shape and changes nothing).

## Staging results (throwaway database, made-up data)

| Test | Result |
|---|---|
| `local-test/invoices_test.sh`: install and safe install, permissions, contents (19 refusals), tax, Net 14 on every path, numbering past 9,999, creator protection, payments and reversals (including 10 at once), history and audit, voiding, 20 issued at once, 12 at once on one draft, rollback (including an issue during the rollback) | **161 of 161** (was 87) |
| `local-test/invoice_store_adapter_test.js`: the dashboard's code against this draft | 34 of 34 |
| `local-test/restore_with_drafts_test.sh`: a backup restored with this draft keeps every rule, payment and history entry | 34 of 34 |
| Dashboard tests for invoices, tax and reconciliation (computer and phone size) | 198 passed |
| Tax rounding: the dashboard compared with exact rounding on random amounts and rates | 12 differences in 2 million before the fix below; 0 in 300,000 after it; the half-cent example is in the database test |

Found and fixed on the way: the dashboard rounded tax with ordinary
floating-point arithmetic, which was a cent off in about 6 cases per million
(for example, $13,625.00 at 13.62% is exactly $1,855.725: the database says
$1,855.73, and the dashboard said $1,855.72). Both now use the same exact rounding.

## After running: checks (read-only, paste into the SQL editor)

```sql
select to_regclass('public.invoices') is not null as invoices_table,
       to_regclass('public.invoice_payments') is not null as payments_table,
       to_regclass('public.invoice_events') is not null as history_table,
       (select count(*) from public.invoices) as invoices,
       (select count(*) from pg_trigger where tgname = 'invoices_audit') as audit_trigger,
       has_table_privilege('anon', 'public.invoices', 'select') as visitors_can_read;
```
Expected: `true | true | true | 0 | 1 | false`. Anything else: stop and send me a screenshot.

## Rollback and recovery

- **Nothing issued, no drafts:** run file 33. It removes everything 32 added.
  Running it twice is harmless.
- **Drafts exist:** file 33 refuses and tells you how many. If you decide they can
  go, run `set he.rollback_delete_draft_invoices = 'yes, delete the drafts';` and
  then file 33, in the same SQL editor session.
- **Anything issued, paid or void:** file 33 refuses, because those are business
  records. Instead:
  1. switch invoice storage off in the dashboard;
  2. export `invoices`, `invoice_payments` and `invoice_events` (Export CSV);
  3. I prepare a reviewed fix.
- `audit_log` keeps everything it recorded in every case.
- Restoring a whole Supabase backup is the last resort, because it rolls back everything.

## Honest limits

- "Approved for credit" is the issuer's explicit statement, recorded with their
  name and time. There is no list of credit-approved accounts; adding one is a
  separate decision.
- Production's audit function is reused as it is. Its exact behaviour (what it
  writes) is production's; the install only checks that it is an after-change
  trigger for inserts, updates and deletes.
- The dashboard's invoice code does not yet call the payment functions: payments
  can be recorded in the database (tested) but there is no payment screen yet.

## Your decision

- [ ] Approve running draft 32 in production, or
- [ ] Not yet.
