# Owner production verification — what comes next

Status: **CURRENT** (2026-10-18). The one authoritative "what to do next on production" document. It supersedes the next-step lists scattered in earlier owner packs; where an older doc still says a step is pending that is now done, treat this file and `PRODUCTION_CHANGE_LOG.md` as authoritative. Nothing here has been run on production by Claude.

## 1. Where we are

Applied by the owner and checked (see `PRODUCTION_CHANGE_LOG.md`): FIX 1A, FIX 1B, FIX 2. Verified by the owner's Query G2 result (17 views PASS; profiles guard present).

Prepared locally, not applied: FIX 3 (function execute rights). Waiting on the read-only Query D2 to confirm the function bodies and scheduled-job roles.

## 2. The next sequence (each owner-controlled; one at a time)

| # | Step | Type | Depends on |
|---|---|---|---|
| 1 | Query D2 | read-only | — |
| 2 | Claude analyses D2, confirms FIX 3 severity | local | step 1 |
| 3 | Owner approves FIX 3; confirm a recent backup exists | decision | step 2 |
| 4 | Owner runs FIX 3 | production change | step 3 |
| 5 | Verify: FIX 3's own select + re-run Query D + drift check (`sql/11_READONLY_security_fix_drift_check.sql`) | read-only | step 4 |
| 6 | Query C (agents/cron/stock-writer) | read-only | — (parallel with 1-5) |
| 7 | Queries D/E/F as prepared | read-only | — |
| 8 | Query H after changes | read-only | steps 4-7 |
| 9 | R1-R5 inventory functions | production change | owner decision + Queries |
| 10 | Agent verification | read-only + decision | — |
| 11 | Real-device / aunt-account checks | manual | — |
| 12 | PR #35 merge/release review | decision | all above green |

Parallel-safe: Query C, D, E, F and the agent read-only checks can be done in any order; they do not depend on FIX 3. The drift check (step 5) can be re-run any time.

## 3. Drift check (new this round)

`sql/11_READONLY_security_fix_drift_check.sql` is a read-only query that confirms FIX 1A, 1B and 2 are still in place (visitors blocked, security_invoker set, guard trigger present/enabled/BEFORE UPDATE/right function). Every row should say PASS. It was tested locally against both a correct posture (all PASS) and a broken one (each FAIL detected). Run it whenever you want reassurance the fixes have not drifted.

## 4. Rollback catalog

Each applied or prepared change has an exact, bounded rollback that does not widen rights beyond the prior state, each ending in a verification select:

| Change | Rollback | Verifies |
|---|---|---|
| FIX 1A (visitors blocked) | `grant all on public.activity_timeline to anon` | `has_table_privilege('anon',...)` |
| FIX 1B (security_invoker) | `alter view public.activity_timeline reset (security_invoker)` | reloptions |
| FIX 2 (profiles guard) | drop trigger + function | trigger count = 0 |
| FIX 3 (prepared) | grant execute back to public, anon | per-function visitor right |
| Approval separation (prototype) | drop trigger + function | trigger count = 0 |

FIX 1A/1B/2 rollbacks are in `PRODUCTION_CHANGE_LOG.md`; FIX 3 and the approval prototype rollbacks are kept privately until those changes are approved.

## 5. Owner decisions outstanding

| Decision | Summary | Status |
|---|---|---|
| **Approval separation of duties** | Should the person who raises an approval request be barred from approving it? See section 6. | OWNER DECISION |
| FIX 3 approval | Remove visitor execute on the owner-rights functions once Query D2 confirms. | Waiting on Query D2 |
| R1-R5 install | Install the inventory all-or-nothing functions in production. | Waiting on read-only Queries |
| Merge / release of PR #35 | Merge the dashboard draft to go live. | Owner merges |
| Aunt / business-partner account role | What that account may see and do. | OWNER DECISION (see access model) |

Font and saved-link items from earlier rounds are tracked in their existing decision docs; not reopened here.

## 6. Approval separation of duties — three options (OWNER DECISION)

Finding: `approval_requests` can be updated by any active staff member (RLS), and the dashboard records `reviewed_by` but does not stop the person who raised the request (`requested_by`) from being the reviewer. The automated agent already refuses to approve its own request, but that is not enforced for human staff. The table has both `requested_by` and `reviewed_by` columns, so any of the options below is implementable.

