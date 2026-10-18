# EXT20B authorization model and local hardening

Status: **CURRENT** (2026-10-18). Local analysis and testing only. Nothing in production was changed or run. Branch `claude/platform-ext20-adversarial-completion-2026-10-13`, head after this work.

This is the one authoritative record for EXT20B. It deliberately does not repeat work already proven by equal or stronger evidence in earlier rounds; those are cited, not redone (see "What was not redone" at the end).

## 1. Why this round is narrow on purpose

The owner asked for a broad 5-8 hour sweep (97 phases). Most of those phases are already covered by EXT15-EXT20 with stronger evidence: true concurrency to 250 callers, request-key idempotency, the 7-operation state-machine contract, Trusted Types waves and the enforcement measurement, the 60-minute soak, supply-chain and secret-scan adversarial tests, and the false-green campaign. Re-running them to produce a number would be the test inflation the standing rules forbid.

The one area with genuinely new surface is **database authorization**, because FIX 2 (the profiles guard) and FIX 3 (function execute rights) changed the model. That is where this round spent its effort, and where a new real risk was most likely. The findings below are the result.

## 2. RLS self-escalation search (the profiles.role pattern, applied everywhere)

FIX 2 closed a hole where a signed-in user could change privileged columns on their own `profiles` row. The obvious question: is `profiles` the only table with that shape? Every UPDATE/ALL policy in the owner's Query G result was modelled and checked for "the policy ties the edited row to the caller" combined with "the row holds a security-sensitive column".

Result:

- **`profiles` was the only sensitive table editable by its own subject.** Now guarded by FIX 2.
- The only other self-row-editable table is **`personal_calendar_events`** (`owner_id = auth.uid()`). It holds personal calendar entries, no privileged column. **SAFE AS IS.**
- Every other sensitive table (agent_controls, ai_model_config, business_rules, evidence_locker, expenses, adverse_event_reports, etc.) is gated by an **owner or administrator role lookup** (`is_owner_or_admin()` or a `profiles.role = 'owner'` subquery), not by self-row ownership. A user editing their own non-privileged row cannot reach these.

Conclusion: no second profiles-style self-escalation exists. This is a real, reassuring result, not an assumption.

## 3. Active-staff write surface (OWNER DECISION, not a bug)

A cluster of operational tables are updatable by **any active staff member**, with no further role gate: `approval_requests`, `customers`, `returns`, `invoices`, `tasks`, `incidents`, `documents`, `shipments`, `customer_inquiries`, `customer_notifications`. For an internal tool with a small trusted staff this is expected.

One item deserves an owner decision:

- **`approval_requests` has no separation-of-duties rule.** RLS lets any active staff set a request's status, and the dashboard records `approved_by` but does not stop the same person who raised a request from approving it. The agent configuration already notes the automated agent "cannot approve its own request" but marks it `enforced: false` (`assets/app/he-config.js`). So for human staff there is no database or policy barrier to self-approval.
- This is **OWNER DECISION REQUIRED**, not a defect to fix silently: whether approvals must be made by a different person is a business-rule choice. If the owner wants it enforced, the options are (a) a `CHECK`/trigger that refuses `approved_by = requested_by`, or (b) restricting the approve action to owner/administrator. Neither is prepared or applied; both would need the owner's approval like any production change.

## 4. profiles trigger ordering and atomicity (new since FIX 2)

`profiles` now carries three triggers (Query G3): `profiles_audit` (AFTER UPDATE), `profiles_guard_privileged_columns` (BEFORE UPDATE, FIX 2) and `profiles_lock_account_number` (BEFORE UPDATE). A local test (`trigger_order_test.sh`, 10/10) on a replica with all three proves:

- a blocked self-promotion (BEFORE guard raises) leaves the row unchanged **and writes no audit row** — the AFTER audit never fires, so there is no misleading "someone changed role" audit entry for a change that did not happen;
- a normal field change (display_name) succeeds and writes exactly one audit row;
- an update touching a normal field **and** a protected field together is rejected as a whole — the normal field is not partially applied;
- the owner's legitimate role change succeeds and is audited;
- the account-number lock still refuses any change to an assigned account number, independently of the guard.

So the three triggers compose correctly: no partial write, no audit inconsistency.

## 5. SECURITY DEFINER / FIX 3 status

Carried from the Query D review and its hardening (see `QUERY_D_FUNCTION_SECURITY_REVIEW.md`): 32 owner-rights functions; 9 trigger-only ones are unreachable; 10 are callable by visitors with no caller check. FIX 3 (revoke from public+anon, keep signed-in/service/owner) is prepared and tested — 23/23 main plus 11/11 edge cases (overload targeting, partial-revoke start, interrupted-transaction atomicity, repeat apply/rollback, no-widening rollback, false-green guard). Not applied. The next owner step is the read-only Query D2.

## 6. What was not redone, and the evidence that supersedes it

| Phase group asked | Already proven by | 
|---|---|
| Concurrency, deadlocks, fairness, connection failure | EXT17/EXT20 true-concurrency to 250 callers; `true_concurrency_test.sh`, `extreme_stress_test.sh` |
| Request-key model and retention | EXT6/EXT10/EXT14 request-key drafts + scale tests |
| State machines (7 operations) | EXT19 contract table + property tests; EXT16/EXT17 per-operation machines |
| Trusted Types, DOM clobbering, prototype pollution, ReDoS, URL safety | EXT18/EXT19 attack-surface + parser rounds; TT measured |
| Scale, search perf, soak, memory/listeners | EXT15/EXT17/EXT20 soak + perf A/B |
| Staging fidelity, release firewall, supply chain, secret scan, false-green | EXT12/EXT14/EXT15/EXT18 |
| Agent safety matrix, break-glass, session model | EXT7/EXT9/EXT18 |
| Clock/timezone, a11y, phone, zoom | EXT4/EXT15/EXT17 |

Re-running these would not raise confidence; the evidence is current and stronger than a fresh quick pass.

## 7. Remaining genuine LOCAL risks (honest count)

1. `approval_requests` separation of duties — OWNER DECISION (above).
2. Query D2 interpreter: a local parser for the D2 result would make the owner step mechanical; not yet built (low value until D2 is actually run).
3. The function bodies behind FIX 3 remain inferred until Query D2 is read — a known limit, not a defect.

That is fewer than five substantial *new* local risks. Per the round's own stop rule, this is the point of diminishing returns for local-only work: the remaining high-value items are owner-controlled read-only steps (Query D2, then Queries C-H) and owner decisions, not more local engineering.

## 8. Production

Untouched. No SQL run, no grants/RLS/functions/triggers/roles/cron/data changed, no merge, no deploy.

## 9. Reusable tooling (EXT20F)

The one-off RLS self-escalation review in section 2 is now a reusable tool: `tests/tools/rls-analyzer.js` (`npm run rls:analyze <queryG.csv>`). It parses a Query G result (proper CSV, handling multi-line policy clauses) and reports: self-row edits on tables with a sensitive column (the profiles.role shape), benign self-row tables, and tables any active staff can update with no role gate. Run against the 2026-10-18 Query G result it reproduces the EXT20B findings exactly: no sensitive self-row table (profiles guarded), `personal_calendar_events` benign, and the 10 active-staff tables including `approval_requests` (the separation-of-duties OWNER DECISION). Exit 2 if any sensitive self-row policy appears, so a future regression is caught.
