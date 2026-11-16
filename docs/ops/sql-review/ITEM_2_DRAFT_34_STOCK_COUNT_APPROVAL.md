# Review item 2 of 3 — SQL draft 34: owner-only approval of stock-count adjustments

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · 2026-11-16
Nothing here has been run in production. I never run it myself: you run it, after approving it.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) | Last changed in |
|---|---|---|---|
| `docs/ops/sql/drafts/34_DRAFT_stock_count_adjustments.sql` (install) | 432 | `d055eba3ba163b33` | `f547516` |
| `docs/ops/sql/drafts/35_DRAFT_rollback_stock_count_adjustments.sql` (undo) | 60 | `1199be64e8d015ad` | `f547516` |

The full text is in the review package (`5-sql/item-2/`).

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by
you. Tested only on a throwaway local copy with made-up data.

## Purpose

Your decision of Nov 16: staff and administrators may **propose** a stock-count
adjustment with a reason; **only you approve**. The record keeps the original
count, the requested count, the reason, who submitted it, who decided it, and
when. The rule is enforced in the database, not only on the screen.

## What it changes

Adds two new, empty tables (`stock_count_adjustments`, `stock_count_approvers`),
a guard, and the functions to propose, approve, reject, cancel, and to grant or
revoke approval for one named administrator account. **It changes no stock
figure**: approving records the decision only; writing the approved figure to
inventory is a separate, later step with its own approval. It changes no existing
table, row, permission or screen. Locks: none on existing tables. Takes seconds.

## Migration order and dependencies

- **Depends on** these existing production pieces: `auth.uid()`, `current_role()`,
  `is_owner_or_admin()`, `is_active_staff()`, and the `products`, `inventory` and
  `profiles` tables. The file checks them first and **stops, changing nothing**, if
  one is missing.
- **Depends on no other draft**; independent of drafts 32 and 36.
- **When:** when you want staff to start proposing counts through the dashboard.
- **Safe to run twice.**
- **Optional second step**, only if you want your own administrator account to
  approve too: the one statement in `docs/ops/STOCK_COUNT_APPROVAL_2026-11-16.md`,
  run separately, by you. Nobody can grant it to themselves.

## Who can do what (enforced by the database)

| Who | Propose (with a reason) | Approve / reject | Cancel |
|---|---|---|---|
| Staff | yes (a "blind count": they do not see the system figure) | no | their own proposal |
| Administrator | yes | **no** (unless you grant it to that one account) | their own proposal |
| Owner | yes | yes | any open proposal |

A decided row can never be edited or deleted. Approving twice, or ten times at
once, decides once. Approval is refused if the stock changed since the count.

## Staging evidence (throwaway database, made-up data)

| Test | Result |
|---|---|
| `local-test/stock_count_adjustments_test.sh` — propose, owner-only approval (by function and by direct edit), blind counts, stale counts, simultaneous approvals, grant/revoke, no stock figure changed, rollback | 90 of 90 |
| `tests/specs/inventory-count-ext21.spec.js` and `cycle-count-wiring-ext21.spec.js` — the screen's rules | pass (full test pass) |

## After running: checks (read-only)

```sql
select to_regclass('public.stock_count_adjustments') is not null as adjustments_table,
       (select count(*) from public.stock_count_adjustments) as adjustments,
       (select count(*) from public.stock_count_approvers) as granted_accounts,
       has_table_privilege('anon', 'public.stock_count_adjustments', 'select') as visitors_can_read;
```
Expected: `true | 0 | 0 | false`.

## Rollback and recovery

- **Before anything is approved or rejected:** run
  `35_DRAFT_rollback_stock_count_adjustments.sql`. It removes the two tables and the
  functions; open proposals and any grant go with them.
- **After a decision exists:** the rollback **refuses** (those rows are the record of
  your decisions). Recovery: stop using the screen's count approval; export the rows
  (`select * from public.stock_count_adjustments;` → Export CSV); I prepare a
  reviewed fix as a new draft. No stock figure needs undoing, because this draft
  never changes one.

## Your decision

- [ ] Approve running draft 34 in production, or
- [ ] Not yet.
- [ ] Also grant approval to my own administrator account (separate step; tell me which account).