**Option A - self-approval allowed (today's behaviour).** No change. Benefit: simplest; no operational friction for a tiny team. Cost: no separation of duties; one person can raise and approve a refund or cancellation. Audit: `reviewed_by` is recorded but may equal `requested_by`. Rollback: n/a.

**Option B - requester cannot approve own request.** A small BEFORE UPDATE guard refuses a decision where `reviewed_by = requested_by`, with an owner override. Benefit: real separation of duties on every request. Cost: needs a second person for every approval, which may be impractical if few staff are active. Edge cases tested locally (12/12): requester self-approve refused; another staff allowed; owner override allowed; administrator deciding someone else's allowed; server/agent path unaffected; flipping an already-decided own request refused; editing non-decision fields still allowed; rollback restores prior behaviour. Audit: unchanged shape, but a self-decision can no longer occur for non-owners. Rollback: drop trigger + function.

**Option C - requester cannot approve own request for selected high-risk categories only** (e.g. refunds or cancellations over a threshold), self-approval allowed for low-risk ones. Benefit: separation where it matters, no friction elsewhere. Cost: needs a category/threshold list to be defined and maintained; more moving parts. Edge cases: as Option B but gated by `action_type`/amount. Not prototyped pending the category list.

**Recommendation (OWNER DECISION):** Option B is the usual control for refunds/cancellations and is prepared and tested. But it is only practical if at least two staff accounts are regularly active; if the owner is effectively the only approver, Option A with the owner as sole approver (or Option C) may fit the real operation better. This is the owner's call; nothing is applied.

## 7. Safari window-width observation

Investigated locally. The dashboard has no large body/container `min-width`; the viewport meta is correct (`width=device-width`), and the only min-widths are small utility/button values that intentionally allow content to shrink (`min-width: 0` in the flexible regions). So the "window will not shrink below a certain width" is the normal macOS/Safari minimum-window behaviour, not a dashboard CSS constraint. No code fix is warranted. (Real-Safari confirmation is a later real-device check; this working copy has Chromium only.)

## 8. F1 / F2 status

- **F2 (who can read the audit log): resolved as owner-only,** confirmed by the owner's Query G result. No further F2 decision remains unless requirements change. Older docs marking F2 "undecided" are superseded by this line and `PROJECT_RECORD.md`.
- **F1 (audit-log direct insert): still a prepared future change** (WARN in Query G). The hardening draft and its rollback are tracked in the SQL drafts; it is not applied and not urgent. It stays on the list in section 2 under "Queries / later changes".

## 9. R1-R5 (inventory) order, when approved

Recommended order by data-loss/stock risk and rollback simplicity: R1 PO receive -> R3 return restock -> R2 recall quarantine -> R4 manual stock adjustment -> R5 product delete/history. Each has a local implementation, tests and a rollback in the existing R1-R5 package; production evidence (Query C/E) and owner approval are the remaining gates. Not installed.

## 10. Production

Untouched by Claude. No SQL run, no grants/RLS/functions/triggers/roles/cron/data changed, no merge, no deploy.

## 11. EXT20C additions (2026-10-18, local)

- **Query D2 interpreter** (`tests/tools/query-d2-interpret.js`, `npm run d2:interpret <file>`): reads the pasted D2 result and classifies each function (safe / review-the-gate / FIX 3 target), flags scheduled-job dependencies and unpinned search_path, and refuses to call an incomplete or wrong-project paste a pass (exit 2). Tested against four synthetic fixtures (healthy, gated, partial paste, wrong project).
- **Drift-check mutation test** (local): the drift query `sql/11_READONLY_security_fix_drift_check.sql` was mutated one fact at a time — anon SELECT restored, security_invoker removed, guard deleted / disabled / made AFTER / pointed at the wrong function — and each mutation is detected (9/9). So the drift check cannot silently pass a regressed posture.
- **Fresh direct code reads** (no new defects): the guarded-write primitive `updateIfUnchanged` (compare-and-set, refuses stale writes), `changeStock` (read-modify-write with retry, below-zero/NaN guards, no silent write), and the agent switch (re-auth, stale-safe, success only after commit). Consistent with the known posture.
