# Stock-count adjustments: owner-only approval

Status: CURRENT · 2026-11-16 · For: Stas · Staging only (made-up data). The
database part is a DRAFT that is not installed anywhere; it needs your approval.

## Your decision (Nov 16) and what was built

| You asked for | What exists now | Where it is checked |
|---|---|---|
| Staff and ordinary administrators may propose an adjustment, with a reason | A count becomes a proposal only with a written reason (at least 5 characters). The proposal records who made it and when. | `tests/specs/inventory-count-ext21.spec.js`; database test |
| Start with owner-only approval | Only the owner can approve or reject. Staff, an ordinary administrator, a deactivated account and a visitor are all refused — through the function and through a direct edit of the row. | database test, section "ONLY the owner approves" (11 checks) |
| Record the original count, requested count, reason, submitter, approver and timestamp | One row per proposal: `original_count`, `requested_count`, `reason`, `submitted_by`, `submitted_at`, `decided_by`, `decided_at` (plus a note when it is rejected). The screen shows the same record. | database test; `tests/specs/cycle-count-wiring-ext21.spec.js` |
| Enforce the rule on the backend | A database guard runs on every insert, update and delete, whoever makes it. The page's own check is a convenience on top. | `docs/ops/sql/drafts/34_DRAFT_stock_count_adjustments.sql` |
| Test that ordinary administrators cannot approve | Tested on a throwaway local database: **90 checks pass, 0 fail.** | `docs/ops/sql/local-test/stock_count_adjustments_test.sh` |
| Show how to grant the same authority to your personal administrator account | One statement, owner only, for one named account — see below. It is not run; it waits for your separate approval. | database test, section "granting approval to ONE named administrator account" |

## Details worth knowing

- **Nothing changes stock.** Approving records the decision only. Writing the
  approved figure to inventory is a separate, later step that needs its own
  approval (your standing rule: real stock writes stay gated). The test checks
  that no stock figure and no stock log row changed after every approval.
- **The system's figure cannot be typed.** The database reads it. Staff cannot
  see stock figures under today's row rules, so theirs is a "blind count": they
  enter what they counted, and the system's figure is recorded at the moment
  you decide. An administrator can see stock, so their proposal records it at once.
- **A count that has gone stale is refused.** If stock moved after the figure
  was recorded, approval says "count again". If the count now simply matches
  the system, there is nothing to approve.
- **A decision is final.** An approved or rejected row cannot be edited or
  deleted by anyone, including the owner. To correct a proposal that is still
  open, cancel it and propose again.
- **A double click decides once.** Ten approvals of the same proposal sent at
  the same moment produce one decision; the other nine are told it was already
  decided.
- **An approver cannot approve their own proposal** — except the owner.

## Granting approval to one named administrator account

Not done, and not needed for owner-only approval. If you later want your
personal administrator account to approve as well:

1. Draft 34 must be installed first (your approval).
2. You, signed in as the owner, run this one statement in the Supabase SQL
   editor. Replace the e-mail with that account's sign-in e-mail. It only
   works for an active administrator account, and only when the owner runs it.

```sql
select public.grant_stock_count_approval(
  (select id from public.profiles where email = 'REPLACE-WITH-THAT-ACCOUNTS-EMAIL' and role = 'administrator' and is_active),
  'Owner''s personal administrator account - may approve stock-count adjustments'
);
```

3. To check who has it: `select user_id, granted_by, granted_at, note from public.stock_count_approvers;`
4. To take it away again: `select public.revoke_stock_count_approval('<that account id>');`

What the test proves about the grant: an administrator cannot grant it to
themselves or to a colleague; it cannot go to a staff account or a deactivated
one; the granted account can approve other people's proposals but not its own;
the other administrator still cannot approve; a granted account that is
deactivated, or is no longer an administrator, loses it at once; only the owner
can revoke it.

## Rollback

`docs/ops/sql/drafts/35_DRAFT_rollback_stock_count_adjustments.sql` removes the
two tables and the functions and touches nothing else. It refuses to run once
any adjustment has been approved or rejected, because those rows are the record
of your decisions; export them first and decide separately.

## Not done yet

- The dashboard section is still the worked example (switch "Cycle count", off
  by default). It follows the same rule, but it is not connected to the
  database draft until that draft is approved and installed.
- Applying an approved figure to stock (separate approval).
- No audit trigger is attached to the new tables: the name of production's
  audit trigger function is not in this repository. The table is its own record.
