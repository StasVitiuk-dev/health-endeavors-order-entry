# Review item 1 of 4 — SQL draft 32: invoice storage

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · 2026-11-16
Nothing here has been run in production. I never run it myself: you run it, after approving it.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) | Last changed in |
|---|---|---|---|
| `docs/ops/sql/drafts/32_DRAFT_invoices.sql` (install) | 375 | `7e819373a4b9479c` | `1347489` |
| `docs/ops/sql/drafts/33_DRAFT_rollback_invoices.sql` (undo) | 50 | `65862e5a46ddea54` | `4c5efc9` |

The full text is in the review package (`5-sql/item-1/`). Before running, the file
you paste must have the same fingerprint (Terminal: `shasum -a 256 <file>`).

## Target environment

The Health Endeavors **production** Supabase project (the one the live dashboard
uses), in Supabase → SQL Editor, by you. Tested only on a throwaway local copy
with made-up data.

## Purpose

Store invoices for real: drafts, issuing with a number of the form
HE-YYYY-NNNN, voiding with a reason. Today invoices exist only as a simulated
preview. Your decisions applied: pending tax stores no figure and cannot be
issued (Nov 16); numbers are never reused (Nov 14); only you or an administrator
issue or void (Nov 14).

## What it changes

Adds two new, empty tables (`invoices`, `invoice_counters`) and the functions
`issue_invoice` and `void_invoice`, plus guards. It changes **no existing table,
row, permission or screen**. Nothing in the dashboard uses it until a separate,
reviewed switch is turned on. Locks: none on existing tables. Takes seconds.

## Migration order and dependencies

- **Depends on** these existing production pieces: `auth.uid()`,
  `is_owner_or_admin()`, `is_active_staff()` and the `orders` table. The file
  checks them first and **stops, changing nothing**, if one is missing.
- **Depends on no other draft.** It is independent of drafts 34 and 36; they can
  run in any order, each after its own approval.
- **When:** only when you are ready to issue real invoices, which also needs the
  tax answers (order 1 in `TAX_SETUP_QUESTIONS_2026-11-16.md`). Installing earlier
  is harmless but brings nothing.
- **Safe to run twice:** a second run changes nothing.

## Who can do what (enforced by the database)

| Who | Read | Prepare a draft | Issue | Void |
|---|---|---|---|---|
| Visitor / deactivated account | no | no | no | no |
| Staff | yes | yes | no | no |
| Administrator, Owner | yes | yes | yes | yes |

An issued invoice cannot be edited or deleted by anyone; only voided (with a
reason; the number stays) or marked paid. Duplicate numbers are prevented under
retries and simultaneous requests (12 simultaneous issues of one draft: one
number; 20 different invoices at once: 20 consecutive numbers).

## Staging evidence (throwaway database, made-up data)

| Test | Result (rerun on the commit named in the review package) |
|---|---|
| `local-test/invoices_test.sh` — install, permissions, tax rules, numbering, simultaneous requests, void, rollback | 87 of 87 |
| `local-test/invoice_store_adapter_test.js` — the dashboard's code against this draft | 34 of 34 |
| `tests/specs/tax-pending-sweep-ext22.spec.js` — pending tax never shown as $0.00, never issued | 2 of 2 |

Full detail: `docs/ops/SQL_REVIEW_2026-11-16.md`, Part A.

## After running: checks (read-only, paste into the SQL editor)

```sql
select to_regclass('public.invoices') is not null as invoices_table,
       to_regclass('public.invoice_counters') is not null as counters_table,
       (select count(*) from public.invoices) as invoices,
       has_table_privilege('anon', 'public.invoices', 'select') as visitors_can_read;
```
Expected: `true | true | 0 | false`. Anything else: stop and send me a screenshot.

## Rollback and recovery

- **Before any invoice is issued:** run `33_DRAFT_rollback_invoices.sql`. It removes
  the two tables and functions and nothing else. Running it twice is harmless.
- **After an invoice has been issued or voided:** the rollback **refuses** and removes
  nothing, because issued invoices are business records. Recovery is then:
  1. turn the dashboard's invoice storage switch off (the screen stops using the tables);
  2. export the rows (SQL editor: `select * from public.invoices;` → Export CSV) and keep the file;
  3. I prepare a reviewed fix as a new draft; nothing is deleted.
- Restoring a Supabase backup is the last resort only: it rolls back the **whole**
  database to that moment, not just these tables.

## Your decision

- [ ] Approve running draft 32 in production (then I give you the steps one at a time), or
- [ ] Not yet.
