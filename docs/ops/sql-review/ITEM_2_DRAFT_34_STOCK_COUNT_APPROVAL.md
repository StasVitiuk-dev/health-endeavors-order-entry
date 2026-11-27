# Review item 2 of 4 — SQL draft 34: approval of stock-count adjustments (owner or administrator)

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · 2026-11-16
Nothing here has been run in production. I never run it myself: you run it, after approving it.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) | Last changed in |
|---|---|---|---|
| `docs/ops/sql/drafts/34_DRAFT_stock_count_adjustments.sql` (install) | 456 | `c94c2174afba71d0` | changed 2026-11-25 |
| `docs/ops/sql/drafts/35_DRAFT_rollback_stock_count_adjustments.sql` (undo) | 60 | `1199be64e8d015ad` | `f547516` |

The full text is in the review package (`5-sql/item-2/`).

## Changed before install (Nov 25): administrators approve too

Your decision of Nov 24 ("almost like owner"), answered the same evening: an administrator
**needs no approval from you**, also for their own proposal, and **you are told** instead.
Applied before install:
- an **active administrator** approves or rejects, also their own proposal; a switched-off
  administrator, staff and visitors are still refused (by function and by direct edit);
- **you are told:** this draft now attaches production's own change-history trigger (the same
  way draft 50 does), so every proposal and decision is in the history that your Home note
  "what administrators changed" reads;
- the earlier one-account grant is kept (so the undo file still matches) but is no longer
  needed; giving one is still yours only;
- the dashboard's stock-count screen follows: staff are refused, an administrator approves.

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by
you. Tested only on a throwaway local copy with made-up data.

## Purpose

Your decision of Nov 16, changed on Nov 24: staff and administrators may **propose** a
stock-count adjustment with a reason; **you or an administrator approve** (an administrator also
their own; you are told through the change history). The record keeps the original
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
- The earlier optional second step (granting one administrator account) is **no longer
  needed** since Nov 24: every active administrator approves.

## Who can do what (enforced by the database)

| Who | Propose (with a reason) | Approve / reject | Cancel |
|---|---|---|---|
| Staff | yes (a "blind count": they do not see the system figure) | no | their own proposal |
| Administrator | yes | **yes**, also their own proposal (Nov 24) | any open proposal |
| Owner | yes | yes | any open proposal |

A decided row can never be edited or deleted. Approving twice, or ten times at
once, decides once. Approval is refused if the stock changed since the count.

## Staging evidence (throwaway database, made-up data)

| Test | Result |
|---|---|
| `local-test/stock_count_adjustments_test.sh` — propose; approval by the owner or an administrator, also an administrator's own (Nov 25), staff and a switched-off administrator refused by function and by direct edit; the decision in the change history; blind counts, stale counts, simultaneous approvals, grants still owner-only, no stock figure changed, rollback | 88 of 88 (Nov 25; 90 before, the two checks that an administrator is refused were replaced) |
| `tests/specs/inventory-count-ext21.spec.js` and `cycle-count-wiring-ext21.spec.js` — the screen's rules | pass (full test pass) |

Re-checked on 2026-11-22 (commit `62e2ea8`): fingerprints unchanged; `stock_count_adjustments_test.sh` 90 of 90 and `stock_count_apply_once_test.sh` 17 of 17 (a count approved twice changes stock once), run again on a fresh throwaway copy.

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
