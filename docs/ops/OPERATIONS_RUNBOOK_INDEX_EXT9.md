# Operations runbook index (for Stas)

**Status:** CURRENT (2026-10-10, extension 9). Every procedure in one list, in plain words. Nothing here is automated, and no step is destructive.

## 1. Procedures

| When | Procedure | Where |
|---|---|---|
| Before any production change, and once a week | **2-minute backup check** | `PRODUCTION_READONLY_VERIFICATION_EXT9.md` §1 |
| Facts from production (agents, permissions, mismatches) | **Read-only checks V1–V10** | `PRODUCTION_READONLY_VERIFICATION_EXT9.md` |
| Reviewing and merging a dashboard change | **Merge = deploy**: PR → review → Merge → hard refresh (Cmd+Shift+R) → check | the PR's "Deployment instructions"; `CLAUDE.md` "live-change process" |
| Undoing a dashboard change | **Rollback**: GitHub → the merged PR → **Revert** → merge the revert PR → hard refresh | `ROLLBACK_AND_BACKUP_REVIEW.md` |
| Installing a database change | **Production change package** (order, prechecks, rollback) | `PRODUCTION_CHANGE_PACKAGE_EXT9.md` |
| Installing R1–R5 | step by step with screenshots | `R1-R5-INSTALL-RUNBOOK.md` |
| Turning a stock button over to its database function | Feature Switches page, one switch at a time | `PRODUCTION_CHANGE_PACKAGE_EXT9.md` P4 |
| Checking the agents | read-only look | `AGENT_CURRENT_STATE_EXT9.md`, V2/V3 |
| Practising a restore | throwaway Supabase project only | `RECOVERY_AND_BACKUP_READINESS.md` §4 |
| Looking at the dashboard safely on made-up data | staging review copy | `STAGING_REVIEW_PLAN.md` |
| Something looks wrong | **Incident mini-runbooks** | §2 below |

## 2. Incident mini-runbooks

General rule for all of them: **stop, look, write down, don't "fix" by pressing things again.** Nothing below deletes anything or runs SQL that writes.

| Situation | First 5 minutes | Then | Never |
|---|---|---|---|
| **Stock looks wrong** (Inventory number does not match the shelf) | Open Inventory → the product → Adjustment history; note the last changes (who, when, reason) | Count the shelf; correct with one manual adjustment with a clear reason ("count correction 10 Oct, shelf = 37"); run V6 Query E later to find the cause | Don't adjust several times "until it looks right"; don't delete history |
| **A purchase order looks received twice** (stock or expense doubled) | Purchase Orders → the PO: status, received date; Expenses: two lines "Purchase order PO-…"?; Inventory history: two "Delivery received (PO-…)" rows? | Correct by hand: one adjustment back with reason "duplicate receipt PO-…", delete the duplicate expense (it goes to the recycle bin, restorable). Tell the session the PO number: it will check the cause | Don't press Receive again; don't edit the PO lines |
| **An agent seems stuck or noisy** (many tasks, same task repeated) | AI Agent Activity page: is the agent on? last run? | Turn that agent's switch off (password). Leave everything else as is. Tell the session the agent number and a screenshot | Don't delete the tasks it made (they are the evidence) |
| **Customer sync issue** (orders not arriving / wrong customer) | Feature Switches: Shopify Order Sync on or off? (it is OFF on purpose before launch) | If on and wrong: turn it off (password). Screenshot of the order and the expected data | Don't edit customer links by hand in bulk |
| **Dashboard won't open** | Try a Private Window; try the phone; check https://www.githubstatus.com and https://status.supabase.com | If only after a merge: revert that merge (above). Otherwise wait and tell the session the exact message | Don't change Supabase settings or keys |
| **Backup stale or failed** (V1 not green) | Note the date and colour | No production changes until green; check Actions minutes; tell the session "nightly red, date" | Don't open logs into chat; don't re-run jobs |
| **A read-only check (V2–V7) returns FAIL** | Save the CSV | Send it; the session explains each row and drafts a fix for approval | Don't try SQL fixes from the internet |
| **A stock switch was turned on and the button misbehaves** | Turn the switch off (instant) | Screenshot of the message; the old path is back immediately | Don't run the rollback SQL first |
